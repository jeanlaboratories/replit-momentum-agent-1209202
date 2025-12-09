import google.adk.agents
import inspect

print("=== google.adk.agents classes ===")
for name, obj in inspect.getmembers(google.adk.agents):
    if inspect.isclass(obj):
        print(name)

try:
    import google.adk.agent_engine
    print("\n=== google.adk.agent_engine ===")
    print(dir(google.adk.agent_engine))
except ImportError:
    print("\nNo google.adk.agent_engine module")
