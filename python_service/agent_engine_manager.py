"""
Agent Engine Manager - Optimized for Google ADK and Vertex AI Agent Engine
Based on latest documentation from https://docs.cloud.google.com/agent-builder/agent-engine/

This module handles creation, deletion, and management of Vertex AI Agent Engines
with Memory Bank support for both personal (user) and team (brand) memory banks.
"""

import os
import logging
from typing import Optional, Dict, Any, Literal
from firebase_admin import firestore
from google.api_core import exceptions
from google.cloud import aiplatform_v1beta1 as aiplatform
from utils.model_defaults import DEFAULT_TEXT_MODEL

logger = logging.getLogger(__name__)

# Type alias for memory bank types
MemoryBankType = Literal['personal', 'team']


# Environment configuration
def get_project_id() -> str:
    """Get project ID from environment with proper fallback."""
    return os.getenv('MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID') or os.getenv(
        'GOOGLE_CLOUD_PROJECT')


def get_location() -> str:
    """Get location from environment with default."""
    return os.getenv('MOMENTUM_AGENT_ENGINE_LOCATION', 'us-central1')


def is_memory_bank_enabled() -> bool:
    """Check if Memory Bank is enabled."""
    value = os.getenv('MOMENTUM_ENABLE_MEMORY_BANK', 'false')
    logger.info(
        f"[DEBUG] is_memory_bank_enabled() checking: MOMENTUM_ENABLE_MEMORY_BANK='{value}'"
    )
    result = value.lower() == 'true'
    logger.info(f"[DEBUG] is_memory_bank_enabled() returning: {result}")
    return result


async def create_agent_engine(
        user_id: Optional[str] = None,
        brand_id: Optional[str] = None,
        memory_type: MemoryBankType = 'personal') -> Dict[str, Any]:
    """
    Creates a new Vertex AI Agent Engine with Memory Bank.

    This function supports both personal (user) and team (brand) memory banks:
    - Personal: Created for a specific user, stores user-specific memories
    - Team: Created for a brand/team, stores shared team memories

    Args:
        user_id: The user ID to create a personal engine for (required for personal type)
        brand_id: The brand ID to create a team engine for (required for team type)
        memory_type: 'personal' or 'team'

    Returns:
        Dict with status, message, and agent_engine_id

    Raises:
        ValueError: If required configuration is missing
        Exception: If engine creation fails
    """
    project_id = get_project_id()
    location = get_location()

    if not project_id:
        raise ValueError(
            "MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable is required"
        )

    if not is_memory_bank_enabled():
        return {
            "status":
            "error",
            "message":
            "Memory Bank is not enabled. Set MOMENTUM_ENABLE_MEMORY_BANK=true"
        }

    # Validate required IDs based on type
    if memory_type == 'personal' and not user_id:
        raise ValueError("user_id is required for personal memory engine")
    if memory_type == 'team' and not brand_id:
        raise ValueError("brand_id is required for team memory engine")

    # Determine display name and entity ID
    if memory_type == 'team':
        display_name = f"momentum-team-{brand_id}"
        entity_id = brand_id
        logger.info(
            f"Creating Team Agent Engine for brand {brand_id} in project {project_id}, location {location}"
        )
    else:
        display_name = f"momentum-agent-{user_id}"
        entity_id = user_id
        logger.info(
            f"Creating Personal Agent Engine for user {user_id} in project {project_id}, location {location}"
        )

    try:
        # Initialize Reasoning Engine Service client
        client = aiplatform.ReasoningEngineServiceClient(
            client_options={
                "api_endpoint": f"{location}-aiplatform.googleapis.com"
            })

        parent = f"projects/{project_id}/locations/{location}"

        # Create Reasoning Engine with Memory Bank configuration
        reasoning_engine = aiplatform.ReasoningEngine(
            context_spec=aiplatform.ReasoningEngineContextSpec(
                memory_bank_config=aiplatform.ReasoningEngineContextSpec.
                MemoryBankConfig(
                    generation_config=aiplatform.ReasoningEngineContextSpec.
                    MemoryBankConfig.GenerationConfig(
                        model=
                        f"projects/{project_id}/locations/{location}/publishers/google/models/{DEFAULT_TEXT_MODEL}"
                    ))),
            display_name=display_name)

        request = aiplatform.CreateReasoningEngineRequest(
            parent=parent, reasoning_engine=reasoning_engine)

        logger.info(f"Sending create request to Vertex AI...")
        operation = client.create_reasoning_engine(request=request)

        logger.info(f"Waiting for Agent Engine creation to complete...")
        response = operation.result(timeout=300)  # 5 minute timeout

        # Extract engine ID from resource name
        engine_id = response.name.split('/')[-1]

        logger.info(f"Successfully created Agent Engine: {engine_id}")

        # Store engine ID in Firestore
        db = firestore.client()
        if memory_type == 'team':
            db.collection('brands').document(brand_id).set(
                {
                    'teamAgentEngineId': engine_id,
                    'teamAgentEngineCreatedAt': firestore.SERVER_TIMESTAMP,
                    'teamAgentEngineName': display_name
                },
                merge=True)
            logger.info(
                f"Stored Team Agent Engine ID in Firestore for brand {brand_id}"
            )
        else:
            db.collection('users').document(user_id).set(
                {
                    'agentEngineId': engine_id,
                    'agentEngineCreatedAt': firestore.SERVER_TIMESTAMP,
                    'agentEngineName': display_name
                },
                merge=True)
            logger.info(
                f"Stored Personal Agent Engine ID in Firestore for user {user_id}"
            )

        return {
            "status": "success",
            "message":
            f"{memory_type.capitalize()} Agent Engine created successfully",
            "agent_engine_id": engine_id
        }

    except exceptions.GoogleAPIError as e:
        logger.error(f"Google API error creating Agent Engine: {e}",
                     exc_info=True)
        return {"status": "error", "message": f"Google API error: {str(e)}"}
    except Exception as e:
        logger.error(f"Error creating Agent Engine: {e}", exc_info=True)
        return {
            "status": "error",
            "message": f"Failed to create Agent Engine: {str(e)}"
        }


