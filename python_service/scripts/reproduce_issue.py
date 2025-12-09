import os
import logging
from dotenv import load_dotenv
from google.adk.memory import VertexAiMemoryBankService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path=dotenv_path)
    print(f"Loaded .env from {dotenv_path}")
else:
    print(f".env not found at {dotenv_path}")

# Simulate the fix logic
project_id = os.getenv('MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID') or os.getenv('MOMENTUM_GOOGLE_CLOUD_PROJECT')
location = os.getenv('MOMENTUM_AGENT_ENGINE_LOCATION')
agent_engine_id = "1257713758826921984" # From error message

print(f"Project ID (Fixed): {project_id}")
print(f"Location: {location}")
print(f"Agent Engine ID: {agent_engine_id}")

try:
    if not project_id:
        raise ValueError("Project ID is required for Vertex AI initialization.")
        
    print("Instantiating VertexAiMemoryBankService...")
    # This is just to check if it would fail with the project ID we found
    service = VertexAiMemoryBankService(
        project=project_id,
        location=location,
        agent_engine_id=agent_engine_id
    )
    print("Instantiation successful.")
    
except Exception as e:
    print(f"Error: {e}")
