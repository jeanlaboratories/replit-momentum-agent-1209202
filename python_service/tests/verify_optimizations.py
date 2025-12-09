
import unittest
import os
import sys
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock

# Mock dotenv before importing momentum_agent
sys.modules['dotenv'] = MagicMock()
sys.modules['google'] = MagicMock()
sys.modules['google.adk'] = MagicMock()
sys.modules['google.adk.agents'] = MagicMock()
sys.modules['google.adk.runners'] = MagicMock()
sys.modules['google.adk.model'] = MagicMock()
sys.modules['google.adk.sessions'] = MagicMock()
sys.modules['google.genai'] = MagicMock()
sys.modules['firecrawl'] = MagicMock()
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.credentials'] = MagicMock()
sys.modules['firebase_admin.storage'] = MagicMock()
sys.modules['ddgs'] = MagicMock()
sys.modules['duckduckgo_search'] = MagicMock()
sys.modules['requests'] = MagicMock()
sys.modules['fastapi'] = MagicMock()
sys.modules['fastapi.responses'] = MagicMock()
sys.modules['fastapi.middleware'] = MagicMock()
sys.modules['fastapi.middleware.cors'] = MagicMock()
sys.modules['uvicorn'] = MagicMock()
sys.modules['pydantic'] = MagicMock()
sys.modules['PIL'] = MagicMock()
sys.modules['PIL.Image'] = MagicMock()
sys.modules['numpy'] = MagicMock()
sys.modules['sklearn'] = MagicMock()
sys.modules['sklearn.cluster'] = MagicMock()

# Add python_service to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from momentum_agent import upload_file_to_gemini
from session_manager import SessionManager


def teardown_module(module):
    """Clean up sys.modules after all tests in this module run."""
    modules_to_remove = [
        'dotenv', 'google', 'google.adk', 'google.adk.agents', 'google.adk.runners',
        'google.adk.model', 'google.adk.sessions', 'google.adk.tools',
        'google.genai', 'firecrawl', 'firebase_admin', 'firebase_admin.credentials',
        'firebase_admin.storage', 'ddgs', 'duckduckgo_search', 'requests',
        'fastapi', 'fastapi.responses', 'fastapi.middleware', 'fastapi.middleware.cors',
        'uvicorn', 'pydantic', 'PIL', 'PIL.Image', 'numpy', 'sklearn', 'sklearn.cluster',
        'momentum_agent', 'session_manager'
    ]
    for mod in modules_to_remove:
        if mod in sys.modules:
            del sys.modules[mod]

