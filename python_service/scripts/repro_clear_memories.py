import asyncio
import httpx
import sys
import os

async def test_clear_memories():
    list_url = "http://127.0.0.1:8000/agent/memories/list"
    clear_url = "http://127.0.0.1:8000/agent/clear-memories"
    user_id = "test_user_repro" # You might need a real user ID if testing against real Firestore
    
    async with httpx.AsyncClient() as client:
        try:
            print(f"Testing list-memories for user: {user_id}")
            response = await client.post(list_url, json={"user_id": user_id})
            print(f"List Status Code: {response.status_code}")
            print(f"List Response: {response.json()}")
            
            print(f"Testing clear-memories for user: {user_id}")
            response = await client.post(clear_url, json={"user_id": user_id})
            print(f"Clear Status Code: {response.status_code}")
            print(f"Clear Response: {response.json()}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_clear_memories())
