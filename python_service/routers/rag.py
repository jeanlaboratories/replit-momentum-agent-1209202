"""
RAG (Retrieval-Augmented Generation) Router

Provides API endpoints for document indexing and querying using Vertex AI RAG Engine.
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from services.rag_service import get_rag_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rag", tags=["rag"])


class IndexRequest(BaseModel):
    """Request body for indexing a document."""
    brand_id: str
    gcs_uri: str
    document_id: Optional[str] = None
    chunk_size: Optional[int] = 512
    chunk_overlap: Optional[int] = 100


class IndexResponse(BaseModel):
    """Response body for indexing."""
    status: str
    corpus_name: Optional[str] = None
    files_indexed: int = 0
    message: str
    error: Optional[str] = None


class QueryRequest(BaseModel):
    """Request body for querying documents."""
    brand_id: str
    query: str
    top_k: Optional[int] = 5
    distance_threshold: Optional[float] = 0.6


class QueryResponse(BaseModel):
    """Response body for queries."""
    status: str
    answer: str
    contexts: List[Dict[str, Any]] = []
    sources_count: int = 0
    message: str
    error: Optional[str] = None


@router.post("/index", response_model=IndexResponse)
async def index_document(request: IndexRequest):
    """
    Index a document from GCS into the brand's RAG corpus.

    The document will be processed, chunked, and indexed using Vertex AI RAG Engine
    for semantic search capabilities.

    Args:
        request: IndexRequest containing brand_id and gcs_uri

    Returns:
        IndexResponse with indexing status
    """
    logger.info(f"[RAG Router] Index request: brand_id={request.brand_id}, gcs_uri={request.gcs_uri}")

    try:
        rag_service = get_rag_service()
        result = rag_service.index_document(
            brand_id=request.brand_id,
            gcs_uri=request.gcs_uri,
            chunk_size=request.chunk_size or 512,
            chunk_overlap=request.chunk_overlap or 100
        )

        if result.success:
            return IndexResponse(
                status="success",
                corpus_name=result.corpus_name,
                files_indexed=result.files_indexed,
                message=result.message
            )
        else:
            return IndexResponse(
                status="error",
                files_indexed=0,
                message=result.message,
                error=result.message
            )

    except Exception as e:
        logger.error(f"[RAG Router] Index error: {e}")
        return IndexResponse(
            status="error",
            files_indexed=0,
            message=f"Failed to index document: {str(e)}",
            error=str(e)
        )


@router.post("/query", response_model=QueryResponse)
async def query_documents(request: QueryRequest):
    """
    Query the brand's indexed documents using semantic search.

    Uses Vertex AI RAG Engine to find relevant document chunks and
    generate an AI-powered answer based on the retrieved content.

    Args:
        request: QueryRequest containing brand_id and query text

    Returns:
        QueryResponse with AI-generated answer and source contexts
    """
    logger.info(f"[RAG Router] Query request: brand_id={request.brand_id}, query={request.query[:100]}...")

    try:
        rag_service = get_rag_service()
        result = rag_service.query(
            brand_id=request.brand_id,
            query_text=request.query,
            top_k=request.top_k or 5,
            distance_threshold=request.distance_threshold or 0.6
        )

        return QueryResponse(
            status="success",
            answer=result.answer,
            contexts=result.contexts,
            sources_count=len(result.contexts),
            message="Query completed successfully"
        )

    except Exception as e:
        logger.error(f"[RAG Router] Query error: {e}")
        return QueryResponse(
            status="error",
            answer=f"Error querying documents: {str(e)}",
            contexts=[],
            sources_count=0,
            message=f"Query failed: {str(e)}",
            error=str(e)
        )


@router.get("/corpora")
async def list_corpora():
    """
    List all RAG corpora in the project.

    Returns:
        List of corpus information
    """
    try:
        rag_service = get_rag_service()
        corpora = rag_service.list_corpora()
        return {
            "status": "success",
            "corpora": corpora,
            "count": len(corpora)
        }
    except Exception as e:
        logger.error(f"[RAG Router] List corpora error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/corpus/{brand_id}")
async def delete_corpus(brand_id: str):
    """
    Delete a brand's RAG corpus.

    Args:
        brand_id: Brand ID whose corpus to delete

    Returns:
        Deletion status
    """
    try:
        rag_service = get_rag_service()
        success = rag_service.delete_corpus(brand_id)

        if success:
            return {
                "status": "success",
                "message": f"Corpus deleted for brand {brand_id}"
            }
        else:
            return {
                "status": "error",
                "message": f"Corpus not found for brand {brand_id}"
            }
    except Exception as e:
        logger.error(f"[RAG Router] Delete corpus error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def rag_health():
    """
    Check RAG service health.

    Returns:
        Health status of the RAG service
    """
    try:
        rag_service = get_rag_service()
        has_project = bool(rag_service.project_id)

        return {
            "status": "healthy" if has_project else "degraded",
            "project_configured": has_project,
            "project_id": rag_service.project_id or "not configured",
            "location": rag_service.location
        }
    except Exception as e:
        logger.error(f"[RAG Router] Health check error: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }
