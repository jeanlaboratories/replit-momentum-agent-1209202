import os
import logging
import json
from typing import Optional, Dict, Any, List
from firebase_admin import firestore
from google.adk.memory import VertexAiMemoryBankService
from google.cloud import aiplatform_v1beta1 as aiplatform
from utils.model_defaults import DEFAULT_TEXT_MODEL

logger = logging.getLogger(__name__)

# Global genai_client will be set by momentum_agent or other modules
genai_client = None
memory_service = None  # Global memory service instance


def set_genai_client(client):
    global genai_client
    genai_client = client


def set_memory_service(service):
    global memory_service
    memory_service = service


class InMemoryMemoryService:
    """Simple in-memory memory service for development."""

    def __init__(self):
        self.memories = {}  # user_id -> list of memories

    async def add_memory(self,
                         user_id: str,
                         chat_history: List[Dict[str, str]],
                         app_name: str = "MOMENTUM"):
        if user_id not in self.memories:
            self.memories[user_id] = []
        # Just store the last message for now as a simple memory
        if chat_history:
            last_msg = chat_history[-1]['content']
            self.memories[user_id].append(last_msg)
        return True

    async def retrieve_memories(self,
                                user_id: str,
                                query: str,
                                limit: int = 5):
        if user_id in self.memories:
            # Simple substring match for now
            return [
                m for m in self.memories[user_id]
                if query.lower() in m.lower()
            ][:limit]
        return []

    async def search_memory(self,
                            user_id: str,
                            app_name: str,
                            query: str,
                            limit: int = 5):
        """Search memory for the given query. Returns a mock result object compatible with ADK."""
        memories = await self.retrieve_memories(user_id, query, limit)

        # Create a mock result object that looks like ADK's response
        class MockResult:

            def __init__(self, memories_list):
                self.memories = memories_list

        return MockResult(memories)


def extract_memories_from_conversation(
        chat_history: List[Dict[str, str]]) -> List[str]:
    """
    Extracts key facts and preferences from a conversation history using Gemini.

    Args:
        chat_history: List of chat messages.

    Returns:
        List of extracted facts as strings.
    """
    if not chat_history or not genai_client:
        return []

    # Prepare conversation text for extraction
    conversation_text = ""
    for msg in chat_history:
        role = "User" if msg['role'] == 'user' else "Assistant"
        conversation_text += f"{role}: {msg['content']}\n"

    prompt = f"""
    Analyze the following conversation between a User and an Assistant.
    Extract any new, significant facts about the user, their preferences, or their team/brand.
    Do not extract general conversation, only facts that should be remembered for future interactions.

    Conversation:
    {conversation_text}

    Return only a JSON array of strings, where each string is a single new fact.
    If no new significant facts are found, return an empty array [].
    """

    try:
        response = genai_client.models.generate_content(
            model=DEFAULT_TEXT_MODEL,
            contents=prompt,
            config={'response_mime_type': 'application/json'})
        import json
        facts = json.loads(response.text)
        if isinstance(facts, list):
            return [str(f) for f in facts]
        return []
    except Exception as e:
        logger.error(f"Error extracting memories: {e}")
        return []


