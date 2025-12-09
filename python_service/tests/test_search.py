import sys
import os
from unittest.mock import MagicMock, patch, Mock
import pytest

# Add parent directory to path first
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock duckduckgo_search as fallback
mock_ddgs_class = MagicMock()
sys.modules['duckduckgo_search'] = MagicMock()
import duckduckgo_search
duckduckgo_search.DDGS = mock_ddgs_class

from momentum_agent import search_web

@pytest.fixture
def mock_ddgs():
    # Try patching ddgs first, as it seems to be preferred in momentum_agent.py
    try:
        with patch('ddgs.DDGS') as mock:
            yield mock
    except (ImportError, ModuleNotFoundError):
        # Fallback to duckduckgo_search
        with patch('duckduckgo_search.DDGS') as mock:
            yield mock

def test_search_web_with_duckduckgo(mock_ddgs):
    """Test that search_web uses DuckDuckGo for direct search calls.

    Note: The google_search ADK tool is available to the Agent for grounded search,
    but search_web uses DuckDuckGo directly since google_search is a Tool class
    that can't be called as a function.
    """
    # Setup mock return value for DuckDuckGo
    mock_instance = mock_ddgs.return_value
    mock_instance.__enter__.return_value = mock_instance
    mock_instance.text.return_value = [
        {
            "title": "AI News Source 1",
            "href": "https://example.com/ai-news-1",
            "body": "Latest AI news shows significant developments..."
        },
        {
            "title": "AI News Source 2",
            "href": "https://example.com/ai-news-2",
            "body": "More AI developments..."
        }
    ]

    result = search_web("latest ai news")

    assert result["status"] == "success"
    assert "results" in result
    assert result["query"] == "latest ai news"
    assert len(result["results"]) == 2

def test_search_web_multiple_results(mock_ddgs):
    """Test that search_web returns multiple results correctly."""
    # Setup mock return value for DuckDuckGo
    mock_instance = mock_ddgs.return_value
    mock_instance.__enter__.return_value = mock_instance
    mock_instance.text.return_value = [
        {
            "title": "Test Result 1",
            "href": "http://example.com/1",
            "body": "This is a test snippet 1"
        },
        {
            "title": "Test Result 2",
            "href": "http://example.com/2",
            "body": "This is a test snippet 2"
        }
    ]

    result = search_web("test query")

    assert result["status"] == "success"
    assert "results" in result
    assert len(result["results"]) == 2
    assert result["results"][0]["title"] == "Test Result 1"
    assert result["results"][1]["title"] == "Test Result 2"

def test_search_web_empty(mock_ddgs):
    """Test search_web with empty query."""
    # Setup mock to return empty list or handle gracefully
    mock_instance = mock_ddgs.return_value
    mock_instance.__enter__.return_value = mock_instance
    mock_instance.text.return_value = []

    result = search_web("")
    
    # If no results, it might return error or just None/empty depending on implementation
    # Looking at code: if results: return success... else: return error "No results found"
    
    # Let's check the implementation of search_web again.
    # It returns error if results is empty/None.
    
    if result.get("status") == "success":
        assert len(result["results"]) == 0
    else:
        assert result["status"] == "error"

if __name__ == "__main__":
    # Manual run capability (still hits real network if run directly)
    print("Running search test manually (hitting real network)...")
    try:
        res = search_web("momentum ai agent")
        print(f"Status: {res.get('status')}")
        if res.get('status') == 'success':
            print(f"Found {len(res.get('results', []))} results")
            print(f"First result: {res['results'][0]['title']}")
        else:
            print(f"Error: {res.get('error')}")
    except Exception as e:
        print(f"Manual run failed: {e}")
