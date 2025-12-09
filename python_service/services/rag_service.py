"""
Vertex AI RAG Engine Service

This service provides document indexing and retrieval capabilities using
Vertex AI RAG Engine for the MOMENTUM platform.

Features:
- Create and manage RAG corpora per brand
- Import documents from GCS into corpora
- Query documents using semantic search
- Integrate with Gemini for RAG-augmented generation
"""

import os
import logging
import re
from urllib.parse import urlparse, unquote
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

import vertexai
from vertexai import rag

logger = logging.getLogger(__name__)

# Configuration
PROJECT_ID = os.getenv('MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID') or os.getenv('GOOGLE_CLOUD_PROJECT')
LOCATION = os.getenv('MOMENTUM_RAG_LOCATION', 'us-west1')
EMBEDDING_MODEL = "publishers/google/models/text-embedding-005"

# In-memory corpus cache (corpus_name -> corpus resource name)
_corpus_cache: Dict[str, str] = {}


def convert_to_gcs_uri(url: str) -> str:
    """
    Convert a Firebase Storage signed URL or HTTP URL to a gs:// URI.

    Firebase Storage URLs come in several formats:
    1. gs://bucket/path - Already a GCS URI, return as-is
    2. https://storage.googleapis.com/bucket/path?params - Standard GCS URL
    3. https://firebasestorage.googleapis.com/v0/b/bucket/o/path - Firebase API URL

    Args:
        url: The URL to convert

    Returns:
        A gs:// URI suitable for Vertex AI RAG Engine
    """
    # Already a gs:// URI
    if url.startswith('gs://'):
        return url

    # Parse the URL
    parsed = urlparse(url)

    # Handle storage.googleapis.com URLs
    # Format: https://storage.googleapis.com/bucket-name/path/to/file?query_params
    if parsed.netloc == 'storage.googleapis.com':
        # Path starts with /bucket-name/path/to/file
        # Remove leading slash and split to get bucket and path
        path = unquote(parsed.path.lstrip('/'))
        parts = path.split('/', 1)
        if len(parts) >= 2:
            bucket = parts[0]
            object_path = parts[1]
            gcs_uri = f"gs://{bucket}/{object_path}"
            logger.info(f"Converted storage.googleapis.com URL to GCS URI: {gcs_uri}")
            return gcs_uri
        elif len(parts) == 1:
            # Just bucket, no path
            return f"gs://{parts[0]}"

    # Handle firebasestorage.googleapis.com URLs (less common in our case)
    # Format: https://firebasestorage.googleapis.com/v0/b/bucket-name/o/encoded%2Fpath?alt=media&token=xxx
    if 'firebasestorage.googleapis.com' in parsed.netloc:
        # Extract bucket from path: /v0/b/bucket-name/o/path
        match = re.match(r'/v0/b/([^/]+)/o/(.+)', parsed.path)
        if match:
            bucket = match.group(1)
            # The path is URL-encoded
            object_path = unquote(match.group(2))
            gcs_uri = f"gs://{bucket}/{object_path}"
            logger.info(f"Converted firebasestorage URL to GCS URI: {gcs_uri}")
            return gcs_uri

    # If we can't parse it, log a warning and return as-is
    # This will likely fail in the RAG API, but at least we tried
    logger.warning(f"Could not convert URL to GCS URI format: {url[:100]}...")
    return url


@dataclass
class RAGQueryResult:
    """Result from a RAG query."""
    answer: str
    contexts: List[Dict[str, Any]]
    corpus_name: str


@dataclass
class RAGIndexResult:
    """Result from indexing documents."""
    success: bool
    corpus_name: str
    files_indexed: int
    message: str


