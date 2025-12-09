"""
Search Agent - A dedicated agent for web search using Google's built-in search tool.

This agent is designed to be used as a tool by other agents (AgentTool pattern).
It uses Gemini 2's built-in google_search tool which provides reliable web search
without requiring Custom Search API configuration.

The multi-agent approach solves the Gemini limitation where built-in tools
(like google_search) cannot be mixed with custom function tools in the same agent.
By wrapping this search agent as an AgentTool, other agents can access web search
capabilities through agent-to-agent delegation.
"""

import os
import logging
from typing import Optional
from google.adk.agents import LlmAgent
from google.adk.tools import google_search

logger = logging.getLogger(__name__)

# Default model - must be Gemini 2.x for built-in google_search to work
DEFAULT_SEARCH_AGENT_MODEL = "gemini-2.0-flash"


def create_search_agent(model_name: Optional[str] = None) -> LlmAgent:
    """
    Create a search agent that uses the built-in google_search tool.

    This agent is designed to be wrapped as an AgentTool and used by other agents.
    It leverages Gemini 2's native web search grounding capabilities.

    Args:
        model_name: The model to use. Must be a Gemini 2.x model.
                   Defaults to gemini-2.0-flash.

    Returns:
        LlmAgent configured with google_search tool
    """
    model = model_name or DEFAULT_SEARCH_AGENT_MODEL

    # Ensure we're using a Gemini 2.x model (required for google_search)
    if not model.startswith("gemini-2"):
        logger.warning(f"Model {model} may not support google_search. Using {DEFAULT_SEARCH_AGENT_MODEL} instead.")
        model = DEFAULT_SEARCH_AGENT_MODEL

    logger.info(f"Creating search agent with model: {model}")

    search_agent = LlmAgent(
        name="web_search_agent",
        model=model,
        description="A specialized agent that searches the web for current information, news, and facts.",
        instruction="""You are a web search specialist. Your job is to search the web and provide accurate,
up-to-date information in response to queries.

When given a search query:
1. Use your google_search tool to find relevant information
2. Synthesize the search results into a clear, comprehensive response
3. Include key facts, dates, and sources when available
4. If the search returns no results, say so clearly

Always provide factual information based on your search results. Do not make up information.
When reporting search results, be concise but thorough.

Format your response as a well-organized summary of the search findings.""",
        tools=[google_search]
    )

    logger.info("Search agent created successfully with google_search tool")
    return search_agent


# Singleton instance for reuse
_search_agent_instance: Optional[LlmAgent] = None


def get_search_agent() -> LlmAgent:
    """
    Get or create the singleton search agent instance.

    Returns:
        The search agent instance
    """
    global _search_agent_instance
    if _search_agent_instance is None:
        _search_agent_instance = create_search_agent()
    return _search_agent_instance
