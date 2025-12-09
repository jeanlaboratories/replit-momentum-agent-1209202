import os
import logging
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from momentum_agent import get_agent

logger = logging.getLogger(__name__)

adk_agent = None
adk_runner = None
adk_session_service = None

def init_adk():
    global adk_agent, adk_runner, adk_session_service
    try:
        # Get API key from environment
        api_key = os.getenv('MOMENTUM_GOOGLE_API_KEY')
        project_id = os.getenv('MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID')

        if not api_key:
            logger.warning("MOMENTUM_GOOGLE_API_KEY not set, ADK agent will not work")
            return

        # Set environment variables for ADK
        os.environ['GOOGLE_API_KEY'] = api_key
        if project_id:
            os.environ['GOOGLE_CLOUD_PROJECT'] = project_id

        # Initialize Agent
        adk_agent = get_agent()

        # Initialize Session Service
        # Use InMemorySessionService for now - it's simpler and works reliably
        # Chat history is persisted separately in Firestore via chat-history API
        adk_session_service = InMemorySessionService()
        logger.info("Initialized InMemorySessionService for ADK")

        # Initialize Runner
        adk_runner = Runner(
            app_name='MOMENTUM',
            agent=adk_agent,
            session_service=adk_session_service
        )

        logger.info("ADK Agent and Runner initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize ADK components: {e}")
        import traceback
        logger.error(traceback.format_exc())

def get_adk_components():
    """Returns the initialized ADK components."""
    return adk_agent, adk_runner, adk_session_service, None # Return None for session_manager
