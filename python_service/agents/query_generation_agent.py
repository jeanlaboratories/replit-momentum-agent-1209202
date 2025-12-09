"""
Query Generation Agent - Generates multiple search queries from user intent

This agent follows the "Generative Recommendation" pattern from the notebook.
It uses Google Search to research user intent, then generates multiple diverse
queries for better search coverage.

Based on the e-commerce recommendation notebook pattern where:
1. Research Agent uses Google Search to understand user intent
2. Generates 5 diverse queries
3. These queries are used for comprehensive search
"""

import logging
from typing import Optional, List
from google.adk.agents import LlmAgent
from google.adk.tools import google_search

logger = logging.getLogger(__name__)

# Default model - must be Gemini 2.x for built-in google_search to work
DEFAULT_QUERY_GENERATION_MODEL = "gemini-2.0-flash"


def create_query_generation_agent(model_name: Optional[str] = None) -> LlmAgent:
    """
    Create a query generation agent that uses Google Search to research user intent
    and generates multiple diverse search queries.

    This agent follows the notebook pattern:
    1. Uses Google Search to research what users typically search for
    2. Generates 3-5 diverse queries based on research findings
    3. Returns queries in a structured format

    Args:
        model_name: The model to use. Must be a Gemini 2.x model.
                   Defaults to gemini-2.0-flash.

    Returns:
        LlmAgent configured with google_search tool for query generation
    """
    model = model_name or DEFAULT_QUERY_GENERATION_MODEL

    # Ensure we're using a Gemini 2.x model (required for google_search)
    if not model.startswith("gemini-2"):
        logger.warning(f"Model {model} may not support google_search. Using {DEFAULT_QUERY_GENERATION_MODEL} instead.")
        model = DEFAULT_QUERY_GENERATION_MODEL

    logger.info(f"Creating query generation agent with model: {model}")

    query_agent = LlmAgent(
        name="query_generation_agent",
        model=model,
        description=(
            "A specialized agent that researches user search intent using web search "
            "and generates multiple diverse search queries for comprehensive media discovery."
        ),
        instruction="""You are a query generation specialist for a media library search system.

When given a user's search request:
1. Use your google_search tool to research what kind of media items people typically search for
   related to the user's intent. This helps you understand the context and related concepts.
2. Based on the research findings, generate 3-5 diverse and specific search queries that would
   help find relevant media items.
3. Make queries diverse - cover different aspects, synonyms, related concepts, and variations.
4. Return ONLY a list of queries, one per line, without explanations or additional text.

Examples:
- User: "blue backgrounds"
  Research: Search for "blue background images photography"
  Generate:
    blue sky backgrounds
    ocean blue images
    blue gradient backgrounds
    cerulean blue photos
    navy blue backgrounds

- User: "team photos"
  Research: Search for "team photography corporate sports"
  Generate:
    team building photos
    corporate team portraits
    sports team images
    group team pictures
    professional team photography

- User: "product launch"
  Research: Search for "product launch marketing images"
  Generate:
    product launch event photos
    product announcement images
    launch campaign visuals
    new product marketing
    product reveal photography

IMPORTANT:
- Always use google_search first to research the user's intent
- Generate 3-5 queries (aim for 5 when possible)
- Make queries specific and diverse
- Return ONLY the queries, one per line, no explanations
- Focus on what would be useful for finding media in a library""",
        tools=[google_search]
    )

    logger.info("Query generation agent created successfully with google_search tool")
    return query_agent


# Singleton instance for reuse
_query_generation_agent_instance: Optional[LlmAgent] = None


def get_query_generation_agent() -> LlmAgent:
    """
    Get or create the singleton query generation agent instance.

    Returns:
        The query generation agent instance
    """
    global _query_generation_agent_instance
    if _query_generation_agent_instance is None:
        _query_generation_agent_instance = create_query_generation_agent()
    return _query_generation_agent_instance


def reset_query_generation_agent():
    """
    Reset the singleton query generation agent instance.
    Useful for testing to ensure clean state.
    """
    global _query_generation_agent_instance
    _query_generation_agent_instance = None


