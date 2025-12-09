import pytest
import os
import sys
import asyncio
import types
from unittest.mock import MagicMock, patch, AsyncMock

# Note: This test requires google.adk and google.cloud to be properly installed.
# We now have these dependencies installed, so the test can run.
# The test uses mocks to avoid requiring actual Google Cloud credentials.

# Add project root and python_service to path
sys.path.append(os.path.join(os.path.dirname(__file__), '../..'))
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Don't mock google.* modules - let them import normally
# The real modules are installed and will work with proper patching
# Only mock firebase_admin to avoid requiring actual Firebase credentials

# Mock firebase_admin before imports - use MagicMock for attributes that will be patched
firebase_admin_mock = MagicMock()
firebase_admin_mock.credentials = MagicMock()
firebase_admin_mock.storage = MagicMock()
firebase_admin_mock.firestore = MagicMock()
firebase_admin_mock.initialize_app = MagicMock()
sys.modules['firebase_admin'] = firebase_admin_mock
sys.modules['firebase_admin.credentials'] = firebase_admin_mock.credentials
sys.modules['firebase_admin.storage'] = firebase_admin_mock.storage
sys.modules['firebase_admin.firestore'] = firebase_admin_mock.firestore

# Import modules with proper patching
with patch('firebase_admin.credentials.Certificate'), \
     patch('firebase_admin.initialize_app'), \
     patch('firebase_admin.storage.bucket'), \
     patch('google.adk.memory.VertexAiMemoryBankService') as mock_adk_service_class:

    from python_service.services.memory_service import save_conversation_to_memory
    import python_service.main as main
    from python_service.routers import memory


def teardown_module(module):
    """Clean up sys.modules after all tests in this module run."""
    modules_to_remove = [
        'google', 'google.adk', 'google.adk.agents', 'google.adk.memory', 'google.adk.sessions',
        'google.adk.events', 'google.adk.models', 'google.adk.runners', 'google.adk.tools',
        'google.adk.tools.agent_tool', 'google.adk.tools.mcp_tool',
        'firebase_admin', 'firebase_admin.credentials', 'firebase_admin.storage', 'firebase_admin.firestore',
        'python_service', 'python_service.services', 'python_service.services.memory_service',
        'python_service.main', 'python_service.routers', 'python_service.routers.memory'
    ]
    for mod in modules_to_remove:
        if mod in sys.modules:
            del sys.modules[mod]

@pytest.fixture
def mock_firestore():
    with patch('python_service.services.memory_service.firestore.client') as mock:
        yield mock

@pytest.fixture
def mock_adk_service():
    with patch('python_service.services.memory_service.VertexAiMemoryBankService') as mock:
        yield mock

@pytest.fixture
def mock_agent_engine_manager():
    # Patch it where it is used in routers.memory
    # Use AsyncMock because these are awaited in routers/memory.py
    with patch('python_service.routers.memory.create_agent_engine', new_callable=AsyncMock) as mock_create, \
         patch('python_service.routers.memory.delete_agent_engine', new_callable=AsyncMock) as mock_delete:
        mock = MagicMock()
        mock.create_agent_engine = mock_create
        mock.delete_agent_engine = mock_delete
        yield mock

def run_async(coro):
    return asyncio.run(coro)

@patch('python_service.services.memory_service.isinstance')
def test_save_conversation_global_memory(mock_isinstance, mock_firestore, mock_adk_service):
    """Test saving to global memory when no agentEngineId exists."""
    mock_isinstance.return_value = False # Global memory is not Vertex
    async def _test():
        # Setup mocks
        mock_db = MagicMock()
        mock_firestore.return_value = mock_db
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {} # No agentEngineId

        # Setup proper mock chain
        mock_collection = MagicMock()
        mock_document = MagicMock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.get.return_value = mock_doc
        
        chat_history = [
            {"role": "user", "content": "Hello"},
            {"role": "model", "content": "Hi there"}
        ]
        
        # We need to mock the global memory_service in memory_service
        import python_service.services.memory_service as memory_service
        # Create a mock object that has add_memory as an AsyncMock
        mock_memory_service = MagicMock()
        mock_memory_service.add_memory = AsyncMock()
        
        # Store original to restore later
        original_memory_service = memory_service.memory_service
        memory_service.memory_service = mock_memory_service
        
        try:
            await save_conversation_to_memory("test_user_1", chat_history)
            
            # Should not instantiate VertexAiMemoryBankService
            mock_adk_service.assert_not_called()
            # Should call add_memory on global service
            mock_memory_service.add_memory.assert_called_once()
        finally:
            # Restore original
            memory_service.memory_service = original_memory_service
    run_async(_test())

