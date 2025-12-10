"""
Tests for memory creation and deletion synchronization between Vertex AI and Firestore.
These tests verify that:
1. Memories are created with consistent IDs between Vertex AI and Firestore
2. Deletion works on first attempt (no need to delete twice)
3. Both systems stay in sync
"""
import unittest
from unittest.mock import MagicMock, patch, AsyncMock
import sys
import os
import types

# Add the parent directory to sys.path
sys.path.insert(0, (os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))))

# Mock external dependencies before importing
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.credentials'] = MagicMock()
sys.modules['firebase_admin.storage'] = MagicMock()
sys.modules['firebase_admin.firestore'] = MagicMock()
sys.modules['google.genai'] = MagicMock()
sys.modules['google.genai.types'] = MagicMock()

# Mock vertexai
mock_vertexai = MagicMock()
mock_vertexai.__version__ = "1.129.0"
sys.modules['vertexai'] = mock_vertexai

# Setup ADK mocks
if 'google' not in sys.modules:
    sys.modules['google'] = types.ModuleType('google')
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

# Mock classes
def mock_agent_init(self, *args, **kwargs):
    self.tools = kwargs.get('tools', [])
    self.instruction = kwargs.get('instruction', '')
    self.model = kwargs.get('model', 'gemini-2.0-flash')
mock_agent = type('Agent', (), {'__init__': mock_agent_init})
sys.modules['google.adk.agents'].Agent = mock_agent

# Now import the modules to test
from services import memory_service


