import logging
from fastapi import APIRouter, HTTPException
from models.requests import ChatRequest, DomainRequest, WebsiteRequest, MarketingRequest, LogoRequest, ColorRequest

router = APIRouter(prefix="/marketing", tags=["marketing"])
logger = logging.getLogger(__name__)

# Initialize marketing agent (will be None if no API key or missing dependencies)
marketing_agent = None
try:
    from marketing_agent import MarketingAgent
    marketing_agent = MarketingAgent()
    logger.info("Marketing agent initialized successfully")
except ImportError as e:
    logger.warning(f"Marketing agent not available (missing dependencies): {e}")
except Exception as e:
    logger.warning(f"Marketing agent initialization failed: {e}")

@router.get("/info")
async def get_agent_info():
    """Get information about the marketing agent"""
    if not marketing_agent:
        raise HTTPException(status_code=503, detail="Marketing agent not initialized")
    return {"name": "MOMENTUM Marketing Coordinator", "version": "1.0.0"}

@router.post("/chat")
async def chat_with_agent(request: ChatRequest):
    """Chat with the marketing coordinator agent"""
    if not marketing_agent:
        raise HTTPException(status_code=503, detail="Marketing agent not initialized")
    try:
        response = marketing_agent.chat(request.message, request.context)
        return {"response": response}
    except Exception as e:
        logger.error(f"Error in chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/domains")
async def suggest_domains(request: DomainRequest):
    """Get domain name suggestions"""
    if not marketing_agent:
        raise HTTPException(status_code=503, detail="Marketing agent not initialized")
    try:
        domains = marketing_agent.suggest_domains(request.keywords, request.business_type)
        return {"domains": domains}
    except Exception as e:
        logger.error(f"Error suggesting domains: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/website-plan")
async def create_website_plan(request: WebsiteRequest):
    """Create a website plan"""
    if not marketing_agent:
        raise HTTPException(status_code=503, detail="Marketing agent not initialized")
    try:
        plan = marketing_agent.create_website_plan(request.domain, request.business_info.dict())
        return {"plan": plan}
    except Exception as e:
        logger.error(f"Error creating website plan: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/marketing-strategy")
async def create_marketing_strategy(request: MarketingRequest):
    """Create a marketing strategy"""
    if not marketing_agent:
        raise HTTPException(status_code=503, detail="Marketing agent not initialized")
    try:
        strategy = marketing_agent.create_marketing_strategy(request.business_info.dict())
        return {"strategy": strategy}
    except Exception as e:
        logger.error(f"Error creating marketing strategy: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/logo-concepts")
async def create_logo_concepts(request: LogoRequest):
    """Create logo design concepts"""
    if not marketing_agent:
        raise HTTPException(status_code=503, detail="Marketing agent not initialized")
    try:
        concepts = marketing_agent.create_logo_concepts(request.business_info.dict())
        return {"concepts": concepts}
    except Exception as e:
        logger.error(f"Error creating logo concepts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/extract-colors")
async def extract_colors(request: ColorRequest):
    """Extract dominant colors from an image URL"""
    if not marketing_agent:
        raise HTTPException(status_code=503, detail="Marketing agent not initialized")
    try:
        colors = marketing_agent.extract_colors(request.screenshot_url, request.num_colors)
        return {"colors": colors}
    except Exception as e:
        logger.error(f"Error extracting colors: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_agent_status():
    """Check if the marketing agent is available"""
    if marketing_agent:
        return {"status": "available", "model": "gemini-1.5-flash"}
    return {"status": "unavailable", "reason": "API key missing"}