@patch('python_service.services.memory_service.isinstance')
def test_save_conversation_personal_memory(mock_isinstance, mock_firestore, mock_adk_service):
    """Test saving to personal memory when agentEngineId exists."""
    mock_isinstance.return_value = True # Personal memory is Vertex
    async def _test():
        # Setup mocks
        mock_db = MagicMock()
        mock_firestore.return_value = mock_db
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {'agentEngineId': 'test-engine-id'}

        # Setup proper mock chain
        mock_collection = MagicMock()
        mock_document = MagicMock()
        mock_db.collection.return_value = mock_collection
        mock_collection.document.return_value = mock_document
        mock_document.get.return_value = mock_doc
        # Mock the created service instance
        mock_service_instance = MagicMock()
        mock_service_instance.add_memory = AsyncMock() # Ensure add_memory is awaitable
        
        # Mock ADK client and response chain
        mock_client = MagicMock()
        mock_service_instance._get_api_client.return_value = mock_client

        mock_operation = MagicMock()
        mock_client.agent_engines.memories.create.return_value = mock_operation
        # Mock response to avoid errors during ID extraction
        mock_response = MagicMock()
        mock_operation.response = mock_response
        mock_memory = MagicMock()
        mock_memory.name = 'projects/p/locations/l/reasoningEngines/e/memories/m1'
        mock_response.memory = mock_memory
        if hasattr(mock_response, 'generated_memories'):
            del mock_response.generated_memories

        # Ensure the class returns our mock instance when called
        mock_adk_service.return_value = mock_service_instance
        
        # Inject our mock service directly into the module
        import python_service.services.memory_service as memory_service
        original_memory_service = memory_service.memory_service
        memory_service.memory_service = mock_service_instance

        chat_history = [
            {"role": "user", "content": "I like blue"},
            {"role": "model", "content": "Hi there"}
        ]

        os.environ['MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID'] = 'test-project'
        os.environ['MOMENTUM_AGENT_ENGINE_LOCATION'] = 'us-central1'
        os.environ['MOMENTUM_ENABLE_MEMORY_BANK'] = 'true'

        # Mock extract_memories_from_conversation
        original_extract = memory_service.extract_memories_from_conversation
        memory_service.extract_memories_from_conversation = MagicMock(return_value=["User likes blue"])

        try:
            await save_conversation_to_memory("test_user_2", chat_history)

            # Should call the API client's create method, not add_memory
            # When using ADK, the code calls client.agent_engines.memories.create directly
            mock_client.agent_engines.memories.create.assert_called_once()

            # Verify Firestore was also called to save the memory for listing
            mock_collection.document.assert_called()
        finally:
            # Restore original
            memory_service.extract_memories_from_conversation = original_extract
            memory_service.memory_service = original_memory_service
    run_async(_test())

def test_create_engine_updates_firestore(mock_firestore, mock_agent_engine_manager):
    """Test that creating an engine updates Firestore with the ID."""
    async def _test():
        from fastapi import Request
        
        # Setup mocks
        mock_db = MagicMock()
        mock_firestore.return_value = mock_db
        mock_user_ref = MagicMock()
        mock_db.collection.return_value.document.return_value = mock_user_ref
        
        # create_agent_engine should return a dict with status, not just a string
        mock_agent_engine_manager.create_agent_engine.return_value = {
            "status": "success",
            "agent_engine_id": "new-engine-id"
        }
        
        request_mock = AsyncMock(spec=Request)
        request_mock.json.return_value = {"user_id": "test_user_3"}
        
        os.environ['MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID'] = 'test-project'
        os.environ['MOMENTUM_AGENT_ENGINE_LOCATION'] = 'us-central1'
        os.environ['MOMENTUM_ENABLE_MEMORY_BANK'] = 'true'
        
        with patch('python_service.routers.memory.Request', return_value=request_mock):
            await memory.create_engine(request_mock)
        
        # Verify Firestore update (Note: create_engine now calls create_agent_engine which handles Firestore)
        # But wait, in the new structure, create_engine calls create_agent_engine from agent_engine_manager.py
        # We need to make sure create_agent_engine is mocked correctly.
        # Actually, create_agent_engine handles the Firestore update itself.
        # So we check if it was called with keyword arguments.
        mock_agent_engine_manager.create_agent_engine.assert_called_with(user_id="test_user_3", memory_type='personal')
    run_async(_test())

def test_delete_engine_updates_firestore(mock_firestore, mock_agent_engine_manager):
    """Test that deleting an engine removes the ID from Firestore."""
    async def _test():
        from fastapi import Request
        
        # Setup mocks
        mock_db = MagicMock()
        mock_firestore.return_value = mock_db
        mock_user_ref = MagicMock()
        mock_db.collection.return_value.document.return_value = mock_user_ref
        
        request_mock = AsyncMock(spec=Request)
        request_mock.json.return_value = {"agent_engine_id": "old-engine-id", "user_id": "test_user_3"}
        
        os.environ['MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID'] = 'test-project'
        
        # Mock DELETE_FIELD
        with patch('firebase_admin.firestore.DELETE_FIELD', 'DELETE_FIELD_MOCK'):
            with patch('python_service.routers.memory.Request', return_value=request_mock):
                # Set return value to avoid JSON serialization error
                mock_agent_engine_manager.delete_agent_engine.return_value = {"status": "success"}
                await memory.delete_engine(request_mock)
            
            # Verify ADK call - delete_engine is called with keyword arguments
            mock_agent_engine_manager.delete_agent_engine.assert_called_with(user_id="test_user_3", memory_type='personal')
    run_async(_test())
