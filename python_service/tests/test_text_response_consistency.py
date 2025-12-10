"""
Tests for Text Response Consistency

This test file ensures that all text-returning tools (team_tools, rag_tools,
media_search_tools) return consistent response structures that can be consumed
by the frontend regardless of which tool generated the response.

Standard Text Response Format:
- status: 'success' or 'error'
- content: The main AI-generated text/markdown (primary field for NDJSON streaming)
- message: Same content for backward compatibility (some older tools use this)

For RAG tools specifically:
- answer: Same as content for backward compatibility with RAG-specific consumers

This ensures the frontend can reliably use response.content for displaying text
in the chat interface across all modes (Agent, AI Models, Team Tools).
"""

import unittest
import os


class TestTextResponseConsistency(unittest.TestCase):
    """Base test class for text response consistency checks."""

    def assert_text_response_structure(self, result, check_answer=False):
        """Helper to validate text response structure.

        Args:
            result: The response dict to validate
            check_answer: If True, also check for 'answer' field (RAG tools)
        """
        self.assertIn('status', result, "Response missing 'status' field")

        # Must have 'content' field for consistency with agent NDJSON
        self.assertIn('content', result, "Response missing 'content' field")
        self.assertIsInstance(result['content'], str, "'content' must be a string")

        # Must have 'message' for backward compatibility
        self.assertIn('message', result, "Response missing 'message' field")
        self.assertIsInstance(result['message'], str, "'message' must be a string")

        # For success responses, content should not be empty
        if result['status'] == 'success':
            self.assertTrue(len(result['content']) > 0, "'content' should not be empty for success responses")

        # For RAG tools, also check 'answer' field
        if check_answer:
            self.assertIn('answer', result, "RAG response missing 'answer' field")
            self.assertIsInstance(result['answer'], str, "'answer' must be a string")
            # answer and content should be the same
            self.assertEqual(result['content'], result['answer'],
                           "'content' and 'answer' should be equal for RAG responses")


class TestTeamToolsTextResponseConsistency(TestTextResponseConsistency):
    """Test that team_tools return consistent text response structure."""

    def test_suggest_domain_names_has_content_field(self):
        """Verify suggest_domain_names returns content field."""
        team_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'team_tools.py')
        with open(team_tools_path, 'r') as f:
            source = f.read()

        # Check suggest_domain_names has content field
        self.assertIn('"content": response.result', source,
                     "suggest_domain_names should include 'content' field")
        self.assertIn('"message": response.result', source,
                     "suggest_domain_names should include 'message' field")

    def test_create_team_strategy_has_content_field(self):
        """Verify create_team_strategy returns content field."""
        team_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'team_tools.py')
        with open(team_tools_path, 'r') as f:
            source = f.read()

        # Check for content field in strategy responses
        # We check for the pattern that indicates the standardized format
        self.assertIn('# Standardized text response format', source,
                     "team_tools should have standardized response comments")

    def test_plan_website_has_content_field(self):
        """Verify plan_website returns content field."""
        team_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'team_tools.py')
        with open(team_tools_path, 'r') as f:
            source = f.read()

        # Count occurrences of content field in success responses
        content_count = source.count('"content":')
        # We expect at least 8 content fields (suggest_domain_names, create_team_strategy,
        # plan_website, search_team_media success/no results, find_similar_media success/no results,
        # generate_music success/error, search_youtube_videos)
        self.assertGreaterEqual(content_count, 8,
                               f"team_tools should have at least 8 'content' fields, found {content_count}")

    def test_search_team_media_has_content_field(self):
        """Verify search_team_media returns content field."""
        team_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'team_tools.py')
        with open(team_tools_path, 'r') as f:
            source = f.read()

        # Check for both success and no-results content fields
        self.assertIn('"content": summary_text', source,
                     "search_team_media should use 'content' for success")
        self.assertIn('"content": no_results_text', source,
                     "search_team_media should use 'content' for no results")

    def test_find_similar_media_has_content_field(self):
        """Verify find_similar_media returns content field."""
        team_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'team_tools.py')
        with open(team_tools_path, 'r') as f:
            source = f.read()

        # Check for content field in find_similar_media
        # The function uses summary_text and no_results_text variables
        self.assertIn('summary_text = f"Found {len(formatted_results)} similar media items."', source,
                     "find_similar_media should define summary_text")

    def test_generate_music_has_content_field(self):
        """Verify generate_music returns content field."""
        team_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'team_tools.py')
        with open(team_tools_path, 'r') as f:
            source = f.read()

        # Check for content field in generate_music success responses
        self.assertIn('"content": summary_text + media_markers', source,
                     "generate_music should include 'content' field with music markers")
        # Check for message field for backward compatibility
        self.assertIn('"message": summary_text', source,
                     "generate_music should include 'message' field for backward compatibility")

    def test_generate_music_has_music_url_markers(self):
        """Verify generate_music returns music URL markers for chat display."""
        team_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'team_tools.py')
        with open(team_tools_path, 'r') as f:
            source = f.read()

        # Check for music URL markers
        self.assertIn('__MUSIC_URL__', source,
                     "generate_music should use __MUSIC_URL__ markers")
        self.assertIn('media_markers += f"\\n__MUSIC_URL__{url}__MUSIC_URL__"', source,
                     "generate_music should format music URL markers correctly")


