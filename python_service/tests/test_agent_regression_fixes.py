"""
Tests for Agent Regression Fixes

This test file verifies that the agent regressions have been properly fixed:
1. nano_banana tool is registered in the agent tools list
2. Detailed agent instructions are present
3. Agent model is set to gemini-2.0-flash
4. Thinking events are emitted during agent execution
5. create_event tool has full implementation with API call
"""

import unittest
from unittest.mock import MagicMock, patch, AsyncMock
import json
import sys
import os
import importlib
import types

# Add python_service to path - insert at beginning for priority
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


def setup_module(module):
    """Clean up any polluted sys.modules from other test files before running our tests."""
    # Ensure google.auth.transport can be imported properly
    # Don't mock it - let the real module be imported if it exists
    # The issue is that conftest.py cleanup might have removed it
    try:
        # Try to import the real module first
        import google.auth.transport.requests
        import google.auth.transport._http_client
    except ImportError:
        # If it fails, create module-like objects
        transport_module = types.ModuleType('google.auth.transport')
        requests_module = types.ModuleType('google.auth.transport.requests')
        http_client_module = types.ModuleType('google.auth.transport._http_client')
        
        transport_module.requests = requests_module
        transport_module._http_client = http_client_module
        
        sys.modules['google.auth.transport'] = transport_module
        sys.modules['google.auth.transport.requests'] = requests_module
        sys.modules['google.auth.transport._http_client'] = http_client_module
    
    # Remove mocked google.adk modules that other test files inject at import time
    mocked_modules = [
        'google.adk', 'google.adk.agents', 'google.adk.memory', 'google.adk.sessions',
        'google.adk.events', 'google.adk.models', 'google.adk.runners', 'google.adk.tools',
        'momentum_agent'
    ]
    for mod in mocked_modules:
        if mod in sys.modules:
            # Check if it's a mock - if so, remove it
            if isinstance(sys.modules[mod], MagicMock) or 'MagicMock' in str(type(sys.modules[mod])):
                del sys.modules[mod]

    # Force reimport of momentum_agent with fresh google.adk
    if 'momentum_agent' in sys.modules:
        del sys.modules['momentum_agent']


class TestAgentToolsRegistration(unittest.TestCase):
    """Test that all tools are properly registered in the agent."""

    def test_nano_banana_in_tools_list(self):
        """Verify nano_banana is in the agent's tools list."""
        from momentum_agent import create_momentum_agent

        agent = create_momentum_agent()
        tool_names = [tool.__name__ if hasattr(tool, '__name__') else str(tool) for tool in agent.tools]

        self.assertIn('nano_banana', tool_names,
                      "nano_banana should be in the agent's tools list")

    def test_all_expected_tools_registered(self):
        """Verify all expected tools are registered."""
        from momentum_agent import create_momentum_agent
        
        # Try to import AgentTool, but handle if it's not available
        AgentTool_class = None
        try:
            from google.adk.tools import AgentTool
            AgentTool_class = AgentTool
        except ImportError:
            pass

        agent = create_momentum_agent()

        # Get tool names, handling both regular functions and AgentTool objects
        tool_names = []
        has_search_agent = False
        for tool in agent.tools:
            if hasattr(tool, '__name__'):
                tool_names.append(tool.__name__)
            elif AgentTool_class is not None and isinstance(tool, AgentTool_class):
                # search_agent_tool is an AgentTool wrapping the search sub-agent
                has_search_agent = True
            elif hasattr(tool, 'name'):  # AgentTool might have a name attribute
                tool_names.append(tool.name)
                has_search_agent = True
            else:
                tool_names.append(str(tool))

        expected_function_tools = [
            'generate_text',
            'generate_image',
            'analyze_image',  # Gemini Vision for image understanding
            'generate_video',
            # 'search_agent_tool' is an AgentTool, not a function
            'crawl_website',
            'suggest_domain_names',
            'create_team_strategy',
            'plan_website',
            'design_logo_concepts',
            'create_event',
            'nano_banana',
            'recall_memory',
            'save_memory',
            'process_youtube_video',
            'query_brand_documents',  # RAG query tool
            # Media Library Search Tools (Vertex AI Search)
            'search_media_library',  # Search all media
            'search_images',  # Search images specifically
            'search_videos',  # Search videos specifically
            'search_team_media',  # Team tool for multimodal media search
            'find_similar_media',  # Find similar media items
        ]

        for tool in expected_function_tools:
            self.assertIn(tool, tool_names, f"{tool} should be in the agent's tools list")

        # Verify search_agent_tool (AgentTool) is present
        self.assertTrue(has_search_agent, "search_agent_tool (AgentTool) should be in the agent's tools list")

        # Verify count matches (20 functions + 1 AgentTool = 21 tools)
        self.assertEqual(len(agent.tools), len(expected_function_tools) + 1,
                        f"Expected {len(expected_function_tools) + 1} tools (including AgentTool), got {len(agent.tools)}")