def generate_search_queries_sync(
    user_query: str,
    agent: Optional[LlmAgent] = None,
    runner=None,
    session_service=None,
    user_id: str = "default",
    session_id: Optional[str] = None
) -> List[str]:
    """
    Generate multiple search queries from a user's search request (synchronous version).

    This function uses the query generation agent to:
    1. Research user intent via Google Search
    2. Generate 3-5 diverse queries

    Args:
        user_query: The user's original search query
        agent: Optional agent instance (uses singleton if not provided)
        runner: Optional runner instance (required if agent provided)
        session_service: Optional session service (required if agent provided)
        user_id: User ID for session management
        session_id: Optional session ID (creates new if not provided)

    Returns:
        List of generated search queries (includes original query as first item)
    """
    try:
        import asyncio
        # Try to get existing event loop
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If loop is running, we can't block - return original query only
                logger.debug("Event loop is running, skipping query generation to avoid blocking")
                return [user_query]
            else:
                # Loop exists but not running - can use it
                return loop.run_until_complete(
                    generate_search_queries_async(
                        user_query=user_query,
                        agent=agent,
                        runner=runner,
                        session_service=session_service,
                        user_id=user_id,
                        session_id=session_id
                    )
                )
        except RuntimeError:
            # No event loop exists - create one
            try:
                return asyncio.run(
                    generate_search_queries_async(
                        user_query=user_query,
                        agent=agent,
                        runner=runner,
                        session_service=session_service,
                        user_id=user_id,
                        session_id=session_id
                    )
                )
            except Exception as run_error:
                logger.warning(f"Failed to run async query generation: {run_error}")
                return [user_query]
    except Exception as e:
        logger.error(f"Error in sync query generation wrapper: {e}", exc_info=True)
        return [user_query]


async def generate_search_queries_async(
    user_query: str,
    agent: Optional[LlmAgent] = None,
    runner=None,
    session_service=None,
    user_id: str = "default",
    session_id: Optional[str] = None
) -> List[str]:
    """
    Generate multiple search queries from a user's search request (async version).

    This function uses the query generation agent to:
    1. Research user intent via Google Search
    2. Generate 3-5 diverse queries

    Args:
        user_query: The user's original search query
        agent: Optional agent instance (uses singleton if not provided)
        runner: Optional runner instance (required if agent provided)
        session_service: Optional session service (required if agent provided)
        user_id: User ID for session management
        session_id: Optional session ID (creates new if not provided)

    Returns:
        List of generated search queries (includes original query as first item)
    """
    try:
        from google.genai import types
        from google.adk.runners import Runner
        from google.adk.sessions import InMemorySessionService

        # Use provided agent or get singleton
        query_agent = agent or get_query_generation_agent()

        # Use provided runner/session_service or create defaults
        if runner is None or session_service is None:
            if session_service is None:
                session_service = InMemorySessionService()
            if runner is None:
                runner = Runner(
                    app_name="momentum_query_generation",
                    agent=query_agent,
                    session_service=session_service,
                )

        # Create or use session
        if session_id is None:
            session = await session_service.create_session(
                app_name="momentum_query_generation",
                user_id=user_id,
            )
            session_id = session.id

        # Prepare the user's message
        content = types.Content(
            role='user',
            parts=[types.Part(text=user_query)]
        )

        # Run the agent to generate queries
        generated_queries = []
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=content
        ):
            if event.is_final_response():
                if event.content and event.content.parts:
                    response_text = event.content.parts[0].text
                    # Parse the response to extract queries
                    # Queries should be one per line
                    lines = response_text.strip().split('\n')
                    for line in lines:
                        line = line.strip()
                        # Remove numbering (1., 2., etc.) and bullets (-, *, etc.)
                        line = line.lstrip('0123456789.-* ').strip()
                        # Remove quotes if present
                        line = line.strip('"\'')
                        if line and len(line) > 2:  # Filter out very short lines
                            generated_queries.append(line)
                    break

        # Always include the original query as the first query
        # This ensures we don't lose the user's exact intent
        if user_query not in generated_queries:
            final_queries = [user_query] + generated_queries[:4]  # Original + up to 4 generated
        else:
            # If original is in generated, use generated but ensure original is first
            final_queries = [user_query] + [q for q in generated_queries if q != user_query][:4]

        # Limit to 5 queries total (original + 4 generated)
        final_queries = final_queries[:5]

        logger.info(f"Generated {len(final_queries)} search queries from '{user_query}': {final_queries}")

        return final_queries

    except Exception as e:
        logger.error(f"Error generating search queries: {e}", exc_info=True)
        # Fallback: return original query only
        logger.warning(f"Falling back to original query only: {user_query}")
        return [user_query]


# Alias for backward compatibility - use sync version by default
generate_search_queries = generate_search_queries_sync

