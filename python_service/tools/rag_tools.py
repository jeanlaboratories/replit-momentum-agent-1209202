"""
RAG (Retrieval-Augmented Generation) Tools

Tools for querying brand documents using Vertex AI RAG Engine.
These tools enable the Team Companion agent to answer questions
based on indexed brand documents.
"""

import logging
from typing import Dict, Any
from utils.context_utils import get_brand_context

logger = logging.getLogger(__name__)


def query_brand_documents(query: str, brand_id: str = "") -> Dict[str, Any]:
    """
    Query the brand's indexed documents using Vertex AI RAG Engine.

    Use this tool when the user asks questions about their brand documents,
    company information, uploaded files, or any information that should be
    retrieved from their indexed content.

    Examples of when to use this tool:
    - "What does our brand guide say about colors?"
    - "Find information about our product features"
    - "What are our company values?"
    - "Search our documents for pricing information"

    Args:
        query (str): The question or search query to find relevant information.
        brand_id (str): Brand ID for document retrieval. If empty, uses current context.

    Returns:
        dict: Contains 'answer' with AI-generated response based on retrieved documents,
              and 'contexts' with source information.
    """
    try:
        from services.rag_service import get_rag_service

        # Get brand ID from parameter or context
        effective_brand_id = brand_id or get_brand_context()

        if not effective_brand_id:
            error_text = "I need your brand context to search documents. Please make sure you're logged in."
            return {
                "status": "error",
                "error": "Brand ID required for document query. Please ensure user is authenticated.",
                "content": error_text,  # Primary text field for consistency
                "answer": error_text    # Backward compatibility
            }

        # Get RAG service and query
        rag_service = get_rag_service()
        result = rag_service.query(
            brand_id=effective_brand_id,
            query_text=query,
            top_k=5,
            distance_threshold=0.6
        )

        if result.contexts:
            # Standardized text response format:
            # - content: The main AI-generated text/markdown (for NDJSON streaming)
            # - answer: Same content for backward compatibility (RAG-specific)
            # - message: Summary message for status display
            summary_text = f"Found {len(result.contexts)} relevant document sections."
            return {
                "status": "success",
                "content": result.answer,   # Primary text field for consistency with agent
                "answer": result.answer,    # Backward compatibility (RAG-specific)
                "contexts": result.contexts,
                "sources_count": len(result.contexts),
                "message": summary_text
            }
        else:
            # Standardized text response format
            no_docs_text = "No indexed documents found. Try indexing some documents first."
            return {
                "status": "success",
                "content": result.answer,   # Primary text field for consistency with agent
                "answer": result.answer,    # Backward compatibility (RAG-specific)
                "contexts": [],
                "sources_count": 0,
                "message": no_docs_text
            }

    except ImportError as e:
        logger.error(f"RAG service not available: {e}")
        error_text = "The document search feature is not currently available."
        return {
            "status": "error",
            "error": "RAG service not available",
            "content": error_text,  # Primary text field for consistency
            "answer": error_text    # Backward compatibility
        }
    except Exception as e:
        logger.error(f"Error in query_brand_documents: {e}")
        error_text = f"Error searching documents: {str(e)}"
        return {
            "status": "error",
            "error": str(e),
            "content": error_text,  # Primary text field for consistency
            "answer": error_text    # Backward compatibility
        }


def index_brand_document(gcs_uri: str, brand_id: str = "") -> Dict[str, Any]:
    """
    Index a document from Google Cloud Storage into the brand's RAG corpus.

    Use this tool when the user wants to add a document to be searchable.
    The document must already be uploaded to GCS.

    Args:
        gcs_uri (str): GCS URI of the document (format: gs://bucket/path/file).
        brand_id (str): Brand ID for document indexing. If empty, uses current context.

    Returns:
        dict: Contains indexing status and result information.
    """
    try:
        from services.rag_service import get_rag_service

        # Get brand ID from parameter or context
        effective_brand_id = brand_id or get_brand_context()

        if not effective_brand_id:
            error_text = "Please ensure you're logged in to index documents."
            return {
                "status": "error",
                "error": "Brand ID required for document indexing.",
                "content": error_text,  # Primary text field for consistency
                "message": error_text   # Backward compatibility
            }

        if not gcs_uri.startswith("gs://"):
            error_text = "Document URI must start with 'gs://'"
            return {
                "status": "error",
                "error": "Invalid GCS URI format",
                "content": error_text,  # Primary text field for consistency
                "message": error_text   # Backward compatibility
            }

        # Get RAG service and index
        rag_service = get_rag_service()
        result = rag_service.index_document(
            brand_id=effective_brand_id,
            gcs_uri=gcs_uri,
            chunk_size=512,
            chunk_overlap=100
        )

        if result.success:
            # Standardized text response format
            return {
                "status": "success",
                "corpus_name": result.corpus_name,
                "files_indexed": result.files_indexed,
                "content": result.message,  # Primary text field for consistency
                "message": result.message   # Backward compatibility
            }
        else:
            error_text = f"Failed to index document: {result.message}"
            return {
                "status": "error",
                "error": result.message,
                "content": error_text,  # Primary text field for consistency
                "message": error_text   # Backward compatibility
            }

    except ImportError as e:
        logger.error(f"RAG service not available: {e}")
        error_text = "The document indexing feature is not currently available."
        return {
            "status": "error",
            "error": "RAG service not available",
            "content": error_text,  # Primary text field for consistency
            "message": error_text   # Backward compatibility
        }
    except Exception as e:
        logger.error(f"Error in index_brand_document: {e}")
        error_text = f"Error indexing document: {str(e)}"
        return {
            "status": "error",
            "error": str(e),
            "content": error_text,  # Primary text field for consistency
            "message": error_text   # Backward compatibility
        }