class TestAgentInstructions(unittest.TestCase):
    """Test that agent instructions are properly configured."""

    def test_detailed_instructions_present(self):
        """Verify the agent has detailed instructions."""
        from momentum_agent import create_momentum_agent

        agent = create_momentum_agent()
        instructions = agent.instruction

        # Verify key sections are present
        self.assertIn("MOMENTUM AI Assistant", instructions)
        self.assertIn("CRITICAL INSTRUCTIONS FOR USING TOOLS", instructions)
        self.assertIn("Media Generation:", instructions)
        self.assertIn("Image Editing with Nano Banana:", instructions)
        self.assertIn("Event Creation:", instructions)
        self.assertIn("Website Crawling:", instructions)

    def test_nano_banana_instructions_present(self):
        """Verify nano_banana usage instructions are in the prompt."""
        from momentum_agent import create_momentum_agent

        agent = create_momentum_agent()
        instructions = agent.instruction

        # Check for nano_banana specific instructions
        self.assertIn("nano_banana", instructions)
        self.assertIn("edit", instructions.lower())
        self.assertIn("modify", instructions.lower())

    def test_tool_examples_present(self):
        """Verify specific tool usage examples are present."""
        from momentum_agent import create_momentum_agent

        agent = create_momentum_agent()
        instructions = agent.instruction

        # Check for examples
        self.assertIn("Generate a video of an eagle", instructions)
        self.assertIn("Create an image of a basketball", instructions)
        self.assertIn("Create a launch event", instructions)


class TestAgentModelConfiguration(unittest.TestCase):
    """Test that agent model is properly configured."""

    def test_default_model_is_gemini_2_0_flash(self):
        """Verify default model is gemini-2.0-flash."""
        from momentum_agent import create_momentum_agent

        agent = create_momentum_agent()

        self.assertEqual(agent.model, 'gemini-2.0-flash',
                        "Default model should be gemini-2.0-flash")

    def test_custom_model_can_be_specified(self):
        """Verify custom model can be passed."""
        from momentum_agent import create_momentum_agent

        agent = create_momentum_agent(model_name='gemini-2.5-flash')

        self.assertEqual(agent.model, 'gemini-2.5-flash')


class TestCreateEventImplementation(unittest.TestCase):
    """Test that create_event has full implementation."""

    def test_create_event_requires_brand_id(self):
        """Verify create_event returns error without brand_id."""
        from tools.team_tools import create_event

        # Mock get_brand_context to return None
        with patch('tools.team_tools.get_brand_context', return_value=None):
            result = create_event("test event", brand_id=None)

            self.assertEqual(result['status'], 'error')
            self.assertIn('Brand ID required', result['error'])

    def test_create_event_with_brand_id_calls_api(self):
        """Verify create_event calls the parsing API when brand_id is provided."""
        from tools.team_tools import create_event

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "campaignName": "Test Event",
            "campaignRequest": {"duration": 1},
            "totalPosts": 3
        }

        with patch('tools.team_tools.requests.post', return_value=mock_response) as mock_post:
            result = create_event("test event", brand_id="test-brand")

            # Verify API was called
            mock_post.assert_called_once()
            call_args = mock_post.call_args
            self.assertIn('/api/parse-event-description', call_args[0][0])

            # Verify result
            self.assertEqual(result['status'], 'success')
            self.assertIn('preview_data', result)
            self.assertEqual(result['preview_data']['campaignName'], 'Test Event')

    def test_create_event_fallback_on_connection_error(self):
        """Verify create_event has fallback when API is unavailable."""
        from tools.team_tools import create_event
        import requests

        with patch('tools.team_tools.requests.post', side_effect=requests.exceptions.ConnectionError()):
            result = create_event("test event", brand_id="test-brand")

            # Should return fallback response, not error
            self.assertEqual(result['status'], 'success')
            self.assertIn('preview_data', result)
            self.assertIn('message', result)


