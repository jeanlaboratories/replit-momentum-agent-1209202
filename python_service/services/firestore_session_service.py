import logging
from typing import Optional, Any
from google.adk.sessions import BaseSessionService, Session
from google.adk.sessions.base_session_service import ListSessionsResponse, GetSessionConfig
from google.adk.events import Event
from firebase_admin import firestore

logger = logging.getLogger(__name__)

class FirestoreSessionService(BaseSessionService):
    """Firestore-backed session service for ADK Agent.

    All methods are async to match the ADK BaseSessionService interface.
    """

    def __init__(self, collection_name: str = "adk_sessions"):
        self.collection_name = collection_name
        self._db = None

    @property
    def db(self):
        if self._db is None:
            self._db = firestore.client()
        return self._db

    def _get_doc_id(self, app_name: str, user_id: str, session_id: str) -> str:
        """Generate a unique document ID from the session identifiers."""
        return f"{app_name}_{user_id}_{session_id}"

    async def get_session(
        self,
        *,
        app_name: str,
        user_id: str,
        session_id: str,
        config: Optional[GetSessionConfig] = None
    ) -> Optional[Session]:
        """Get a session from Firestore. Creates it if it doesn't exist."""
        logger.info(f"get_session called: app_name={app_name}, user_id={user_id}, session_id={session_id}")
        try:
            doc_id = self._get_doc_id(app_name, user_id, session_id)
            logger.info(f"Looking up document: {doc_id}")
            doc_ref = self.db.collection(self.collection_name).document(doc_id)
            doc = doc_ref.get()

            if doc.exists:
                data = doc.to_dict()
                logger.info(f"Found existing session: {session_id}")
                session = Session(
                    id=session_id,
                    app_name=app_name,
                    user_id=user_id,
                    state=data.get('state', {}),
                    last_update_time=data.get('last_update_time', 0.0)
                )
                return session

            # Session doesn't exist - create it automatically
            # ADK Runner expects session to exist, so we create on first access
            logger.info(f"Session {session_id} not found in Firestore, creating new session for user {user_id}")
            new_session = await self.create_session(
                app_name=app_name,
                user_id=user_id,
                session_id=session_id
            )
            logger.info(f"Created new session: {new_session.id if new_session else 'None'}")
            return new_session
        except Exception as e:
            logger.error(f"Error getting session from Firestore: {e}")
            import traceback
            logger.error(traceback.format_exc())
            # Don't return None - try to create a session anyway
            try:
                logger.info(f"Attempting to create session after error")
                return await self.create_session(
                    app_name=app_name,
                    user_id=user_id,
                    session_id=session_id
                )
            except Exception as e2:
                logger.error(f"Failed to create session after error: {e2}")
                return None

    async def create_session(
        self,
        *,
        app_name: str,
        user_id: str,
        state: Optional[dict[str, Any]] = None,
        session_id: Optional[str] = None
    ) -> Session:
        """Create a new session in Firestore."""
        import uuid

        if session_id is None:
            session_id = str(uuid.uuid4())

        session = Session(
            id=session_id,
            app_name=app_name,
            user_id=user_id,
            state=state or {}
        )

        try:
            doc_id = self._get_doc_id(app_name, user_id, session_id)
            doc_ref = self.db.collection(self.collection_name).document(doc_id)
            doc_ref.set({
                'session_id': session_id,
                'app_name': app_name,
                'user_id': user_id,
                'state': session.state,
                'last_update_time': firestore.SERVER_TIMESTAMP,
                'created_at': firestore.SERVER_TIMESTAMP
            })
            logger.info(f"Created session {session_id} for user {user_id}")
        except Exception as e:
            logger.error(f"Error creating session in Firestore: {e}")

        return session

    async def delete_session(
        self,
        *,
        app_name: str,
        user_id: str,
        session_id: str
    ) -> None:
        """Delete a session from Firestore."""
        try:
            doc_id = self._get_doc_id(app_name, user_id, session_id)
            self.db.collection(self.collection_name).document(doc_id).delete()
            logger.info(f"Deleted session {session_id}")
        except Exception as e:
            logger.error(f"Error deleting session from Firestore: {e}")

    async def list_sessions(
        self,
        *,
        app_name: str,
        user_id: Optional[str] = None
    ) -> ListSessionsResponse:
        """List sessions from Firestore."""
        try:
            query = self.db.collection(self.collection_name).where('app_name', '==', app_name)
            if user_id:
                query = query.where('user_id', '==', user_id)

            docs = query.stream()
            sessions = []
            for doc in docs:
                data = doc.to_dict()
                session = Session(
                    id=data.get('session_id', doc.id),
                    app_name=data.get('app_name', app_name),
                    user_id=data.get('user_id', ''),
                    state=data.get('state', {}),
                    last_update_time=data.get('last_update_time', 0.0)
                )
                sessions.append(session)
            return ListSessionsResponse(sessions=sessions)
        except Exception as e:
            logger.error(f"Error listing sessions from Firestore: {e}")
            return ListSessionsResponse(sessions=[])

    async def append_event(self, session: Session, event: Event) -> Event:
        """Append an event to a session. Called by ADK after each interaction."""
        try:
            doc_id = self._get_doc_id(session.app_name, session.user_id, session.id)
            doc_ref = self.db.collection(self.collection_name).document(doc_id)

            # Update last_update_time and state
            doc_ref.set({
                'state': session.state,
                'last_update_time': firestore.SERVER_TIMESTAMP
            }, merge=True)
        except Exception as e:
            logger.error(f"Error appending event to session: {e}")

        return event
