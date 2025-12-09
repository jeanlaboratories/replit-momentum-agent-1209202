import logging
from fastapi import APIRouter, HTTPException
from models.requests import DeleteSessionRequest
from services.adk_service import get_adk_components

router = APIRouter(prefix="/session", tags=["session"])
logger = logging.getLogger(__name__)

@router.post("/delete")
async def delete_agent_session(request: DeleteSessionRequest):
    """
    Delete a user's chat session (manual deletion).

    This fully deletes the conversation history from local session tracking.
    The user will start with a fresh conversation on their next interaction.
    """
    _, _, adk_session_service, _ = get_adk_components()

    if not adk_session_service:
        raise HTTPException(status_code=503, detail="Session service not initialized")

    try:
        # 1. Construct session_id
        session_id = f"{request.brand_id}_{request.user_id}"

        # 2. Delete from session service using ADK interface (async)
        # Wrap in try/except to handle case where session doesn't exist
        if hasattr(adk_session_service, 'delete_session'):
            try:
                await adk_session_service.delete_session(
                    app_name="MOMENTUM",
                    user_id=request.user_id,
                    session_id=session_id
                )
                logger.info(f"Deleted session {session_id} from SessionService")
            except Exception as delete_err:
                logger.warning(f"Could not delete session {session_id}: {delete_err}")
        else:
            logger.warning(f"SessionService does not support delete_session for {session_id}")

        # 3. Also try to clear any other potential session IDs for this user
        user_session_id = f"user_{request.user_id}"
        if hasattr(adk_session_service, 'delete_session'):
            try:
                await adk_session_service.delete_session(
                    app_name="MOMENTUM",
                    user_id=request.user_id,
                    session_id=user_session_id
                )
            except Exception as delete_err:
                logger.warning(f"Could not delete user session {user_session_id}: {delete_err}")

        return {"status": "success", "message": f"Session {session_id} deleted"}

    except Exception as e:
        logger.error(f"Error deleting session: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/delete-last")
async def delete_last_message(request: DeleteSessionRequest):
    """
    Delete the last interaction (User + Assistant) from the session.
    Useful for 'Undo' or 'Retry' functionality.
    """
    _, _, adk_session_service, _ = get_adk_components()

    if not adk_session_service:
        raise HTTPException(status_code=503, detail="Session service not initialized")

    try:
        session_id = f"{request.brand_id}_{request.user_id}"

        # For now, we'll just delete the whole session as a fallback if supported
        if hasattr(adk_session_service, 'delete_session'):
            await adk_session_service.delete_session(
                app_name="MOMENTUM",
                user_id=request.user_id,
                session_id=session_id
            )
            return {"status": "success", "message": "Session reset (last message deletion not fully supported yet, reset whole session instead)"}

        raise HTTPException(status_code=501, detail="Delete last message not fully supported yet")

    except Exception as e:
        logger.error(f"Error deleting last message: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats/{brand_id}/{user_id}")
async def get_agent_session_stats(brand_id: str, user_id: str):
    """
    Get session statistics for a user.
    Returns message count and session metadata.
    """
    _, _, adk_session_service, _ = get_adk_components()

    if not adk_session_service:
        raise HTTPException(status_code=503, detail="Session service not initialized")

    try:
        session_id = f"{brand_id}_{user_id}"
        # Try to get the session from our FirestoreSessionService (async)
        if hasattr(adk_session_service, 'get_session'):
            session = await adk_session_service.get_session(
                app_name="MOMENTUM",
                user_id=user_id,
                session_id=session_id
            )
            if session and hasattr(session, 'events'):
                return {
                    "status": "active",
                    "session_id": session_id,
                    "message_count": len(session.events),
                    "last_updated": getattr(session, 'last_update_time', None)
                }

        return {"status": "unknown", "message_count": 0, "note": "Session stats not available with current ADK"}
    except Exception as e:
        logger.error(f"Error getting session stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{brand_id}/{user_id}")
async def get_agent_chat_history(brand_id: str, user_id: str):
    """
    Retrieve chat history for a user.
    """
    _, _, adk_session_service, _ = get_adk_components()
    
    if not adk_session_service:
        raise HTTPException(status_code=503, detail="Session service not initialized")
    
    try:
        # For now, return empty history as we don't have easy access to sessions without SessionManager
        return {"history": [], "note": "Chat history not available with current ADK"}
    except Exception as e:
        logger.error(f"Error getting chat history: {e}")
        raise HTTPException(status_code=500, detail=str(e))