class TestMemorySync(unittest.IsolatedAsyncioTestCase):
    """Tests for memory synchronization between Vertex AI and Firestore."""
    
    @patch.dict(os.environ, {
        "MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID": "test-project",
        "MOMENTUM_AGENT_ENGINE_LOCATION": "us-central1"
    })
    @patch('services.memory_service.firestore.client')
    async def test_memory_creation_uses_vertex_ai_id_as_firestore_doc_id(self, mock_firestore):
        """Test that memory creation uses Vertex AI memory ID as Firestore document ID."""
        # Setup Firestore mocks
        mock_db = MagicMock()
        mock_firestore.return_value = mock_db
        
        mock_user_doc = MagicMock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {'agentEngineId': 'test-engine-id'}
        
        mock_users_col = MagicMock()
        mock_user_doc_ref = MagicMock()
        mock_memories_col = MagicMock()
        mock_doc_ref = MagicMock()
        
        mock_db.collection.return_value = mock_users_col
        mock_users_col.document.return_value = mock_user_doc_ref
        mock_user_doc_ref.get.return_value = mock_user_doc
        mock_user_doc_ref.collection.return_value = mock_memories_col
        mock_memories_col.document.return_value = mock_doc_ref
        mock_doc_ref.set = MagicMock()  # Verify .set() is called (not .add())
        
        # Mock vertexai.Client
        mock_vertexai_client = MagicMock()
        mock_agent_engines = MagicMock()
        mock_memories = MagicMock()
        mock_vertexai_client.agent_engines = mock_agent_engines
        mock_agent_engines.memories = mock_memories
        
        mock_operation = MagicMock()
        # Return a full Vertex AI memory path
        mock_operation.name = 'projects/test-project/locations/us-central1/reasoningEngines/test-engine-id/memories/memory-123'
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
            
            pre_extracted_facts = ["User likes blue"]
            
            await memory_service.save_conversation_to_memory(
                "test_user_1",
                chat_history,
                pre_extracted_facts=pre_extracted_facts
            )
            
            # Verify that .set() was called (indicating we're using a specific document ID, not .add())
            # The new implementation uses .document(short_id).set() instead of .add()
            # This ensures consistent IDs between Vertex AI and Firestore
            assert mock_doc_ref.set.called, "Should have called .set() to create document with specific ID (not .add())"
            
            # Verify the document data includes the adkMemoryId
            set_call = mock_doc_ref.set.call_args
            assert set_call is not None, "set() should have been called with document data"
            
            # Verify the document data contains the full adkMemoryId
            set_kwargs = set_call[1] if len(set_call) > 1 else {}
            set_args = set_call[0] if len(set_call) > 0 else {}
            doc_data = set_kwargs if set_kwargs else (set_args[0] if set_args else {})
            
            # The document should contain the full adkMemoryId
            if isinstance(doc_data, dict):
                assert 'adkMemoryId' in doc_data, "Document should contain adkMemoryId field"
                assert doc_data['adkMemoryId'] == 'projects/test-project/locations/us-central1/reasoningEngines/test-engine-id/memories/memory-123'
            
        finally:
            if original_vertexai:
                sys.modules['vertexai'] = original_vertexai
            elif 'vertexai' in sys.modules:
                del sys.modules['vertexai']
    
    @patch.dict(os.environ, {
        "MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID": "test-project",
        "MOMENTUM_AGENT_ENGINE_LOCATION": "us-central1"
    })
    @patch('routers.memory.firestore.client')
    async def test_memory_deletion_always_attempts_firestore(self, mock_firestore):
        """Test that memory deletion always attempts Firestore deletion, even if Vertex AI fails."""
        # Setup Firestore mocks
        mock_db = MagicMock()
        mock_firestore.return_value = mock_db
        
        mock_memory_doc = MagicMock()
        mock_memory_doc.exists = True
        mock_memory_doc.to_dict.return_value = {
            'adkMemoryId': 'projects/test-project/locations/us-central1/reasoningEngines/test-engine-id/memories/m1'
        }
        
        mock_user_doc = MagicMock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {'agentEngineId': 'test-engine-id'}
        
        mock_user_doc_ref = MagicMock()
        mock_user_doc_ref.get.return_value = mock_user_doc
        
        mock_memory_doc_ref = MagicMock()
        mock_memory_doc_ref.get.return_value = mock_memory_doc
        mock_memory_doc_ref.delete = MagicMock()
        
        mock_users_col = MagicMock()
        mock_memories_col = MagicMock()
        
        mock_db.collection.return_value = mock_users_col
        mock_users_col.document.return_value = mock_user_doc_ref
        mock_user_doc_ref.collection.return_value = mock_memories_col
        mock_memories_col.document.return_value = mock_memory_doc_ref
        
        # Mock vertexai.Client to raise an error (simulating Vertex AI failure)
        mock_vertexai_client = MagicMock()
        mock_agent_engines = MagicMock()
        mock_memories = MagicMock()
        mock_vertexai_client.agent_engines = mock_agent_engines
        mock_agent_engines.memories = mock_memories
        mock_memories.delete.side_effect = Exception("Vertex AI error")
        
        # Create mock vertexai module
        mock_vertexai_module = MagicMock()
        mock_vertexai_module.Client.return_value = mock_vertexai_client
        mock_vertexai_module.init = MagicMock()
        
        # Store original and inject mock
        original_vertexai = sys.modules.get('vertexai')
        sys.modules['vertexai'] = mock_vertexai_module
        
        try:
            # Mock request
            mock_request = MagicMock()
            mock_request.json = AsyncMock(return_value={
                "user_id": "test-user",
                "memory_id": "m1",
                "type": "personal"
            })
            
            # Call delete_memory
            from routers import memory
            response = await memory.delete_memory(mock_request)
            
            # Verify Firestore deletion was STILL attempted even though Vertex AI failed
            mock_memory_doc_ref.delete.assert_called_once()
            
            # Verify response indicates success (because Firestore deletion succeeded)
            self.assertEqual(response['status'], 'success')
            
        finally:
            if original_vertexai:
                sys.modules['vertexai'] = original_vertexai
            elif 'vertexai' in sys.modules:
                del sys.modules['vertexai']
    
    @patch.dict(os.environ, {
        "MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID": "test-project",
        "MOMENTUM_AGENT_ENGINE_LOCATION": "us-central1"
    })
    @patch('routers.memory.firestore.client')
    async def test_memory_deletion_works_on_first_attempt(self, mock_firestore):
        """Test that memory deletion works on first attempt (no need to delete twice)."""
        # Setup Firestore mocks
        mock_db = MagicMock()
        mock_firestore.return_value = mock_db
        
        # Memory doc exists with matching ID
        mock_memory_doc = MagicMock()
        mock_memory_doc.exists = True
        mock_memory_doc.to_dict.return_value = {
            'adkMemoryId': 'projects/test-project/locations/us-central1/reasoningEngines/test-engine-id/memories/m1'
        }
        
        mock_user_doc = MagicMock()
        mock_user_doc.exists = True
        mock_user_doc.to_dict.return_value = {'agentEngineId': 'test-engine-id'}
        
        mock_user_doc_ref = MagicMock()
        mock_user_doc_ref.get.return_value = mock_user_doc
        
        mock_memory_doc_ref = MagicMock()
        mock_memory_doc_ref.get.return_value = mock_memory_doc
        mock_memory_doc_ref.delete = MagicMock()
        
        mock_users_col = MagicMock()
        mock_memories_col = MagicMock()
        
        mock_db.collection.return_value = mock_users_col
        mock_users_col.document.return_value = mock_user_doc_ref
        mock_user_doc_ref.collection.return_value = mock_memories_col
        mock_memories_col.document.return_value = mock_memory_doc_ref
        
        # Mock vertexai.Client (successful deletion)
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
        
        # Store original and inject mock
        original_vertexai = sys.modules.get('vertexai')
        sys.modules['vertexai'] = mock_vertexai_module
        
        try:
            # Mock request
            mock_request = MagicMock()
            mock_request.json = AsyncMock(return_value={
                "user_id": "test-user",
                "memory_id": "m1",  # This should match the document ID
                "type": "personal"
            })
            
            # Call delete_memory
            from routers import memory
            response = await memory.delete_memory(mock_request)
            
            # Verify both deletions happened
            assert mock_memories.delete.called, "Vertex AI deletion should have been called"
            mock_memory_doc_ref.delete.assert_called_once(), "Firestore deletion should have been called"
            
            # Verify response indicates success
            self.assertEqual(response['status'], 'success')
            
            # Verify deletion happened on first attempt (not called multiple times)
            self.assertEqual(mock_memory_doc_ref.delete.call_count, 1)
            
        finally:
            if original_vertexai:
                sys.modules['vertexai'] = original_vertexai
            elif 'vertexai' in sys.modules:
                del sys.modules['vertexai']


if __name__ == '__main__':
    unittest.main()