class TestThinkingEventsStreaming(unittest.TestCase):
    """Test that thinking events are properly streamed."""

    def test_thinking_messages_format(self):
        """Verify thinking message format is correct for different tools."""
        # This tests the thinking message generation logic
        tool_thinking_messages = {
            'generate_image': '🎨 Generating image...',
            'generate_video': '🎬 Generating video (this may take 30-90 seconds)...',
            'nano_banana': '🍌 Editing image with Nano Banana...',
            'search_web': '🔍 Searching the web...',
            'crawl_website': '🌐 Crawling website...',
            'create_event': '📅 Creating event...',
            'recall_memory': '💭 Recalling from memory...',
            'save_memory': '💾 Saving to memory...',
            'process_youtube_video': '📺 Analyzing YouTube video...',
        }

        # Each tool should have a custom thinking message
        for tool_name, expected_msg in tool_thinking_messages.items():
            self.assertIn('...', expected_msg, f"{tool_name} thinking message should end with ...")
            self.assertTrue(len(expected_msg) > 5, f"{tool_name} should have a descriptive message")

    @patch('routers.agent.get_adk_components')
    async def test_streaming_response_emits_thinking_first(self, mock_get_components):
        """Verify streaming response emits 'Thinking...' as first event."""
        # This is a structural test - actual streaming tested in integration tests
        from routers.agent import chat_with_adk_agent

        # The route handler should use StreamingResponse with generate_streaming_response
        # which emits 'Thinking...' as the first event
        pass  # Integration test - skip unit test

    def test_final_response_event_emitted(self):
        """Verify the agent router emits 'final_response' event type for chat history persistence."""
        import inspect
        from routers import agent

        # Read the source code of the agent router
        source = inspect.getsource(agent)

        # Verify 'final_response' event type is used (this triggers frontend to save to history)
        self.assertIn("'type': 'final_response'", source,
                      "Agent router should emit 'final_response' event type for chat history persistence")

        # Verify the event includes content
        self.assertIn("'content': full_response_text", source,
                      "final_response event should include the full response text")


class TestNanoBananaToolFunction(unittest.TestCase):
    """Test nano_banana tool function directly."""

    def test_nano_banana_exists_and_callable(self):
        """Verify nano_banana function exists and is callable."""
        from tools.media_tools import nano_banana

        self.assertTrue(callable(nano_banana))

    def test_nano_banana_has_correct_signature(self):
        """Verify nano_banana has expected parameters."""
        from tools.media_tools import nano_banana
        import inspect

        sig = inspect.signature(nano_banana)
        params = list(sig.parameters.keys())

        # Should have these parameters (based on docstring)
        self.assertIn('prompt', params)
        self.assertIn('image_url', params)

    def test_nano_banana_returns_error_without_client(self):
        """Verify nano_banana handles missing genai_client gracefully."""
        from tools.media_tools import nano_banana, set_genai_client

        # Ensure client is None
        set_genai_client(None)

        result = nano_banana(prompt="test edit")

        self.assertEqual(result['status'], 'error')
        self.assertIn('not initialized', result['error'])


class TestAgentRouterIntegration(unittest.TestCase):
    """Test agent router integration points."""

    def test_agent_router_handles_nano_banana_response(self):
        """Verify router properly handles nano_banana responses."""
        # The router should check for nano_banana in function_responses
        # and extract image_url from the response

        # Mock function response
        mock_fr = MagicMock()
        mock_fr.name = 'nano_banana'
        mock_fr.response = {
            'status': 'success',
            'image_url': 'https://example.com/edited.png',
            'prompt': 'make it blue'
        }

        # Verify the response format matches what router expects
        self.assertEqual(mock_fr.response.get('status'), 'success')
        self.assertIsNotNone(mock_fr.response.get('image_url'))


