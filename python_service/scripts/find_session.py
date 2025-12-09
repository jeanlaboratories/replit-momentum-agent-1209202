import google.adk
import pkgutil
import inspect
import importlib

def find_class(package, class_name):
    path = package.__path__
    prefix = package.__name__ + "."

    for _, name, ispkg in pkgutil.walk_packages(path, prefix):
        try:
            module = importlib.import_module(name)
            if hasattr(module, class_name):
                return getattr(module, class_name)
        except ImportError:
            continue
    return None

Session = find_class(google.adk, 'Session')
if Session:
    print(f"Found Session in {Session.__module__}")
    print(inspect.signature(Session.__init__))
    print(Session.__doc__)
else:
    print("Session class not found in google.adk")
