"""
Global pytest configuration for test isolation and proper cleanup.
"""

import sys
import pytest
from typing import Dict, Any


@pytest.fixture(autouse=True)
def clean_module_imports(request):
    """
    Fixture to clean up module imports between tests to prevent test isolation issues.
    This runs automatically for every test.
    """
    # Store original sys.modules state
    original_modules = sys.modules.copy()
    
    # Special handling for vision analysis endpoint tests
    if 'test_vision_analysis_endpoints.py' in str(request.fspath):
        # Reset Firebase module mocks specifically for these tests
        if hasattr(sys.modules.get('tests.test_vision_analysis_endpoints'), 'mock_firestore'):
            try:
                from tests.test_vision_analysis_endpoints import mock_firestore
                mock_firestore.reset_mock()
            except:
                pass
    
    yield  # Run the test
    
    # Clean up any modules that were added during the test
    modules_to_remove = []
    for module_name in sys.modules:
        if module_name not in original_modules:
            # Only remove test-related modules, not system ones
            if (module_name.startswith('google.') or 
                module_name.startswith('firebase_') or 
                module_name.startswith('tests.')):
                modules_to_remove.append(module_name)
    
    for module_name in modules_to_remove:
        if module_name in sys.modules:
            del sys.modules[module_name]


@pytest.fixture(autouse=True)
def isolate_mocks():
    """
    Fixture to ensure mock isolation between test modules.
    This runs automatically for every test module.
    """
    # Store original sys.modules for Google/Firebase related modules
    google_modules = {}
    firebase_modules = {}
    
    for name, module in sys.modules.copy().items():
        if name.startswith('google.'):
            google_modules[name] = module
        elif name.startswith('firebase_'):
            firebase_modules[name] = module
    
    yield  # Run the test
    
    # Restore original modules if they were replaced by mocks
    for name, original_module in google_modules.items():
        if name in sys.modules and sys.modules[name] != original_module:
            sys.modules[name] = original_module
            
    for name, original_module in firebase_modules.items():
        if name in sys.modules and sys.modules[name] != original_module:
            sys.modules[name] = original_module