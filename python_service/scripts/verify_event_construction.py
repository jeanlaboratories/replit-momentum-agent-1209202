from google.adk.events.event import Event

try:
    # Try simple construction
    event = Event(author="user", content="Hello world")
    print(f"Success 1: {event}")
except Exception as e:
    print(f"Failure 1: {e}")

try:
    # Try with parts
    from google.genai.types import Part
    event = Event(author="user", parts=[Part(text="Hello world")])
    print(f"Success 2: {event}")
except Exception as e:
    print(f"Failure 2: {e}")
