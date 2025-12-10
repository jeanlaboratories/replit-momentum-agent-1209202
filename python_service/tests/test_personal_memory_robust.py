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

# Mock vertexai before any imports that might use it
# This prevents the complex import chain from google.cloud.aiplatform
mock_vertexai = MagicMock()
mock_vertexai.__version__ = "1.129.0"
mock_vertexai.rag = MagicMock()
mock_vertexai.preview = MagicMock()
mock_vertexai.preview.rag = MagicMock()
sys.modules['vertexai'] = mock_vertexai
sys.modules['vertexai.rag'] = mock_vertexai.rag
sys.modules['vertexai.preview'] = mock_vertexai.preview
sys.modules['vertexai.preview.rag'] = mock_vertexai.preview.rag

# Mock google.cloud before ADK (simplified since vertexai is mocked)
if 'google' not in sys.modules:
    sys.modules['google'] = types.ModuleType('google')

if 'google.cloud' not in sys.modules:
    cloud_module = types.ModuleType('google.cloud')
    cloud_module.__path__ = []
    sys.modules['google.cloud'] = cloud_module

# Mock ADK before patching
def setup_adk_mocks():
    """Set up ADK mocks to prevent import errors."""
    if 'google.adk' not in sys.modules:
        adk_module = types.ModuleType('google.adk')
        adk_module.__path__ = []
        sys.modules['google.adk'] = adk_module
    
    adk_submodules = ['agents', 'memory', 'sessions', 'events', 'models', 'runners', 'tools']
    for submod in adk_submodules:
        mod_name = f'google.adk.{submod}'
        if mod_name not in sys.modules:
            submod_obj = types.ModuleType(mod_name)
            submod_obj.__path__ = []
            setattr(sys.modules['google.adk'], submod, submod_obj)
            sys.modules[mod_name] = submod_obj
    
    if 'google.adk.tools.agent_tool' not in sys.modules:
        agent_tool_obj = types.ModuleType('google.adk.tools.agent_tool')
        sys.modules['google.adk.tools.agent_tool'] = agent_tool_obj
    
    # Mock classes
    mock_vertex_ai_memory_bank_service = type('VertexAiMemoryBankService', (), {
        '__init__': lambda self, *args, **kwargs: None,
        '_get_api_client': lambda self: MagicMock(),
    })
    mock_vertex_ai_rag_memory_service = type('VertexAiRagMemoryService', (), {
        '__init__': lambda self, *args, **kwargs: None,
        '_get_api_client': lambda self: MagicMock(),
    })
    sys.modules['google.adk.memory'].VertexAiMemoryBankService = mock_vertex_ai_memory_bank_service
    sys.modules['google.adk.memory'].VertexAiRagMemoryService = mock_vertex_ai_rag_memory_service
    
    def mock_agent_init(self, *args, **kwargs):
        self.tools = kwargs.get('tools', [])
        self.instruction = kwargs.get('instruction', '')
        self.model = kwargs.get('model', 'gemini-2.0-flash')
    mock_agent = type('Agent', (), {'__init__': mock_agent_init})
    mock_llm_agent = type('LlmAgent', (), {'__init__': mock_agent_init})
    sys.modules['google.adk.agents'].Agent = mock_agent
    sys.modules['google.adk.agents'].LlmAgent = mock_llm_agent
    
    def mock_runner_init(self, *args, **kwargs):
        pass
    mock_runner = type('Runner', (), {'__init__': mock_runner_init})
    sys.modules['google.adk.runners'].Runner = mock_runner
    
    def mock_agent_tool_init(self, *args, **kwargs):
        pass
    mock_agent_tool = type('AgentTool', (), {'__init__': mock_agent_tool_init})
    sys.modules['google.adk.tools'].AgentTool = mock_agent_tool
    sys.modules['google.adk.tools.agent_tool'].AgentTool = mock_agent_tool
    
    mock_google_search = MagicMock()
    sys.modules['google.adk.tools'].google_search = mock_google_search
    
    def mock_session_service_init(self, *args, **kwargs):
        pass
    mock_session_service = type('SessionService', (), {'__init__': mock_session_service_init})
    mock_inmemory_session_service = type('InMemorySessionService', (), {'__init__': mock_session_service_init})
    sys.modules['google.adk.sessions'].SessionService = mock_session_service
    sys.modules['google.adk.sessions'].InMemorySessionService = mock_inmemory_session_service

setup_adk_mocks()

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
        
        # Mock vertexai.Client (new approach matching ADK notebook)
        # vertexai is imported inside the function, so we need to mock it in sys.modules
        mock_vertexai_client = MagicMock()
        mock_agent_engines = MagicMock()
        mock_memories = MagicMock()
        mock_vertexai_client.agent_engines = mock_agent_engines
        mock_agent_engines.memories = mock_memories
        
        mock_operation = MagicMock()
        mock_memories.generate.return_value = mock_operation
        # Mock response to avoid errors during ID extraction
        mock_operation.name = 'projects/p/locations/l/reasoningEngines/e/memories/m1'

        # Create mock vertexai module and inject into sys.modules
        # This works because vertexai is imported inside the function
        mock_vertexai_module = MagicMock()
        mock_vertexai_module.Client.return_value = mock_vertexai_client
        mock_vertexai_module.init = MagicMock()
        
        # Store original if it exists
        original_vertexai = sys.modules.get('vertexai')
        sys.modules['vertexai'] = mock_vertexai_module
        
        try:
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

            await save_conversation_to_memory("test_user_2", chat_history)

            # Should call vertexai.Client().agent_engines.memories.generate() (new approach)
            mock_vertexai_module.Client.assert_called_once_with(project='test-project', location='us-central1')
            mock_vertexai_module.init.assert_called_once_with(project='test-project', location='us-central1')
            mock_memories.generate.assert_called_once()

            # Verify Firestore was also called to save the memory for listing
            mock_collection.document.assert_called()
        finally:
            # Restore original
            if original_vertexai:
                sys.modules['vertexai'] = original_vertexai
            elif 'vertexai' in sys.modules:
                del sys.modules['vertexai']
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
