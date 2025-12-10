# CRITICAL: Load .env FIRST before ANY other imports
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables IMMEDIATELY
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path, override=True)

# Verify it loaded (print to stdout, not logger which doesn't exist yet)
print(f"[STARTUP] Loaded .env from: {env_path}")
print(f"[STARTUP] MOMENTUM_ENABLE_MEMORY_BANK={os.getenv('MOMENTUM_ENABLE_MEMORY_BANK')}")

# NOW import everything else
import uvicorn
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials

# Import routers (after .env is loaded)
from routers import marketing, agent, session, media, memory, rag, search_settings, music
from services.adk_service import init_adk

# Initialize FastAPI app
app = FastAPI(title="AdVantage Python Service", version="1.0.0")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Log environment variable loading
logger.info(f"Loaded .env from: {env_path}")
logger.info(f"MOMENTUM_ENABLE_MEMORY_BANK={os.getenv('MOMENTUM_ENABLE_MEMORY_BANK')}")

# Initialize Firebase Admin SDK
try:
    if not firebase_admin._apps:
        # Try to use default credentials first (for Cloud Run)
        try:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred)
            logger.info("Initialized Firebase Admin with Application Default Credentials")
        except Exception as e:
            logger.warning(f"Could not initialize with default credentials: {e}")
            # Fallback to service account if available (for local development)
            service_account_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
            if service_account_path and os.path.exists(service_account_path):
                cred = credentials.Certificate(service_account_path)
                firebase_admin.initialize_app(cred)
                logger.info(f"Initialized Firebase Admin with service account: {service_account_path}")
            else:
                # Try initializing without credentials (might work if env vars are set)
                firebase_admin.initialize_app()
                logger.info("Initialized Firebase Admin with default settings")
except Exception as e:
    logger.error(f"Error initializing Firebase Admin: {e}")

# Initialize ADK Service
init_adk()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5000",
        "http://127.0.0.1:5000", 
        "http://0.0.0.0:5000",
        "https://*.replit.app",
        "https://*.replit.dev",
        "https://*.replit.com"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include routers
app.include_router(marketing.router)
app.include_router(agent.router)
app.include_router(session.router)
app.include_router(media.router)
app.include_router(memory.router)
app.include_router(rag.router)
app.include_router(search_settings.router)
app.include_router(music.router)

@app.get("/")
async def root():
    return {"message": "MOMENTUM Python Service is running"}

@app.get("/hello")
async def hello_world():
    return {"message": "Hello from MOMENTUM Python Service"}

if __name__ == "__main__":
    # Run on localhost only - Next.js will proxy requests to this service
    uvicorn.run(app, host="127.0.0.1", port=8000)