class TestOptimizations(unittest.IsolatedAsyncioTestCase):
    
    async def asyncSetUp(self):
        # Mock logger to avoid clutter
        self.logger_patcher = patch('momentum_agent.logger')
        self.mock_logger = self.logger_patcher.start()
        
    async def asyncTearDown(self):
        self.logger_patcher.stop()

    @patch('momentum_agent.genai_client')
    def test_upload_file_to_gemini(self, mock_client):
        """Verify upload_file_to_gemini calls client.files.upload correctly"""
        # Setup mock
        mock_file_obj = MagicMock()
        mock_file_obj.uri = "https://generativelanguage.googleapis.com/v1beta/files/12345"
        mock_client.files.upload.return_value = mock_file_obj
        
        # Test data
        data = b"fake_image_data"
        mime_type = "image/png"
        
        # Execute
        result = upload_file_to_gemini(data, mime_type)
        
        # Verify
        self.assertIsNotNone(result)
        self.assertEqual(result.uri, "https://generativelanguage.googleapis.com/v1beta/files/12345")
        mock_client.files.upload.assert_called_once()
        
        # Verify temp file handling (args[0] should be a path ending in .png)
        call_args = mock_client.files.upload.call_args
        self.assertTrue(call_args[1]['path'].endswith('.png'))
        self.assertEqual(call_args[1]['config']['mime_type'], 'image/png')

    @patch('session_manager.SessionManager.get_session_key')
    async def test_smart_memory_trimming(self, mock_get_key):
        """Verify manage_session_history trims session when tokens exceeded"""
        # Setup mocks
        mock_get_key.return_value = "brand_user"
        
        mock_session_service = MagicMock()
        # Make async methods return AsyncMock or be AsyncMock
        mock_session_service.list_sessions = AsyncMock()
        mock_session_service.get_session = AsyncMock()
        mock_session_service.delete_session = AsyncMock()
        mock_session_service.create_session = AsyncMock()
        
        mock_client = MagicMock()
        
        manager = SessionManager(session_service=mock_session_service)
        
        # Mock list_sessions
        mock_session = MagicMock()
        mock_session.id = "session_123"
        mock_session_service.list_sessions.return_value = MagicMock(sessions=[mock_session])
        
        # Mock get_session (full history)
        mock_full_session = MagicMock()
        # Create 10 dummy events
        mock_full_session.events = [MagicMock(content=f"msg {i}") for i in range(10)]
        mock_session_service.get_session.return_value = mock_full_session
        
        # Mock count_tokens to return HIGH value (trigger trim)
        mock_client.models.count_tokens.return_value = MagicMock(total_tokens=50000)
        
        # Execute
        trimmed = await manager.manage_session_history("brand", "user", mock_client, max_tokens=30000)
        
        # Verify
        self.assertTrue(trimmed)
        # Should have called delete_session
        mock_session_service.delete_session.assert_called_once()
        # Should have called create_session
        mock_session_service.create_session.assert_called_once()

    @patch('session_manager.SessionManager.get_session_key')
    async def test_smart_memory_no_trim(self, mock_get_key):
        """Verify manage_session_history does NOT trim when tokens within limit"""
        # Setup mocks
        mock_get_key.return_value = "brand_user"
        
        mock_session_service = MagicMock()
        mock_session_service.list_sessions = AsyncMock()
        mock_session_service.get_session = AsyncMock()
        mock_session_service.delete_session = AsyncMock()
        
        mock_client = MagicMock()
        
        manager = SessionManager(session_service=mock_session_service)
        
        # Mock list_sessions
        mock_session = MagicMock()
        mock_session.id = "session_123"
        mock_session_service.list_sessions.return_value = MagicMock(sessions=[mock_session])
        
        # Mock get_session
        mock_full_session = MagicMock()
        mock_full_session.events = [MagicMock(content="msg")]
        mock_session_service.get_session.return_value = mock_full_session
        
        # Mock count_tokens to return LOW value
        mock_client.models.count_tokens.return_value = MagicMock(total_tokens=1000)
        
        # Execute
        trimmed = await manager.manage_session_history("brand", "user", mock_client, max_tokens=30000)
        
        # Verify
        self.assertFalse(trimmed)
        mock_session_service.delete_session.assert_not_called()

    @patch('momentum_agent.genai_client')
    async def test_context_update_event(self, mock_genai):
        """Verify generate_chat_events yields context_update event"""
        # Import main safely (mocked fastapi)
        import main
        from main import generate_chat_events
        
        # Setup mocks
        mock_request = MagicMock()
        mock_request.brand_id = "brand"
        mock_request.user_id = "user"
        mock_request.session_id = "session_123"
        mock_request.messages = []
        mock_request.media = []
        
        mock_new_message = MagicMock()
        
        # Mock adk_runner.run_async to yield a final response
        async def mock_run_async(*args, **kwargs):
            # Yield a mock event
            mock_event = MagicMock()
            mock_event.is_final_response.return_value = True
            mock_event.content.parts = [MagicMock(text="Hello")]
            yield mock_event
        
            mock_session_manager.session_service.get_session = AsyncMock(return_value=mock_full_session)
            
            mock_genai.models.count_tokens.return_value = MagicMock(total_tokens=150)
            
            # Execute
            events = []
            async for event in event_generator(mock_request):
                events.append(event)
            
            # Verify
            # Check for context_update event
            context_updates = [e for e in events if '"type": "context_update"' in e]
            self.assertTrue(len(context_updates) > 0, "No context_update event found")
            self.assertIn('"token_usage": 150', context_updates[0])
            self.assertIn('"active_media"', context_updates[0])
            self.assertIn('"uri": "uri"', context_updates[0])

if __name__ == '__main__':
    unittest.main()
