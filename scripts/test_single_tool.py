#!/usr/bin/env python3
"""Test a single tool with detailed response inspection"""

import requests
import json

# Test domain suggestions tool
payload = {
    "message": "Suggest 5 creative domain names for a sports team called Lightning FC",
    "session_id": "test_detailed",
    "team_context": {
        "teamName": "Lightning FC",
        "teamType": "sports",
        "focus": "soccer"
    }
}

print("=" * 70)
print("DETAILED TOOL TEST - Domain Suggestions")
print("=" * 70)
print(f"\nPrompt: {payload['message']}")
print("\nSending request to agent...")

response = requests.post(
    "http://127.0.0.1:8000/agent/chat",
    json=payload,
    timeout=30
)

print(f"\nStatus Code: {response.status_code}")

if response.status_code == 200:
    result = response.json()
    print("\n" + "=" * 70)
    print("FULL RESPONSE:")
    print("=" * 70)
    print(json.dumps(result, indent=2))
    print("\n" + "=" * 70)
    print("RESPONSE TEXT:")
    print("=" * 70)
    print(result.get('response', 'No response text'))
else:
    print(f"\nError: {response.text}")
