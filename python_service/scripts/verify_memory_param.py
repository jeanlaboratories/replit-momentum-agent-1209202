from google.adk.agents import Agent
from google.adk.memory import InMemoryMemoryService

try:
    memory = InMemoryMemoryService()
    agent = Agent(
        model='gemini-2.0-flash',
        name='test_agent',
        memory=memory
    )
    print("SUCCESS: Agent accepted memory parameter")
except Exception as e:
    print(f"FAILURE: Agent rejected memory parameter: {e}")
