from google.adk.events.event import Event

try:
    print("=== Event Fields ===")
    for name, field in Event.model_fields.items():
        print(f"{name}: {field.annotation}")
except Exception as e:
    print(f"Not a Pydantic model or error: {e}")
    print(dir(Event))
