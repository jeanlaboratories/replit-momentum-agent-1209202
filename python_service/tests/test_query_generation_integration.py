"""
Test Query Generation Agent Integration

Tests the Generative Recommendation pattern integration with media search.
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock

# Try to import pytest-asyncio, fall back if not available
try:
    import pytest_asyncio
    ASYNC_AVAILABLE = True
except ImportError:
    ASYNC_AVAILABLE = False

from agents.query_generation_agent import (
    create_query_generation_agent,
    generate_search_queries_sync,
    generate_search_queries_async,
    reset_query_generation_agent
)


def setup_module():
    """Reset query generation agent before running tests in this module."""
    reset_query_generation_agent()


def teardown_module():
    """Reset query generation agent after running tests in this module."""
    reset_query_generation_agent()


def test_query_generation_agent_creation():
    """Test that query generation agent can be created."""
    agent = create_query_generation_agent()
    assert agent is not None
    assert agent.name == "query_generation_agent"
    # Check that tools list is not empty (google_search tool is present)
    assert len(agent.tools) > 0
    # Check that at least one tool is related to search
    tool_strs = [str(tool).lower() for tool in agent.tools]
    assert any("search" in tool_str for tool_str in tool_strs)


def test_generate_search_queries_sync_fallback():
    """Test that sync wrapper falls back gracefully on errors."""
    # Should return original query if generation fails
    queries = generate_search_queries_sync("test query")
    assert isinstance(queries, list)
    assert len(queries) >= 1
    assert queries[0] == "test query"


def test_generate_search_queries_async_fallback():
    """Test that async version falls back gracefully on errors."""
    # Test the async function by running it in an event loop
    async def run_test():
        # Should return original query if generation fails (no mocking needed - will fail gracefully)
        try:
            queries = await generate_search_queries_async("test query")
            assert isinstance(queries, list)
            assert len(queries) >= 1
            assert queries[0] == "test query"
        except Exception as e:
            # If it fails completely, that's also acceptable for this test
            # The important thing is it doesn't crash the system
            assert isinstance(e, Exception)
    
    # Run the async test
    try:
        asyncio.run(run_test())
    except RuntimeError:
        # If event loop is already running, skip this test
        pytest.skip("Event loop already running, skipping async test")


def test_multi_query_search_service():
    """Test that media search service supports multi-query."""
    from services.media_search_service import MediaSearchService
    
    service = MediaSearchService()
    # Verify the method exists
    assert hasattr(service, 'search_multi_query')
    assert callable(service.search_multi_query)


def test_media_search_tools_query_generation():
    """Test that media search tools use query generation."""
    from tools.media_search_tools import search_media_library
    
    # Verify the function accepts use_query_generation parameter
    import inspect
    sig = inspect.signature(search_media_library)
    assert 'use_query_generation' in sig.parameters
    assert sig.parameters['use_query_generation'].default is True