async def delete_agent_engine(
        user_id: Optional[str] = None,
        brand_id: Optional[str] = None,
        memory_type: MemoryBankType = 'personal') -> Dict[str, Any]:
    """
    Deletes a Vertex AI Agent Engine and cleans up Firestore.

    Args:
        user_id: The user ID for personal memory engine
        brand_id: The brand ID for team memory engine
        memory_type: 'personal' or 'team'

    Returns:
        Dict with status and message
    """
    project_id = get_project_id()
    location = get_location()

    if not project_id:
        raise ValueError(
            "MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable is required"
        )

    # Validate required IDs based on type
    if memory_type == 'personal' and not user_id:
        raise ValueError("user_id is required for personal memory engine")
    if memory_type == 'team' and not brand_id:
        raise ValueError("brand_id is required for team memory engine")

    entity_id = brand_id if memory_type == 'team' else user_id
    logger.info(f"Deleting {memory_type} Agent Engine for {entity_id}")

    try:
        # Get engine ID from Firestore
        db = firestore.client()

        if memory_type == 'team':
            doc = db.collection('brands').document(brand_id).get()
            agent_engine_id_field = 'teamAgentEngineId'
        else:
            doc = db.collection('users').document(user_id).get()
            agent_engine_id_field = 'agentEngineId'

        if not doc.exists:
            return {
                "status": "error",
                "message": f"Entity {entity_id} not found"
            }

        doc_data = doc.to_dict()
        agent_engine_id = doc_data.get(agent_engine_id_field)

        if not agent_engine_id:
            return {
                "status": "success",
                "message": "No Agent Engine to delete"
            }

        # Initialize Reasoning Engine Service client
        client = aiplatform.ReasoningEngineServiceClient(
            client_options={
                "api_endpoint": f"{location}-aiplatform.googleapis.com"
            })

        name = f"projects/{project_id}/locations/{location}/reasoningEngines/{agent_engine_id}"

        logger.info(f"Deleting Agent Engine: {name}")

        try:
            request = aiplatform.DeleteReasoningEngineRequest(name=name)
            operation = client.delete_reasoning_engine(request=request)
            operation.result(timeout=180)  # 3 minute timeout
            logger.info(
                f"Successfully deleted Agent Engine: {agent_engine_id}")
        except exceptions.NotFound:
            logger.warning(
                f"Agent Engine {agent_engine_id} not found (may already be deleted)"
            )

        # Remove from Firestore
        if memory_type == 'team':
            db.collection('brands').document(brand_id).update({
                'teamAgentEngineId':
                firestore.DELETE_FIELD,
                'teamAgentEngineCreatedAt':
                firestore.DELETE_FIELD,
                'teamAgentEngineName':
                firestore.DELETE_FIELD
            })
            logger.info(
                f"Removed Team Agent Engine ID from Firestore for brand {brand_id}"
            )
        else:
            db.collection('users').document(user_id).update({
                'agentEngineId':
                firestore.DELETE_FIELD,
                'agentEngineCreatedAt':
                firestore.DELETE_FIELD,
                'agentEngineName':
                firestore.DELETE_FIELD
            })
            logger.info(
                f"Removed Personal Agent Engine ID from Firestore for user {user_id}"
            )

        return {
            "status":
            "success",
            "message":
            f"{memory_type.capitalize()} Agent Engine deleted successfully"
        }

    except exceptions.GoogleAPIError as e:
        logger.error(f"Google API error deleting Agent Engine: {e}",
                     exc_info=True)
        return {"status": "error", "message": f"Google API error: {str(e)}"}
    except Exception as e:
        logger.error(f"Error deleting Agent Engine: {e}", exc_info=True)
        return {
            "status": "error",
            "message": f"Failed to delete Agent Engine: {str(e)}"
        }