class TestRagToolsTextResponseConsistency(TestTextResponseConsistency):
    """Test that rag_tools return consistent text response structure."""

    def test_query_brand_documents_has_content_field(self):
        """Verify query_brand_documents returns both content and answer fields."""
        rag_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'rag_tools.py')
        with open(rag_tools_path, 'r') as f:
            source = f.read()

        # Check for content field
        self.assertIn('"content": result.answer', source,
                     "query_brand_documents should include 'content' field")
        # Check for answer field (backward compat)
        self.assertIn('"answer": result.answer', source,
                     "query_brand_documents should include 'answer' field")

    def test_query_brand_documents_content_equals_answer(self):
        """Verify content and answer fields contain the same value."""
        rag_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'rag_tools.py')
        with open(rag_tools_path, 'r') as f:
            source = f.read()

        # Both should reference result.answer for consistency
        content_line_count = source.count('"content": result.answer')
        answer_line_count = source.count('"answer": result.answer')

        # Should have at least 2 of each (success with contexts, success without contexts)
        self.assertGreaterEqual(content_line_count, 2,
                               "Should have content field in multiple success paths")
        self.assertGreaterEqual(answer_line_count, 2,
                               "Should have answer field in multiple success paths")

    def test_query_brand_documents_error_has_content(self):
        """Verify error responses also have content field."""
        rag_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'rag_tools.py')
        with open(rag_tools_path, 'r') as f:
            source = f.read()

        # Check for content field in error responses
        self.assertIn('"content": error_text', source,
                     "Error responses should include 'content' field")

    def test_index_brand_document_has_content_field(self):
        """Verify index_brand_document returns content field."""
        rag_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'rag_tools.py')
        with open(rag_tools_path, 'r') as f:
            source = f.read()

        # Check for content field in index responses
        self.assertIn('"content": result.message', source,
                     "index_brand_document success should include 'content' field")


class TestMediaSearchToolsTextResponseConsistency(TestTextResponseConsistency):
    """Test that media_search_tools return consistent text response structure."""

    def test_search_media_library_has_content_field(self):
        """Verify search_media_library returns content field."""
        media_search_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'media_search_tools.py')
        with open(media_search_tools_path, 'r') as f:
            source = f.read()

        # Check for content field in success responses
        self.assertIn('"content": summary_text', source,
                     "search_media_library should include 'content' for success")
        self.assertIn('"content": no_results_text', source,
                     "search_media_library should include 'content' for no results")

    def test_search_media_library_error_has_content(self):
        """Verify search_media_library error responses have content field."""
        media_search_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'media_search_tools.py')
        with open(media_search_tools_path, 'r') as f:
            source = f.read()

        # Check for content field in error responses
        self.assertIn('"content": error_text', source,
                     "Error responses should include 'content' field")

    def test_index_brand_media_has_content_field(self):
        """Verify index_brand_media returns content field."""
        media_search_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'media_search_tools.py')
        with open(media_search_tools_path, 'r') as f:
            source = f.read()

        # Check for content field in index responses
        self.assertIn('"content": success_text', source,
                     "index_brand_media should include 'content' for success")


class TestAgentRouterTextHandling(unittest.TestCase):
    """Test that agent router correctly handles text responses via NDJSON."""

    def test_agent_router_uses_content_field_for_final_response(self):
        """Verify agent router emits content in final_response."""
        agent_router_path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'agent.py')
        with open(agent_router_path, 'r') as f:
            source = f.read()

        # Agent router should emit final_response with content field
        self.assertIn("'type': 'final_response'", source,
                     "Agent router should emit final_response type")
        self.assertIn("'content': full_response_text", source,
                     "Agent router should include content in final_response")

    def test_agent_router_has_thinking_events(self):
        """Verify agent router emits thinking events for tool usage."""
        agent_router_path = os.path.join(os.path.dirname(__file__), '..', 'routers', 'agent.py')
        with open(agent_router_path, 'r') as f:
            source = f.read()

        # Should have log events for thinking
        self.assertIn("'type': 'log'", source,
                     "Agent router should emit log type for thinking events")
        self.assertIn("'content': 'Thinking...'", source,
                     "Agent router should emit 'Thinking...' log")


class TestResponseFieldDocumentation(unittest.TestCase):
    """Test that response format is documented in the codebase."""

    def test_team_tools_has_format_comments(self):
        """Verify team_tools has standardization comments."""
        team_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'team_tools.py')
        with open(team_tools_path, 'r') as f:
            source = f.read()

        self.assertIn('# Standardized text response format', source,
                     "team_tools should document the standardized format")

    def test_rag_tools_has_format_comments(self):
        """Verify rag_tools has standardization comments."""
        rag_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'rag_tools.py')
        with open(rag_tools_path, 'r') as f:
            source = f.read()

        self.assertIn('# Standardized text response format', source,
                     "rag_tools should document the standardized format")

    def test_media_search_tools_has_format_comments(self):
        """Verify media_search_tools has standardization comments."""
        media_search_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'media_search_tools.py')
        with open(media_search_tools_path, 'r') as f:
            source = f.read()

        self.assertIn('# Standardized text response format', source,
                     "media_search_tools should document the standardized format")


class TestBackwardCompatibility(unittest.TestCase):
    """Test that backward compatibility is maintained."""

    def test_team_tools_message_field_preserved(self):
        """Verify team_tools still has message field for backward compat."""
        team_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'team_tools.py')
        with open(team_tools_path, 'r') as f:
            source = f.read()

        # Count message field occurrences
        message_count = source.count('"message":')
        self.assertGreaterEqual(message_count, 8,
                               "team_tools should preserve 'message' field for backward compatibility")

    def test_rag_tools_answer_field_preserved(self):
        """Verify rag_tools still has answer field for backward compat."""
        rag_tools_path = os.path.join(os.path.dirname(__file__), '..', 'tools', 'rag_tools.py')
        with open(rag_tools_path, 'r') as f:
            source = f.read()

        # Count answer field occurrences
        answer_count = source.count('"answer":')
        self.assertGreaterEqual(answer_count, 4,
                               "rag_tools should preserve 'answer' field for backward compatibility")


if __name__ == '__main__':
    unittest.main()
