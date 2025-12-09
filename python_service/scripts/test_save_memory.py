import asyncio
import os
import sys
import uuid
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Load environment variables
load_dotenv()

from google.adk.memory import VertexAiMemoryBankService
from google.adk.sessions import Session
from google.adk.events import Event
from google.genai.types import Content, Part

async def test_save_memory(agent_engine_id):
    print(f"Testing memory save to Agent Engine ID: {agent_engine_id}")
    
    project_id = os.getenv('MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID') or os.getenv('MOMENTUM_GOOGLE_CLOUD_PROJECT')
    location = os.getenv('MOMENTUM_AGENT_ENGINE_LOCATION', 'us-central1')
    
    if not project_id:
        print("Error: Project ID not found in environment.")
        return

    print(f"Project: {project_id}, Location: {location}")

    try:
        # Initialize Service
        memory_service = VertexAiMemoryBankService(
            project=project_id,
            location=location,
            agent_engine_id=agent_engine_id
        )
        
        # Create Dummy Session and Event
        user_id = "test_user_" + uuid.uuid4().hex[:8]
        session_id = "test_session_" + uuid.uuid4().hex[:8]
        
        print(f"Creating test memory for User: {user_id}")
        
        # Create event with content
        # We use a simple dict structure for content to be safe with ADK expectations if needed
        # or use the ADK types if we are sure.
        # Let's use the manual generation approach which is most robust for this test.
        
        client = memory_service._get_api_client()
        events_data = [{'content': {'role': 'user', 'parts': [{'text': 'My favorite color is blue and I love coding in Python.'}]}}]
        
        print("Sending events to ADK...")
        operation = client.agent_engines.memories.generate(
            name='reasoningEngines/' + agent_engine_id,
            direct_contents_source={'events': events_data},
            scope={
                'app_name': "MOMENTUM",
                'user_id': user_id,
            },
            config={'wait_for_completion': True},
        )
        print(f"Memory generation completed. Response: {operation}")

        print("Memory saved successfully!")
        
    except Exception as e:
        print(f"Error saving memory: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_save_memory.py <agent_engine_id>")
        sys.exit(1)
    
    agent_engine_id = sys.argv[1]
    asyncio.run(test_save_memory(agent_engine_id))
