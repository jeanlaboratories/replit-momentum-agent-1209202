import asyncio
import sys
import os

# Add project root and python_service to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(os.path.join(os.path.dirname(__file__), '.'))

from python_service.momentum_agent import recall_memory
from python_service.main import app
import firebase_admin
from firebase_admin import firestore

async def verify_memory(user_id, query):
    print(f"Checking memory for user: {user_id}")
    print(f"Query: {query}")
    
    try:
        # Check if user has personal memory
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        
        db = firestore.client()
        user_doc = db.collection('users').document(user_id).get()
        if user_doc.exists and 'agentEngineId' in user_doc.to_dict():
            print(f"User has Personal Memory (Engine ID: {user_doc.to_dict()['agentEngineId']})")
        else:
            print("User is using Global Memory (In-Memory)")
        
        # Test optional user_id by setting global context
        import python_service.momentum_agent as momentum_agent
        momentum_agent._current_user_id = user_id
        print(f"Set global _current_user_id to {user_id}")
        
        result = await recall_memory(query) # No user_id passed
        print(f"Result status: {result.get('status')}")
        
        memories = result.get('memories')
        if isinstance(memories, list) and len(memories) > 0:
            print(f"Found {len(memories)} memories:")
            for i, mem in enumerate(memories):
                print(f"  {i+1}. {mem.get('content')}")
                if query.lower() in mem.get('content', '').lower():
                    print("  => MATCH FOUND!")
        else:
            print(f"No memories found. Result: {memories}")
            
    except Exception as e:
        print(f"Error verifying memory: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python verify_memory.py <user_id> <query>")
        sys.exit(1)
    
    user_id = sys.argv[1]
    query = sys.argv[2]
    asyncio.run(verify_memory(user_id, query))
