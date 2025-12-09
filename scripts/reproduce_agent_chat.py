import requests
import json

url = "http://127.0.0.1:8000/agent/chat"
payload = {
    "message": "What is the latest news about Google Gemini?",
    "session_id": "test_session",
    "user_id": "test_user",
    "brand_id": "test_brand"
}
headers = {
    "Content-Type": "application/json"
}

try:
    response = requests.post(url, json=payload, headers=headers, stream=True)
    print(f"Status Code: {response.status_code}")
    print("Response:")
    for line in response.iter_lines():
        if line:
            print(line.decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
