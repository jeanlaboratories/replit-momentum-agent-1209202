import asyncio
import os
import sys
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Load environment variables
load_dotenv()

from google.adk.memory import VertexAiMemoryBankService

async def test_retrieval():
    project_id = os.getenv('MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID')
    location = os.getenv('MOMENTUM_AGENT_ENGINE_LOCATION', 'us-central1')
    agent_engine_id = "2568261250391736320"
    user_id = "WxcnNvdyDNS6EQWiFHESFbffYmm1"
    query = "favorite color"
    
    print(f"Testing retrieval for User: {user_id}")
    print(f"Engine: {agent_engine_id}")
    print(f"Query: {query}")
    
    try:
        memory_service = VertexAiMemoryBankService(
            project=project_id,
            location=location,
            agent_engine_id=agent_engine_id
        )
        
        print("Searching memory...")
        results = await memory_service.search_memory(
            user_id=user_id,
            app_name="MOMENTUM",
            query=query
        )
        
        print(f"Results: {results}")
        if results and results.memories:
            formatted_memories = []
            for memory in results.memories:
                print(f"Processing memory type: {type(memory)}")
                if hasattr(memory, 'content') and hasattr(memory.content, 'parts'):
                    for part in memory.content.parts:
                        if hasattr(part, 'text'):
                            formatted_memories.append(part.text)
                else:
                    formatted_memories.append(str(memory))
            print(f"Formatted Memories: {formatted_memories}")
        else:
            print("No memories found.")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_retrieval())
