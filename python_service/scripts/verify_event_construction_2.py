from google.adk.events.event import Event
from google.genai.types import Content, Part

try:
    # Try with Content object
    content = Content(parts=[Part(text="Hello world")])
    event = Event(author="user", content=content)
    print(f"Success 1: {event}")
except Exception as e:
    print(f"Failure 1: {e}")

try:
    # Try with dict
    event = Event(author="user", content={"role": "user", "parts": [{"text": "Hello world"}]})
    print(f"Success 2: {event}")
except Exception as e:
    print(f"Failure 2: {e}")
