import unittest
from unittest.mock import MagicMock, patch, AsyncMock
import sys
import os

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
adk_mock = MagicMock()
sys.modules['google.adk'] = adk_mock
sys.modules['google.adk.agents'] = MagicMock()
sys.modules['google.adk.memory'] = MagicMock()
sys.modules['google.adk.sessions'] = MagicMock()
sys.modules['google.adk.events'] = MagicMock()
sys.modules['google.adk.models'] = MagicMock()
sys.modules['google.adk.runners'] = MagicMock()
sys.modules['google.adk.tools'] = MagicMock()
sys.modules['google.adk.tools.agent_tool'] = MagicMock()
sys.modules['google.adk.tools.function_tool'] = MagicMock()

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
        
        chat_history = [
            {"role": "user", "content": "I like blue"},
            {"role": "model", "content": "Cool"}
        ]
        
        # Pass pre-extracted facts since automatic extraction is now disabled
        pre_extracted_facts = ["User likes blue"]
        
        # Test that save_conversation_to_memory handles the call properly
        # This will save to Firestore fallback since memory_service is None
        await memory_service.save_conversation_to_memory(
            "test_user_1", 
            chat_history, 
            pre_extracted_facts=pre_extracted_facts
        )
        
        # Verify Firestore was called to save memories
        mock_db.collection.assert_called()

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
