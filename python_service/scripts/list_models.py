import os
from google.genai import Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

api_key = os.environ.get("MOMENTUM_GOOGLE_API_KEY")
if not api_key:
    print("MOMENTUM_GOOGLE_API_KEY not set")
    exit(1)

client = Client(api_key=api_key)

print("Listing models...")
try:
    # The SDK might not have a direct list() method on models, checking docs or trying common pattern
    for model in client.models.list(config={'page_size': 100}):
        if 'veo' in model.name:
            print(f"Model: {model.name}")
except Exception as e:
    print(f"Error listing models: {e}")
