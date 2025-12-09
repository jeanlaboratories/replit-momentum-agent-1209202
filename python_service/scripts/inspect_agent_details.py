from google.adk.agents import LlmAgent, BaseAgent, RunConfig, Agent
import inspect

print("=== LlmAgent ===")
print(inspect.signature(LlmAgent.__init__))
print(dir(LlmAgent))

print("\n=== BaseAgent ===")
print(inspect.signature(BaseAgent.__init__))
print(dir(BaseAgent))

print("\n=== RunConfig ===")
print(inspect.signature(RunConfig.__init__))
print(RunConfig.__doc__)

print("\n=== Agent (alias check) ===")
print(f"Agent is LlmAgent: {Agent is LlmAgent}")
