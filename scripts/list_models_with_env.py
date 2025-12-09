import os
from google.genai import Client
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv('MOMENTUM_GOOGLE_API_KEY')
if not api_key:
    print("MOMENTUM_GOOGLE_API_KEY not set")
    exit(1)

client = Client(api_key=api_key)

print("Available models:")
try:
    for model in client.models.list():
        print(f"- {model.name}")
except Exception as e:
    print(f"Error listing models: {e}")
