from google.adk.memory import VertexAiMemoryBankService, InMemoryMemoryService
import inspect

def print_methods(cls):
    print(f"\n=== {cls.__name__} methods ===")
    for name, func in inspect.getmembers(cls, predicate=inspect.isfunction):
        if not name.startswith('_'):
            print(f"{name}{inspect.signature(func)}")

print_methods(VertexAiMemoryBankService)
print_methods(InMemoryMemoryService)
