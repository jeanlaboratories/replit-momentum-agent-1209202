
import os
import asyncio
import logging
from google.adk.sessions import DatabaseSessionService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def inspect_service():
    db_path = "agent_sessions.db"
    db_url = f"sqlite:///{db_path}"
    service = DatabaseSessionService(db_url=db_url)
    
    print(f"Service attributes: {dir(service)}")
    
    # Create a dummy session to inspect session object
    session = await service.create_session(app_name="TEST", user_id="test_user")
    print(f"Session attributes: {dir(session)}")
    
    # Check if we can modify events
    if hasattr(session, 'events'):
        print(f"Session events type: {type(session.events)}")
        # Try to add a dummy event
        # session.events.append("test") 
        # await service.update_session(session) # Check if this exists
    
    if hasattr(service, 'update_session'):
        print("Has update_session method")
    else:
        print("No update_session method")

    # Clean up
    await service.delete_session(app_name="TEST", user_id="test_user", session_id=session.id)

if __name__ == "__main__":
    asyncio.run(inspect_service())
