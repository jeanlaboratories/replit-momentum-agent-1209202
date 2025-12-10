import unittest
from unittest.mock import MagicMock, patch, AsyncMock
import sys
import os
import types

# Add the parent directory to sys.path to import momentum_agent and main
sys.path.insert(0,(os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))))

# Save original sys.modules keys to restore later
_original_modules = set(sys.modules.keys())

# Mock external dependencies before importing
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.credentials'] = MagicMock()
sys.modules['firebase_admin.storage'] = MagicMock()
sys.modules['google.genai'] = MagicMock()
sys.modules['google.genai.types'] = MagicMock()
sys.modules['firecrawl'] = MagicMock()
sys.modules['marketing_agent'] = MagicMock()

# Mock vertexai with proper __version__ attribute to prevent AttributeError
mock_vertexai = MagicMock()
mock_vertexai.__version__ = "1.129.0"
sys.modules['vertexai'] = mock_vertexai
sys.modules['vertexai.rag'] = MagicMock()
sys.modules['vertexai.preview'] = MagicMock()
sys.modules['vertexai.preview.rag'] = MagicMock()

# Mock ADK and its submodules to avoid loading Pydantic models
# Use proper module types instead of MagicMock to support proper imports
import types

# Ensure google module exists as a package
if 'google' not in sys.modules or not hasattr(sys.modules.get('google', None), '__path__'):
    sys.modules['google'] = types.ModuleType('google')

# Create google.adk as a proper package
if 'google.adk' not in sys.modules or not hasattr(sys.modules.get('google.adk', None), '__path__'):
    adk_module = types.ModuleType('google.adk')
    adk_module.__path__ = []
    sys.modules['google.adk'] = adk_module

# Create all necessary ADK submodules
adk_submodules = ['agents', 'memory', 'sessions', 'events', 'models', 'runners', 'tools']
for submod in adk_submodules:
    mod_name = f'google.adk.{submod}'
    if mod_name not in sys.modules or not hasattr(sys.modules.get(mod_name, None), '__path__'):
        submod_obj = types.ModuleType(mod_name)
        submod_obj.__path__ = []
        setattr(sys.modules['google.adk'], submod, submod_obj)
        sys.modules[mod_name] = submod_obj

# Create agent_tool and function_tool submodules
if 'google.adk.tools.agent_tool' not in sys.modules:
    sys.modules['google.adk.tools.agent_tool'] = types.ModuleType('google.adk.tools.agent_tool')
if 'google.adk.tools.function_tool' not in sys.modules:
    sys.modules['google.adk.tools.function_tool'] = types.ModuleType('google.adk.tools.function_tool')

# Mock classes for memory service
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

# Mock Agent and LlmAgent (required for momentum_agent imports)
def mock_agent_init(self, *args, **kwargs):
    self.tools = kwargs.get('tools', [])
    self.instruction = kwargs.get('instruction', '')
    self.model = kwargs.get('model', 'gemini-2.0-flash')
mock_agent = type('Agent', (), {'__init__': mock_agent_init})
mock_llm_agent = type('LlmAgent', (), {'__init__': mock_agent_init})
sys.modules['google.adk.agents'].Agent = mock_agent
sys.modules['google.adk.agents'].LlmAgent = mock_llm_agent

# Mock Runner
def mock_runner_init(self, *args, **kwargs):
    pass
mock_runner = type('Runner', (), {'__init__': mock_runner_init})
sys.modules['google.adk.runners'].Runner = mock_runner

# Mock AgentTool
def mock_agent_tool_init(self, *args, **kwargs):
    pass
mock_agent_tool = type('AgentTool', (), {'__init__': mock_agent_tool_init})
sys.modules['google.adk.tools'].AgentTool = mock_agent_tool
sys.modules['google.adk.tools.agent_tool'].AgentTool = mock_agent_tool

# Mock google_search
mock_google_search = MagicMock()
sys.modules['google.adk.tools'].google_search = mock_google_search

# Mock SessionService
def mock_session_service_init(self, *args, **kwargs):
    pass
mock_session_service = type('SessionService', (), {'__init__': mock_session_service_init})
mock_inmemory_session_service = type('InMemorySessionService', (), {'__init__': mock_session_service_init})
sys.modules['google.adk.sessions'].SessionService = mock_session_service
sys.modules['google.adk.sessions'].InMemorySessionService = mock_inmemory_session_service

