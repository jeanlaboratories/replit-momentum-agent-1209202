import asyncio
import sys
import os
import uuid

# Add project root and python_service to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
sys.path.append(os.path.join(os.path.dirname(__file__), '.'))

from python_service.momentum_agent import save_conversation_to_memory
import firebase_admin
from firebase_admin import firestore

async def verify_save(user_id):
    print(f"Attempting to save memory for user: {user_id}")
    
    try:
        # Check if user has personal memory
        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        
        db = firestore.client()
        user_doc = db.collection('users').document(user_id).get()
        if user_doc.exists and 'agentEngineId' in user_doc.to_dict():
            print(f"User has Personal Memory (Engine ID: {user_doc.to_dict()['agentEngineId']})")
        else:
            print("User is using Global Memory (In-Memory). Cannot test ADK saving.")
            return
        
        chat_history = [
            {"role": "user", "content": "I love testing new features."},
            {"role": "model", "content": "That is great to hear! Testing is important."}
        ]
        
        print("Calling save_conversation_to_memory...")
        await save_conversation_to_memory(user_id, chat_history)
        print("Call completed. Check server logs for details on which method was used.")
            
    except Exception as e:
        print(f"Error verifying memory save: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python verify_save.py <user_id>")
        sys.exit(1)
    
    user_id = sys.argv[1]
    asyncio.run(verify_save(user_id))
