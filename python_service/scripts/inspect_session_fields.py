from google.adk.sessions.session import Session

try:
    print("=== Session Fields ===")
    for name, field in Session.model_fields.items():
        print(f"{name}: {field.annotation}")
except Exception as e:
    print(f"Not a Pydantic model or error: {e}")
    print(dir(Session))
