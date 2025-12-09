import os
import sys
import asyncio
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Load environment variables
load_dotenv()

PROJECT = os.getenv('MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID')
LOCATION = os.getenv('MOMENTUM_AGENT_ENGINE_LOCATION', 'us-central1')

print(f"Using Project: {PROJECT}, Location: {LOCATION}")

import vertexai
from google.adk.memory import VertexAiMemoryBankService
from google.adk.sessions import InMemorySessionService
from google.adk.agents import LlmAgent
from google.adk.runners import Runner
from google.genai.types import Content, Part

async def run_test():
    try:
        vertexai.init(project=PROJECT, location=LOCATION)
        client = vertexai.Client(project=PROJECT, location=LOCATION)

        print("Creating Agent Engine with gemini-2.5-flash...")
        # User's exact config
        agent_engine = client.agent_engines.create(
            config={
                "context_spec": {
                    "memory_bank_config": {
                        "generation_config": {
                            "model": f"projects/{PROJECT}/locations/{LOCATION}/publishers/google/models/gemini-2.5-flash"
                        }
                    }
                }
            }
        )
        
        engine_id = agent_engine.api_resource.name.split("/")[-1]
        print(f"Agent Engine created: {engine_id}")

        memory_bank_service = VertexAiMemoryBankService(
            agent_engine_id=engine_id,
            project=PROJECT,
            location=LOCATION,
        )

        APP_NAME = "momentum"
        MODEL = "gemini-2.5-flash"
        USER_ID = "My User Repro"

        # We need an agent to run the runner
        # Note: LlmAgent might need a real model to work if we actually run it, 
        # but for memory saving we might just need the session service?
        # The user's code runs the runner.
        
        # If gemini-2.5-flash is not a valid model for LlmAgent (GenAI), this might fail.
        # But let's try.
        
        # Test memory saving directly
        print("Testing memory saving directly...")
        from google.adk.events import Event
        
        event = Event(
            author="user",
            content=Content(
                role="user",
                parts=[Part(text="My favorite color is green.")]
            )
        )
        
        # We need a session object
        from google.adk.sessions import Session
        session = Session(id="test_session_repro", app_name=APP_NAME, user_id=USER_ID, state={})
        
        # Use the manual generation method I know works (or try the service method)
        # The service might have create_session_and_event or similar
        if hasattr(memory_bank_service, 'create_session_and_event'):
            await memory_bank_service.create_session_and_event(session=session, event=event)
        else:
            # Manual fallback
            client = memory_bank_service._get_api_client()
            events_data = [{'content': {'role': 'user', 'parts': [{'text': 'My favorite color is green.'}]}}]
            
            operation = client.agent_engines.memories.generate(
                name='reasoningEngines/' + engine_id,
                direct_contents_source={'events': events_data},
                scope={
                    'app_name': APP_NAME,
                    'user_id': USER_ID,
                },
                config={'wait_for_completion': True},
            )
            print(f"Memory generation response: {operation}")
            
        print("Memory saved successfully!")
        
    except Exception as e:
        print(f"Error in repro: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_test())
