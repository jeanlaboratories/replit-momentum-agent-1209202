import os
from google.genai import Client

api_key = os.getenv('MOMENTUM_GOOGLE_API_KEY')
if not api_key:
    print("MOMENTUM_GOOGLE_API_KEY not set")
    exit(1)

client = Client(api_key=api_key)

print("Available models:")
for model in client.models.list():
    print(f"- {model.name} (Supported methods: {model.supported_generation_methods})")