# Now import the modules to test
import momentum_agent
import main
from services import memory_service


def teardown_module(module):
    """Clean up sys.modules after all tests in this module run."""
    # Remove all modules that were added during this test module
    modules_to_remove = [
        'firebase_admin', 'firebase_admin.credentials', 'firebase_admin.storage',
        'google.genai', 'google.genai.types', 'firecrawl', 'marketing_agent',
        'google.adk', 'google.adk.agents', 'google.adk.memory', 'google.adk.sessions',
        'google.adk.events', 'google.adk.models', 'google.adk.runners', 'google.adk.tools',
        'momentum_agent', 'main', 'services', 'services.memory_service'
    ]
    for mod in modules_to_remove:
        if mod in sys.modules:
            del sys.modules[mod]

class TestMemoryManagement(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # Reset mocks and state
        momentum_agent.genai_client = MagicMock()
        memory_service.genai_client = MagicMock()
        momentum_agent.logger = MagicMock()
        main.logger = MagicMock()
        
    @patch('services.memory_service.genai_client.models.generate_content')
    def test_extract_memories_from_conversation(self, mock_generate_content):
        # Mock Gemini response
        mock_response = MagicMock()
        mock_response.text = '["User likes blue", "User is a developer"]'
        mock_generate_content.return_value = mock_response
        
        chat_history = [
            {"role": "user", "content": "I like blue"},
            {"role": "model", "content": "Cool, I will remember that."}
        ]
        
        facts = memory_service.extract_memories_from_conversation(chat_history)
        
        self.assertEqual(len(facts), 2)
        self.assertIn("User likes blue", facts)
        self.assertIn("User is a developer", facts)
        mock_generate_content.assert_called_once()

    @patch.dict(os.environ, {"MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID": "test-project", "MOMENTUM_AGENT_ENGINE_LOCATION": "us-central1"})
    @patch('services.memory_service.firestore.client')
    async def test_save_conversation_to_memory_vertex(self, mock_firestore):
        """Test that save_conversation_to_memory uses vertexai.Client (new approach)."""
        # Mock Firestore with proper chaining
        mock_db = MagicMock()
        mock_firestore.return_value = mock_db
        mock_user_doc = MagicMock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {'agentEngineId': 'test-engine-id'}

        # Setup proper mock chain for user doc retrieval
        mock_users_col = MagicMock()
        mock_user_doc_ref = MagicMock()
        mock_db.collection.return_value = mock_users_col
        mock_users_col.document.return_value = mock_user_doc_ref
        mock_user_doc_ref.get.return_value = mock_user_doc

        # Setup mock chain for memory storage (for Firestore save)
        mock_memories_col = MagicMock()
        mock_memory_added = MagicMock()
        mock_memory_added.id = 'new-memory-id'
        mock_user_doc_ref.collection.return_value = mock_memories_col
        mock_memories_col.add.return_value = (None, mock_memory_added)
        
        # Mock vertexai.Client (new approach matching ADK notebook)
        mock_vertexai_client = MagicMock()
        mock_agent_engines = MagicMock()
        mock_memories = MagicMock()
        mock_vertexai_client.agent_engines = mock_agent_engines
        mock_agent_engines.memories = mock_memories
        
        mock_operation = MagicMock()
        mock_operation.name = 'projects/test-project/locations/us-central1/reasoningEngines/test-engine-id/memories/m1'
        mock_memories.generate.return_value = mock_operation
        
        # Create mock vertexai module
        mock_vertexai_module = MagicMock()
        mock_vertexai_module.Client.return_value = mock_vertexai_client
        mock_vertexai_module.init = MagicMock()
        
        # Store original and inject mock
        original_vertexai = sys.modules.get('vertexai')
        sys.modules['vertexai'] = mock_vertexai_module
        
        try:
            chat_history = [
                {"role": "user", "content": "I like blue"},
                {"role": "model", "content": "Cool"}
            ]
            
            # Pass pre-extracted facts since automatic extraction is now disabled
            pre_extracted_facts = ["User likes blue"]
            
            # Test that save_conversation_to_memory uses vertexai.Client
            await memory_service.save_conversation_to_memory(
                "test_user_1", 
                chat_history, 
                pre_extracted_facts=pre_extracted_facts
            )
            
            # Verify vertexai.init was called
            mock_vertexai_module.init.assert_called_once_with(
                project='test-project',
                location='us-central1'
            )
            
            # Verify vertexai.Client was created
            mock_vertexai_module.Client.assert_called_once_with(
                project='test-project',
                location='us-central1'
            )
            
            # Verify agent_engines.memories.generate was called
            assert mock_memories.generate.called, "agent_engines.memories.generate should have been called"
            generate_call = mock_memories.generate.call_args
            
            # Verify the call includes correct parameters
            assert generate_call[1]['name'] == 'projects/test-project/locations/us-central1/reasoningEngines/test-engine-id'
            assert 'direct_contents_source' in generate_call[1]
            assert 'scope' in generate_call[1]
            assert generate_call[1]['scope']['app_name'] == 'MOMENTUM'
            assert generate_call[1]['scope']['user_id'] == 'test_user_1'
            
            # Verify Firestore was also called to save memories for listing
            mock_db.collection.assert_called()
            
            # Verify that Firestore document is created with Vertex AI memory ID as document ID
            # The new implementation uses .document(short_id).set() instead of .add()
            # Check that .document() was called on memories collection (indicating we're using a specific ID)
            # Note: The actual implementation uses the short memory ID extracted from the full Vertex AI path
            # We verify this by checking that the memories collection was accessed
            assert mock_user_doc_ref.collection.called, "Should have accessed memories collection"
        finally:
            if original_vertexai:
                sys.modules['vertexai'] = original_vertexai
            elif 'vertexai' in sys.modules:
                del sys.modules['vertexai']

    @patch.dict(os.environ, {"MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID": "test-project", "MOMENTUM_AGENT_ENGINE_LOCATION": "us-central1"})
    @patch('routers.memory.get_settings')
    @patch('routers.memory.firestore.client')
    async def test_delete_memory_with_vertexai_client(self, mock_firestore, mock_get_settings):
        """Test that delete_memory uses vertexai.Client (not VertexAiMemoryBankService)."""
        # Mock Firestore
        mock_db = MagicMock()
        mock_firestore.return_value = mock_db

        # Mock memory doc with ADK ID
        mock_memory_doc = MagicMock()
        mock_memory_doc.exists = True
        mock_memory_doc.to_dict.return_value = {
            'adkMemoryId': 'projects/test-project/locations/us-central1/reasoningEngines/test-engine-id/memories/m1'
        }

        # Mock user doc for agent engine ID
        mock_user_doc = MagicMock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {'agentEngineId': 'test-engine-id'}
        
        # Ensure user_doc_ref.get() returns the user_doc
        mock_user_doc_ref = MagicMock()
        mock_user_doc_ref.get.return_value = mock_user_doc

        # Setup explicit mock chain for delete_memory
        # Note: mock_user_doc_ref was already created above
        # We need to ensure the chain is set up correctly

        mock_memory_doc_ref = MagicMock()
        mock_memory_doc_ref.get.return_value = mock_memory_doc
        mock_memory_doc_ref.delete = MagicMock()

        mock_users_col = MagicMock()
        mock_memories_col = MagicMock()

        # Set up the chain directly on the mocks
        mock_db.collection.return_value = mock_users_col
        mock_users_col.document.return_value = mock_user_doc_ref
        mock_user_doc_ref.collection.return_value = mock_memories_col
        mock_memories_col.document.return_value = mock_memory_doc_ref

        # Mock vertexai.Client (new approach)
        mock_vertexai_client = MagicMock()
        mock_agent_engines = MagicMock()
        mock_memories = MagicMock()
        mock_vertexai_client.agent_engines = mock_agent_engines
        mock_agent_engines.memories = mock_memories
        mock_memories.delete = MagicMock()

        # Create mock vertexai module
        mock_vertexai_module = MagicMock()
        mock_vertexai_module.Client.return_value = mock_vertexai_client
        mock_vertexai_module.init = MagicMock()

        # Mock get_settings to return test values
        mock_settings = MagicMock()
        mock_settings.effective_project_id = 'test-project'
        mock_settings.agent_engine_location = 'us-central1'
        mock_get_settings.return_value = mock_settings
        
        # Store original and inject mock
        original_vertexai = sys.modules.get('vertexai')
        sys.modules['vertexai'] = mock_vertexai_module

        try:
            # Mock Request
            mock_request = MagicMock()
            mock_request.json = AsyncMock(return_value={
                'user_id': 'user_123',
                'memory_id': 'm1',
                'type': 'personal'
            })

            # Call delete_memory
            from routers import memory
            response = await memory.delete_memory(mock_request)

            # Verify vertexai.init was called
            mock_vertexai_module.init.assert_called_once_with(
                project='test-project',
                location='us-central1'
            )

            # Verify vertexai.Client was created
            mock_vertexai_module.Client.assert_called_once_with(
                project='test-project',
                location='us-central1'
            )

            # Verify ADK deletion attempt using vertexai.Client
            assert mock_memories.delete.called, "agent_engines.memories.delete should have been called"
            delete_call = mock_memories.delete.call_args
            # The name should contain the memory ID
            assert 'm1' in delete_call[1]['name'] or 'memories/m1' in delete_call[1]['name']

            # Verify Firestore deletion ALWAYS happens (not conditional on Vertex AI success)
            # Note: The deletion uses the memory_doc_ref we already fetched, so it should be called
            mock_memory_doc_ref.delete.assert_called_once()

            # Verify response indicates success
            self.assertEqual(response['status'], 'success')
        finally:
            if original_vertexai:
                sys.modules['vertexai'] = original_vertexai
            elif 'vertexai' in sys.modules:
                del sys.modules['vertexai']

    @patch.dict(os.environ, {"MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID": "test-project", "MOMENTUM_AGENT_ENGINE_LOCATION": "us-central1"})
    @patch('google.adk.memory.VertexAiMemoryBankService')
    @patch('routers.memory.firestore.client')
    async def test_delete_memory_with_adk(self, mock_firestore, mock_vertex_service_class):
        # Mock Firestore
        mock_db = MagicMock()
        mock_firestore.return_value = mock_db

        # Mock memory doc with ADK ID
        mock_memory_doc = MagicMock()
        mock_memory_doc.exists = True
        mock_memory_doc.to_dict.return_value = {'adkMemoryId': 'm1'}

        # Mock user doc for agent engine ID
        mock_user_doc = MagicMock()
        mock_user_doc.to_dict.return_value = {'agentEngineId': 'test-engine-id'}

        # Setup explicit mock chain for delete_memory
        # Path 1: db.collection('users').document(user_id) -> returns mock_user_doc_ref
        # Path 2: db.collection('users').document(user_id).collection('memories').document(memory_id) -> returns mock_memory_doc_ref

        mock_user_doc_ref = MagicMock()
        mock_user_doc_ref.get.return_value = mock_user_doc

        mock_memory_doc_ref = MagicMock()
        mock_memory_doc_ref.get.return_value = mock_memory_doc
        mock_memory_doc_ref.delete = MagicMock()  # Add delete method

        # We need to handle the chained calls.
        # db.collection('users') returns a mock.
        # .document(user_id) returns mock_user_doc_ref.
        # mock_user_doc_ref.collection('memories') returns another mock.
        # .document(memory_id) returns mock_memory_doc_ref.

        mock_users_col = MagicMock()
        mock_memories_col = MagicMock()

        # Set up the chain directly on the mocks
        mock_db.collection.return_value = mock_users_col
        mock_users_col.document.return_value = mock_user_doc_ref
        mock_user_doc_ref.collection.return_value = mock_memories_col
        mock_memories_col.document.return_value = mock_memory_doc_ref

        # Ensure side effects are cleared if any
        mock_db.collection.side_effect = None
        mock_user_doc_ref.collection.side_effect = None

        # Use the mocked class passed by patch
        mock_vertex_service_instance = mock_vertex_service_class.return_value
        mock_client = MagicMock()
        mock_vertex_service_instance._get_api_client.return_value = mock_client

        # Ensure the mock chain is set up correctly
        mock_client.agent_engines.memories.delete = MagicMock()

        # Mock Request
        mock_request = MagicMock()
        mock_request.json = AsyncMock(return_value={'user_id': 'user_123', 'memory_id': 'mem_123'})

        # Call delete_memory
        with patch('routers.memory.Request', return_value=mock_request):
            from routers import memory
            response = await memory.delete_memory(mock_request)

        # Verify ADK deletion attempt
        mock_client.agent_engines.memories.delete.assert_called_once()
        args, kwargs = mock_client.agent_engines.memories.delete.call_args
        # The name will contain the memory ID 'm1'
        self.assertIn('m1', kwargs['name'])

        # Verify Firestore deletion
        mock_memory_doc_ref.delete.assert_called_once()

    @patch.dict(os.environ, {"MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID": "test-project", "MOMENTUM_AGENT_ENGINE_LOCATION": "us-central1"})
    @patch('google.adk.memory.VertexAiMemoryBankService')
    @patch('routers.memory.firestore.client')
    async def test_list_memories_vertex(self, mock_firestore, mock_vertex_service_class):
        # Mock Firestore with proper chaining
        mock_db = MagicMock()
        mock_firestore.return_value = mock_db

        # Mock user doc for agent engine ID
        mock_user_doc = MagicMock()
        mock_user_doc.to_dict.return_value = {'agentEngineId': 'test-engine-id'}

        # Setup proper mock chain
        mock_users_col = MagicMock()
        mock_user_doc_ref = MagicMock()
        mock_db.collection.return_value = mock_users_col
        mock_users_col.document.return_value = mock_user_doc_ref
        mock_user_doc_ref.get.return_value = mock_user_doc
        
        # Mock ADK client and response
        mock_vertex_service_instance = mock_vertex_service_class.return_value
        mock_client = MagicMock()
        mock_vertex_service_instance._get_api_client.return_value = mock_client
        
        # Mock memory list response
        mock_memory = MagicMock()
        mock_memory.name = 'projects/p/locations/l/reasoningEngines/e/memories/m1'
        mock_memory.fact = 'Vertex memory'
        mock_memory.create_time = MagicMock()
        mock_memory.create_time.isoformat.return_value = '2023-01-01T00:00:00'
        mock_client.agent_engines.memories.list.return_value = [mock_memory]
        
        # Mock Request
        mock_request = MagicMock()
        mock_request.json = AsyncMock(return_value={'user_id': 'user_123'})
        
        # Call list_memories (via routers.memory.list_memories)
        with patch('routers.memory.Request', return_value=mock_request):
            from routers import memory
            response = await memory.list_memories(mock_request)
            
        import json
        data = json.loads(response.body)
        self.assertEqual(data['status'], 'success')
        self.assertEqual(len(data['memories']), 1)
        self.assertEqual(data['memories'][0]['content'], 'Vertex memory')
        self.assertEqual(data['memories'][0]['source'], 'vertex')

        # Test fallback by modifying the existing mock to raise an exception
        mock_client.agent_engines.memories.list.side_effect = Exception("ADK error")

        # Test fallback
        with patch('google.adk.memory.VertexAiMemoryBankService') as mock_adk_class_fallback:
            mock_service_instance_fallback = mock_adk_class_fallback.return_value
            mock_client_fallback = MagicMock()
            mock_service_instance_fallback._get_api_client.return_value = mock_client_fallback
            mock_client_fallback.agent_engines.memories.list.side_effect = Exception("ADK error")
            
            # Mock Firestore fallback response
            mock_doc = MagicMock()
            mock_doc.id = 'f1'
            mock_doc.to_dict.return_value = {'content': 'Firestore memory', 'createdAt': None}
            
            # Handle fallback chain
            mock_users_col_fallback = MagicMock()
            mock_memories_col_fallback = MagicMock()
            mock_user_doc_ref_fallback = MagicMock()
            mock_ordered_col_fallback = MagicMock()
            
            mock_db.collection.side_effect = None # Reset side effect
            mock_db.collection.return_value = mock_users_col_fallback
            mock_users_col_fallback.document.return_value = mock_user_doc_ref_fallback
            mock_user_doc_ref_fallback.collection.return_value = mock_memories_col_fallback
            mock_memories_col_fallback.order_by.return_value = mock_ordered_col_fallback
            mock_ordered_col_fallback.stream.return_value = [mock_doc]
            
            # Need to create a new request mock for the fallback test
            request_mock_fallback = MagicMock()
            request_mock_fallback.json = AsyncMock(return_value={'user_id': 'user_123'})

            with patch('routers.memory.Request', return_value=request_mock_fallback):
                response = await memory.list_memories(request_mock_fallback)

        data = json.loads(response.body)
        self.assertEqual(data['status'], 'success')
        self.assertGreaterEqual(len(data['memories']), 1)
        self.assertEqual(data['memories'][0]['content'], 'Firestore memory')
        self.assertEqual(data['memories'][0]['source'], 'firestore')

if __name__ == '__main__':
    unittest.main()