async def get_agent_engine_id(
        user_id: Optional[str] = None,
        brand_id: Optional[str] = None,
        memory_type: MemoryBankType = 'personal') -> Optional[str]:
    """
    Get the Agent Engine ID from Firestore.

    Args:
        user_id: The user ID for personal memory
        brand_id: The brand ID for team memory
        memory_type: 'personal' or 'team'

    Returns:
        The Agent Engine ID or None if not found
    """
    try:
        db = firestore.client()

        if memory_type == 'team' and brand_id:
            doc = db.collection('brands').document(brand_id).get()
            if doc.exists:
                return doc.to_dict().get('teamAgentEngineId')
        elif user_id:
            doc = db.collection('users').document(user_id).get()
            if doc.exists:
                return doc.to_dict().get('agentEngineId')

        return None
    except Exception as e:
        logger.error(f"Error getting Agent Engine ID: {e}")
        return None


async def get_both_engine_ids(user_id: str,
                              brand_id: str) -> Dict[str, Optional[str]]:
    """
    Get both personal and team Agent Engine IDs for a user.

    This is used when both memory banks are enabled and we need to query both.

    Args:
        user_id: The user ID
        brand_id: The brand ID

    Returns:
        Dict with 'personal' and 'team' engine IDs (or None if not found)
    """
    try:
        db = firestore.client()

        personal_engine_id = None
        team_engine_id = None

        # Get personal engine ID
        user_doc = db.collection('users').document(user_id).get()
        if user_doc.exists:
            personal_engine_id = user_doc.to_dict().get('agentEngineId')

        # Get team engine ID
        brand_doc = db.collection('brands').document(brand_id).get()
        if brand_doc.exists:
            team_engine_id = brand_doc.to_dict().get('teamAgentEngineId')

        return {'personal': personal_engine_id, 'team': team_engine_id}
    except Exception as e:
        logger.error(f"Error getting engine IDs: {e}")
        return {'personal': None, 'team': None}


async def check_agent_engine_status(user_id: str) -> Dict[str, Any]:
    """
    Check the status of a user's Agent Engine.

    Args:
        user_id: The user ID

    Returns:
        Dict with status information
    """
    project_id = get_project_id()
    location = get_location()

    try:
        agent_engine_id = await get_agent_engine_id(user_id=user_id,
                                                    memory_type='personal')

        if not agent_engine_id:
            return {
                "status": "not_found",
                "message": "No Agent Engine configured for this user",
                "has_engine": False
            }

        # Check if engine exists in Vertex AI
        client = aiplatform.ReasoningEngineServiceClient(
            client_options={
                "api_endpoint": f"{location}-aiplatform.googleapis.com"
            })

        name = f"projects/{project_id}/locations/{location}/reasoningEngines/{agent_engine_id}"

        try:
            request = aiplatform.GetReasoningEngineRequest(name=name)
            engine = client.get_reasoning_engine(request=request)

            return {
                "status":
                "active",
                "message":
                "Agent Engine is active",
                "has_engine":
                True,
                "agent_engine_id":
                agent_engine_id,
                "display_name":
                engine.display_name
                if hasattr(engine, 'display_name') else None
            }
        except exceptions.NotFound:
            return {
                "status": "not_found_in_vertex",
                "message":
                "Agent Engine ID exists in Firestore but not found in Vertex AI",
                "has_engine": False,
                "agent_engine_id": agent_engine_id
            }

    except Exception as e:
        logger.error(f"Error checking Agent Engine status: {e}")
        return {"status": "error", "message": str(e), "has_engine": False}