class RAGService:
    """
    Vertex AI RAG Engine Service for document indexing and retrieval.

    This service creates per-brand RAG corpora and enables semantic search
    over brand documents.
    """

    def __init__(self, project_id: Optional[str] = None, location: Optional[str] = None):
        """
        Initialize the RAG service.

        Args:
            project_id: GCP project ID. Defaults to environment variable.
            location: GCP location. Defaults to us-west1 (GA region for RAG Engine).
        """
        self.project_id = project_id or PROJECT_ID
        self.location = location or LOCATION

        if not self.project_id:
            logger.warning("No GCP project ID configured for RAG service")
            return

        # Initialize Vertex AI
        try:
            vertexai.init(project=self.project_id, location=self.location)
            logger.info(f"RAG Service initialized: project={self.project_id}, location={self.location}")
        except Exception as e:
            logger.error(f"Failed to initialize Vertex AI: {e}")

    def _get_corpus_name(self, brand_id: str) -> str:
        """Generate a corpus name for a brand."""
        return f"momentum-brand-{brand_id}"

    def _get_or_create_corpus(self, brand_id: str) -> Optional[str]:
        """
        Get existing corpus or create a new one for the brand.

        Args:
            brand_id: Brand ID to get/create corpus for.

        Returns:
            Corpus resource name or None if failed.
        """
        corpus_display_name = self._get_corpus_name(brand_id)

        # Check cache first
        if corpus_display_name in _corpus_cache:
            return _corpus_cache[corpus_display_name]

        try:
            # Try to find existing corpus
            corpora = rag.list_corpora()
            for corpus in corpora:
                if corpus.display_name == corpus_display_name:
                    logger.info(f"Found existing corpus: {corpus.name}")
                    _corpus_cache[corpus_display_name] = corpus.name
                    return corpus.name

            # Create new corpus with embedding model config
            logger.info(f"Creating new corpus for brand: {brand_id}")
            embedding_model_config = rag.RagEmbeddingModelConfig(
                vertex_prediction_endpoint=rag.VertexPredictionEndpoint(
                    publisher_model=EMBEDDING_MODEL
                )
            )

            new_corpus = rag.create_corpus(
                display_name=corpus_display_name,
                description=f"RAG corpus for MOMENTUM brand {brand_id}",
                backend_config=rag.RagVectorDbConfig(
                    rag_embedding_model_config=embedding_model_config
                ),
            )

            logger.info(f"Created new corpus: {new_corpus.name}")
            _corpus_cache[corpus_display_name] = new_corpus.name
            return new_corpus.name

        except Exception as e:
            logger.error(f"Error getting/creating corpus for brand {brand_id}: {e}")
            return None

    def index_document(
        self,
        brand_id: str,
        gcs_uri: str,
        chunk_size: int = 512,
        chunk_overlap: int = 100
    ) -> RAGIndexResult:
        """
        Index a document from GCS into the brand's RAG corpus.

        Args:
            brand_id: Brand ID to index document for.
            gcs_uri: GCS URI of the document (gs://bucket/path/file).
            chunk_size: Size of text chunks for indexing.
            chunk_overlap: Overlap between chunks.

        Returns:
            RAGIndexResult with indexing status.
        """
        if not self.project_id:
            return RAGIndexResult(
                success=False,
                corpus_name="",
                files_indexed=0,
                message="RAG service not configured: missing project ID"
            )

        try:
            # Get or create corpus for the brand
            corpus_name = self._get_or_create_corpus(brand_id)
            if not corpus_name:
                return RAGIndexResult(
                    success=False,
                    corpus_name="",
                    files_indexed=0,
                    message="Failed to get or create corpus"
                )

            # Convert URL to proper gs:// URI if needed
            converted_uri = convert_to_gcs_uri(gcs_uri)

            # Import the file into the corpus
            logger.info(f"Importing document {converted_uri} into corpus {corpus_name}")

            import_response = rag.import_files(
                corpus_name,
                [converted_uri],
                transformation_config=rag.TransformationConfig(
                    chunking_config=rag.ChunkingConfig(
                        chunk_size=chunk_size,
                        chunk_overlap=chunk_overlap,
                    ),
                ),
                max_embedding_requests_per_min=1000,
            )

            # Check import result
            files_imported = import_response.imported_rag_files_count if hasattr(import_response, 'imported_rag_files_count') else 1

            logger.info(f"Successfully indexed {files_imported} file(s) into corpus")
            return RAGIndexResult(
                success=True,
                corpus_name=corpus_name,
                files_indexed=files_imported,
                message=f"Successfully indexed document into RAG corpus"
            )

        except Exception as e:
            logger.error(f"Error indexing document: {e}")
            return RAGIndexResult(
                success=False,
                corpus_name="",
                files_indexed=0,
                message=f"Failed to index document: {str(e)}"
            )

    def query(
        self,
        brand_id: str,
        query_text: str,
        top_k: int = 5,
        distance_threshold: float = 0.5
    ) -> RAGQueryResult:
        """
        Query the brand's RAG corpus for relevant information.

        Args:
            brand_id: Brand ID to query.
            query_text: The query text.
            top_k: Number of top results to return.
            distance_threshold: Maximum vector distance for results.

        Returns:
            RAGQueryResult with retrieved contexts and generated answer.
        """
        if not self.project_id:
            return RAGQueryResult(
                answer="RAG service not configured",
                contexts=[],
                corpus_name=""
            )

        try:
            # Get corpus for the brand
            corpus_name = self._get_or_create_corpus(brand_id)
            if not corpus_name:
                return RAGQueryResult(
                    answer="No RAG corpus found for this brand. Please index some documents first.",
                    contexts=[],
                    corpus_name=""
                )

            # Configure retrieval
            retrieval_config = rag.RagRetrievalConfig(
                top_k=top_k,
                filter=rag.Filter(vector_distance_threshold=distance_threshold),
            )

            # Perform retrieval query
            logger.info(f"Querying corpus {corpus_name} with: {query_text[:100]}...")
            response = rag.retrieval_query(
                text=query_text,
                rag_resources=[
                    rag.RagResource(rag_corpus=corpus_name)
                ],
                rag_retrieval_config=retrieval_config,
            )

            # Extract contexts from response
            contexts = []
            context_texts = []

            if hasattr(response, 'contexts') and response.contexts:
                for ctx in response.contexts.contexts:
                    context_data = {
                        "text": ctx.text if hasattr(ctx, 'text') else str(ctx),
                        "source": ctx.source_uri if hasattr(ctx, 'source_uri') else "unknown",
                        "score": ctx.score if hasattr(ctx, 'score') else 0.0
                    }
                    contexts.append(context_data)
                    context_texts.append(context_data["text"])

            # Generate answer based on contexts
            if context_texts:
                answer = self._generate_answer(query_text, context_texts)
            else:
                answer = "No relevant information found in the indexed documents for your query."

            return RAGQueryResult(
                answer=answer,
                contexts=contexts,
                corpus_name=corpus_name
            )

        except Exception as e:
            logger.error(f"Error querying RAG corpus: {e}")
            return RAGQueryResult(
                answer=f"Error querying documents: {str(e)}",
                contexts=[],
                corpus_name=""
            )

    def _generate_answer(self, query: str, contexts: List[str]) -> str:
        """
        Generate an answer using Gemini with retrieved contexts.

        Args:
            query: User's query.
            contexts: Retrieved context texts.

        Returns:
            Generated answer string.
        """
        try:
            from google import genai

            # Use the centralized model configuration
            model_name = os.getenv('MOMENTUM_DEFAULT_TEXT_MODEL', 'gemini-2.0-flash')

            client = genai.Client(
                vertexai=True,
                project=self.project_id,
                location=self.location
            )

            # Build prompt with contexts
            context_text = "\n\n---\n\n".join(contexts)
            prompt = f"""Based on the following documents, answer the user's question.
If the documents don't contain relevant information, say so.

DOCUMENTS:
{context_text}

USER QUESTION: {query}

ANSWER:"""

            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )

            return response.text

        except Exception as e:
            logger.error(f"Error generating answer: {e}")
            # Fall back to just returning contexts
            return "Based on the indexed documents:\n\n" + "\n\n".join(contexts[:3])

    def list_corpora(self) -> List[Dict[str, Any]]:
        """
        List all RAG corpora in the project.

        Returns:
            List of corpus information dictionaries.
        """
        if not self.project_id:
            return []

        try:
            corpora = rag.list_corpora()
            result = []
            for corpus in corpora:
                result.append({
                    "name": corpus.name,
                    "display_name": corpus.display_name,
                    "description": corpus.description if hasattr(corpus, 'description') else None
                })
            return result
        except Exception as e:
            logger.error(f"Error listing corpora: {e}")
            return []

    def delete_corpus(self, brand_id: str) -> bool:
        """
        Delete a brand's RAG corpus.

        Args:
            brand_id: Brand ID whose corpus to delete.

        Returns:
            True if deleted successfully, False otherwise.
        """
        if not self.project_id:
            return False

        try:
            corpus_display_name = self._get_corpus_name(brand_id)

            # Find the corpus
            corpora = rag.list_corpora()
            for corpus in corpora:
                if corpus.display_name == corpus_display_name:
                    rag.delete_corpus(corpus.name)
                    # Remove from cache
                    if corpus_display_name in _corpus_cache:
                        del _corpus_cache[corpus_display_name]
                    logger.info(f"Deleted corpus: {corpus.name}")
                    return True

            logger.warning(f"Corpus not found for brand: {brand_id}")
            return False

        except Exception as e:
            logger.error(f"Error deleting corpus: {e}")
            return False


# Singleton instance
_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    """Get the singleton RAG service instance."""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
