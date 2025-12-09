from google.adk.memory import VertexAiMemoryBankService, InMemoryMemoryService
import inspect

print("=== VertexAiMemoryBankService ===")
print(inspect.signature(VertexAiMemoryBankService.__init__))
print(VertexAiMemoryBankService.__doc__)

print("\n=== InMemoryMemoryService ===")
print(inspect.signature(InMemoryMemoryService.__init__))
print(InMemoryMemoryService.__doc__)