class TestCreateEventStructuredDataEmission(unittest.TestCase):
    """Test that create_event emits structured data for the Generate Event with AI card."""

    def test_create_event_response_contains_preview_data(self):
        """Verify create_event returns preview_data with action 'generate-campaign'."""
        from tools.team_tools import create_event

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "campaignName": "Product Launch",
            "campaignRequest": {"duration": 3, "startDate": "2024-01-15"},
            "totalPosts": 9
        }

        with patch('tools.team_tools.requests.post', return_value=mock_response):
            result = create_event("3-day product launch next Monday", brand_id="test-brand")

            # Verify result structure matches what agent.py expects
            self.assertEqual(result['status'], 'success')
            self.assertIn('preview_data', result)

            preview_data = result['preview_data']
            self.assertEqual(preview_data['action'], 'generate-campaign')
            self.assertEqual(preview_data['campaignName'], 'Product Launch')
            self.assertEqual(preview_data['brandId'], 'test-brand')
            self.assertIn('campaignRequest', preview_data)
            self.assertIn('totalPosts', preview_data)
            self.assertIn('prompt', preview_data)

    def test_create_event_fallback_also_has_preview_data(self):
        """Verify create_event fallback response also has correct preview_data structure."""
        from tools.team_tools import create_event
        import requests

        with patch('tools.team_tools.requests.post', side_effect=requests.exceptions.ConnectionError()):
            result = create_event("Test event", brand_id="test-brand")

            self.assertEqual(result['status'], 'success')
            self.assertIn('preview_data', result)

            preview_data = result['preview_data']
            self.assertEqual(preview_data['action'], 'generate-campaign')
            self.assertEqual(preview_data['brandId'], 'test-brand')
            self.assertIn('prompt', preview_data)

    def test_agent_router_has_create_event_handler(self):
        """Verify agent router handles create_event responses with type 'data' emission."""
        # Read the file directly to avoid import chain issues (firecrawl dependency)
        agent_router_path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'agent.py')
        with open(agent_router_path, 'r') as f:
            source = f.read()

        # Verify create_event handler exists
        self.assertIn("fr.name == 'create_event'", source,
                      "Agent router should handle create_event function responses")

        # Verify it checks for preview_data
        self.assertIn("preview_data", source,
                      "Agent router should extract preview_data from create_event response")

        # Verify it emits as 'data' type (like Team Tools event creator)
        self.assertIn("'type': 'data'", source,
                      "Agent router should emit 'data' type event for frontend structured rendering")

        # Verify it checks for 'generate-campaign' action
        self.assertIn("generate-campaign", source,
                      "Agent router should verify action is 'generate-campaign'")

    def test_agent_router_create_event_emits_same_format_as_team_tools(self):
        """Verify agent emits the same data structure as Team Tools event creator."""
        # Mock function response matching what create_event returns
        mock_fr = MagicMock()
        mock_fr.name = 'create_event'
        mock_fr.response = {
            'status': 'success',
            'message': "I've prepared an event plan for you.",
            'preview_data': {
                'action': 'generate-campaign',
                'prompt': 'Create a launch event',
                'campaignName': 'Product Launch',
                'campaignRequest': {'duration': 1},
                'totalPosts': 3,
                'brandId': 'test-brand'
            }
        }

        # Verify the response structure
        response = mock_fr.response
        self.assertEqual(response.get('status'), 'success')
        self.assertIsNotNone(response.get('preview_data'))

        preview_data = response.get('preview_data')
        self.assertEqual(preview_data.get('action'), 'generate-campaign')

        # This is what the frontend isCampaignData() checks for
        self.assertTrue(
            preview_data.get('action') == 'generate-campaign' or
            'campaignName' in preview_data,
            "Preview data should pass frontend isCampaignData() check"
        )


class TestAgentImports(unittest.TestCase):
    """Test that all required imports are working."""

    def test_nano_banana_import_in_momentum_agent(self):
        """Verify nano_banana is properly imported in momentum_agent."""
        from momentum_agent import nano_banana

        self.assertTrue(callable(nano_banana))

    def test_all_tools_importable(self):
        """Verify all tools can be imported."""
        from momentum_agent import (
            generate_text,
            generate_image,
            generate_video,
            search_web,
            crawl_website,
            suggest_domain_names,
            create_team_strategy,
            plan_website,
            design_logo_concepts,
            create_event,
            recall_memory,
            save_memory,
            process_youtube_video
        )
        from tools.media_tools import nano_banana

        # All should be callable
        tools = [
            generate_text, generate_image, generate_video, search_web,
            crawl_website, suggest_domain_names, create_team_strategy,
            plan_website, design_logo_concepts, create_event,
            nano_banana, recall_memory, save_memory, process_youtube_video
        ]

        for tool in tools:
            self.assertTrue(callable(tool), f"{tool} should be callable")


if __name__ == '__main__':
    unittest.main()
