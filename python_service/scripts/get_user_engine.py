import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Load environment variables
load_dotenv()

def get_user_engine():
    # Initialize Firebase Admin if not already
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {
            'projectId': os.getenv('MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
        })
    
    db = firestore.client()
    
    # List all users and their engine IDs
    users = db.collection('users').stream()
    print("Users and Agent Engines:")
    for user in users:
        data = user.to_dict()
        print(f"User: {user.id}")
        print(f"  Agent Engine ID: {data.get('agentEngineId')}")
        print(f"  Agent Engine Name: {data.get('agentEngineName')}")
        print("-" * 20)

if __name__ == "__main__":
    get_user_engine()
