import requests
import json
import sys

def test_streaming():
    url = "http://127.0.0.1:8000/agent/chat"
    payload = {
        "message": "Generate a creative image of a futuristic city",
        "session_id": "test_session",
        "brand_id": "test_brand",
        "user_id": "test_user"
    }
    
    print(f"Testing streaming endpoint: {url}")
    
    try:
        with requests.post(url, json=payload, stream=True) as response:
            if response.status_code != 200:
                print(f"Error: {response.status_code}")
                print(response.text)
                return
            
            print("Response headers:", response.headers)
            
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    print(f"Received chunk: {decoded_line}")
                    try:
                        data = json.loads(decoded_line)
                        if data.get('type') == 'log':
                            print(f"LOG: {data.get('content')}")
                        elif data.get('type') == 'image':
                            print("IMAGE RECEIVED")
                        elif data.get('type') == 'final_response':
                            print(f"FINAL RESPONSE: {data.get('content')}")
                    except json.JSONDecodeError:
                        print("Failed to decode JSON chunk")

    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_streaming()
