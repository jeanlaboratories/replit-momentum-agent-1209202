"""
Agents package - Contains specialized agents that can be used as tools.

This package implements the multi-agent architecture pattern where specialized
agents are wrapped as AgentTools to provide capabilities to other agents.
"""

from agents.search_agent import create_search_agent, get_search_agent

__all__ = [
    "create_search_agent",
    "get_search_agent",
]
