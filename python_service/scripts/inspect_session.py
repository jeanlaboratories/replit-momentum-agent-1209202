import google.adk.types
import inspect

# Try to find Session in types or agents
try:
    from google.adk.types import Session
    print("=== google.adk.types.Session ===")
    print(inspect.signature(Session.__init__))
    print(Session.__doc__)
except ImportError:
    print("Session not found in google.adk.types")
    # Try to find where Session is defined
    print("Searching for Session in google.adk...")
    import google.adk
    for name, obj in inspect.getmembers(google.adk):
        if name == 'Session':
            print(f"Found Session in google.adk: {obj}")