async def save_conversation_to_memory(
        user_id: str,
        chat_history: List[Dict[str, str]],
        pre_extracted_facts: Optional[List[str]] = None,
        adk_events: Optional[List[Dict[str, Any]]] = None) -> None:
    """
    Save a conversation to the user's long-term memory.
    Also extracts and stores individual facts in Firestore for listing.

    Args:
        user_id: The user ID.
        chat_history: List of chat messages.
        pre_extracted_facts: Optional list of facts to save to Firestore (bypasses extraction).
        adk_events: Optional list of ADK events to save (bypasses generation from chat_history).
    """
    # 1. Check if user has personal memory (ADK) enabled
    # This is indicated by having an agentEngineId in Firestore
    db = firestore.client()
    user_doc = db.collection('users').document(user_id).get()
    agent_engine_id = None
    if user_doc.exists:
        user_doc_data = user_doc.to_dict()
        agent_engine_id = user_doc_data.get('agentEngineId')

    if agent_engine_id:
        # Use ADK/Vertex memory
        project_id = os.getenv('MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID')
        location = os.getenv('MOMENTUM_AGENT_ENGINE_LOCATION', 'us-central1')

        if project_id and agent_engine_id:
            adk_memory_service = VertexAiMemoryBankService(
                project=project_id,
                location=location,
                agent_engine_id=agent_engine_id)

            # If we have pre-extracted facts, use them, otherwise generate from history
            memories_to_save = []
            if pre_extracted_facts:
                memories_to_save = pre_extracted_facts
            elif adk_events:
                # Extract from ADK events if available
                for event in adk_events:
                    if 'text' in event:
                        memories_to_save.append(event['text'])
            else:
                # Fallback to extraction
                memories_to_save = extract_memories_from_conversation(
                    chat_history)

            for memory_text in memories_to_save:
                try:
                    # ADK memory service uses the new API format
                    client = adk_memory_service._get_api_client()

                    # Agent engine name format for the new API
                    agent_engine_name = f"projects/{project_id}/locations/{location}/reasoningEngines/{agent_engine_id}"

                    # Use the new API format: memories.create(name=..., fact=..., scope=...)
                    # The 'name' parameter is the agent engine resource name
                    # The 'fact' parameter is the memory text
                    # The 'scope' parameter identifies the user
                    operation = client.agent_engines.memories.create(
                        name=agent_engine_name,
                        fact=memory_text,
                        scope={"user_id": user_id})

                    # Get the created memory ID from response if possible
                    adk_memory_id = None
                    if hasattr(operation, 'name'):
                        adk_memory_id = operation.name
                    elif hasattr(operation, 'response') and operation.response:
                        if hasattr(operation.response, 'name'):
                            adk_memory_id = operation.response.name
                        elif hasattr(operation.response,
                                     'memory') and operation.response.memory:
                            adk_memory_id = operation.response.memory.name

                    # Save to Firestore as well for listing/management
                    # This is important for the fallback and listing logic
                    memory_ref = db.collection('users').document(
                        user_id).collection('memories').add({
                            'content':
                            memory_text,
                            'createdAt':
                            firestore.SERVER_TIMESTAMP,
                            'updatedAt':
                            firestore.SERVER_TIMESTAMP,
                            'adkMemoryId':
                            adk_memory_id
                        })

                except Exception as e:
                    logger.error(f"Error saving memory to ADK: {e}")
                    # Fallback to Firestore only
                    db.collection('users').document(user_id).collection(
                        'memories').add({
                            'content': memory_text,
                            'createdAt': firestore.SERVER_TIMESTAMP,
                            'updatedAt': firestore.SERVER_TIMESTAMP
                        })
            return  # Done with ADK path

    # Fallback to InMemoryMemoryService (Global)
    if not chat_history:
        return

    logger.info(f"Saving conversation to memory for user: {user_id}")

    # 1. Save to ADK Memory Bank (for agent retrieval)
    # We know we are in global path here because ADK path returned early
    current_memory_service = memory_service  # Default (Global)

    try:
        # Format for ADK
        adk_chat_history = []
        for msg in chat_history:
            role = "user" if msg['role'] == 'user' else "model"
            adk_chat_history.append({"role": role, "content": msg['content']})

        logger.info("Using standard add_memory for non-Vertex service")
        if hasattr(current_memory_service, 'add_memory'):
            await current_memory_service.add_memory(
                user_id=user_id,
                chat_history=adk_chat_history,
                app_name="MOMENTUM")
            logger.info(
                f"Successfully saved conversation to ADK Memory Bank for user {user_id}"
            )
        else:
            logger.warning(
                f"Memory service {type(current_memory_service)} does not support add_memory"
            )
    except Exception as e:
        logger.error(f"Error saving to ADK Memory Bank: {e}")
        # Continue to Firestore storage even if ADK fails

    # 2. Extract and Save to Firestore (for user listing)
    try:
        memories_ref = db.collection('users').document(user_id).collection(
            'memories')

        # Check for pre-extracted facts or generate them
        facts_to_save = []
        if pre_extracted_facts:
            facts_to_save = pre_extracted_facts
        else:
            # Automatic extraction
            facts_to_save = extract_memories_from_conversation(chat_history)

        if facts_to_save:
            # Get existing memories to avoid duplicates
            existing_memories = []
            try:
                docs = memories_ref.stream()
                existing_memories = [d.to_dict().get('content') for d in docs]
            except Exception as e:
                logger.warning(f"Could not check existing memories: {e}")

            for fact in facts_to_save:
                if fact not in existing_memories:
                    memories_ref.add({
                        'content': fact,
                        'createdAt': firestore.SERVER_TIMESTAMP,
                        'updatedAt': firestore.SERVER_TIMESTAMP
                    })
                    existing_memories.append(
                        fact)  # Prevent duplicates in same batch
            logger.info(
                f"Saved {len(facts_to_save)} memories to Firestore for user {user_id}"
            )
    except Exception as e:
        logger.error(f"Error saving to Firestore: {e}")
