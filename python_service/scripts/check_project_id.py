import os
from dotenv import load_dotenv

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path=dotenv_path)
    print(f"Loaded .env from {dotenv_path}")
else:
    print(f".env not found at {dotenv_path}")

project_id = os.getenv('MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID')
agent_location = os.getenv('MOMENTUM_AGENT_ENGINE_LOCATION')

print(f"MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID: {project_id}")
print(f"MOMENTUM_AGENT_ENGINE_LOCATION: {agent_location}")
