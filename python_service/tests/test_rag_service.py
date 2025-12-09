"""
Tests for the Vertex AI RAG Engine Service
"""

import unittest
from unittest.mock import patch, MagicMock
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestRAGService(unittest.TestCase):
    """Test cases for the RAG service."""

    def setUp(self):
        """Set up test fixtures."""
        # Mock environment variables
        self.env_patcher = patch.dict(os.environ, {
            'MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID': 'test-project',
            'MOMENTUM_RAG_LOCATION': 'us-west1'
        })
        self.env_patcher.start()

    def tearDown(self):
        """Clean up after tests."""
        self.env_patcher.stop()

    @patch('services.rag_service.vertexai')
    @patch('services.rag_service.rag')
    def test_service_initialization(self, mock_rag, mock_vertexai):
        """Test RAG service initializes correctly."""
        from services.rag_service import RAGService

        service = RAGService(project_id='test-project', location='us-west1')

        self.assertEqual(service.project_id, 'test-project')
        self.assertEqual(service.location, 'us-west1')
        mock_vertexai.init.assert_called_once_with(
            project='test-project',
            location='us-west1'
        )

    @patch('services.rag_service.vertexai')
    @patch('services.rag_service.rag')
    def test_get_corpus_name(self, mock_rag, mock_vertexai):
        """Test corpus name generation."""
        from services.rag_service import RAGService

        service = RAGService(project_id='test-project', location='us-west1')
        corpus_name = service._get_corpus_name('brand-123')

        self.assertEqual(corpus_name, 'momentum-brand-brand-123')

    @patch('services.rag_service.vertexai')
    @patch('services.rag_service.rag')
    def test_index_document_missing_project(self, mock_rag, mock_vertexai):
        """Test index returns error when project not configured."""
        from services.rag_service import RAGService

        # Create service with no project
        service = RAGService.__new__(RAGService)
        service.project_id = None
        service.location = 'us-west1'

        result = service.index_document(
            brand_id='brand-123',
            gcs_uri='gs://test-bucket/test.pdf'
        )

        self.assertFalse(result.success)
        self.assertIn('not configured', result.message)

    @patch('services.rag_service.vertexai')
    @patch('services.rag_service.rag')
    def test_query_missing_project(self, mock_rag, mock_vertexai):
        """Test query returns error when project not configured."""
        from services.rag_service import RAGService

        # Create service with no project
        service = RAGService.__new__(RAGService)
        service.project_id = None
        service.location = 'us-west1'

        result = service.query(
            brand_id='brand-123',
            query_text='What is in the document?'
        )

        self.assertEqual(result.answer, 'RAG service not configured')
        self.assertEqual(result.contexts, [])

    @patch('services.rag_service.vertexai')
    @patch('services.rag_service.rag')
    def test_get_or_create_corpus_existing(self, mock_rag, mock_vertexai):
        """Test getting existing corpus."""
        from services.rag_service import RAGService

        # Mock existing corpus
        mock_corpus = MagicMock()
        mock_corpus.display_name = 'momentum-brand-brand-123'
        mock_corpus.name = 'projects/test/locations/us-west1/ragCorpora/123'
        mock_rag.list_corpora.return_value = [mock_corpus]

        service = RAGService(project_id='test-project', location='us-west1')
        result = service._get_or_create_corpus('brand-123')

        self.assertEqual(result, 'projects/test/locations/us-west1/ragCorpora/123')
        mock_rag.create_corpus.assert_not_called()

    @patch('services.rag_service.vertexai')
    @patch('services.rag_service.rag')
    def test_get_or_create_corpus_new(self, mock_rag, mock_vertexai):
        """Test creating new corpus when none exists."""
        from services.rag_service import RAGService

        # Mock no existing corpus
        mock_rag.list_corpora.return_value = []

        # Mock corpus creation
        mock_new_corpus = MagicMock()
        mock_new_corpus.name = 'projects/test/locations/us-west1/ragCorpora/new-123'
        mock_rag.create_corpus.return_value = mock_new_corpus

        service = RAGService(project_id='test-project', location='us-west1')
        result = service._get_or_create_corpus('brand-456')

        self.assertEqual(result, 'projects/test/locations/us-west1/ragCorpora/new-123')
        mock_rag.create_corpus.assert_called_once()

    @patch('services.rag_service.vertexai')
    @patch('services.rag_service.rag')
    def test_index_document_success(self, mock_rag, mock_vertexai):
        """Test successful document indexing."""
        from services.rag_service import RAGService

        # Mock corpus
        mock_corpus = MagicMock()
        mock_corpus.display_name = 'momentum-brand-brand-123'
        mock_corpus.name = 'projects/test/locations/us-west1/ragCorpora/123'
        mock_rag.list_corpora.return_value = [mock_corpus]

        # Mock import response
        mock_import_response = MagicMock()
        mock_import_response.imported_rag_files_count = 1
        mock_rag.import_files.return_value = mock_import_response

        service = RAGService(project_id='test-project', location='us-west1')
        result = service.index_document(
            brand_id='brand-123',
            gcs_uri='gs://test-bucket/test.pdf'
        )

        self.assertTrue(result.success)
        self.assertEqual(result.files_indexed, 1)
        mock_rag.import_files.assert_called_once()

    @patch('services.rag_service.vertexai')
    @patch('services.rag_service.rag')
    def test_list_corpora(self, mock_rag, mock_vertexai):
        """Test listing corpora."""
        from services.rag_service import RAGService

        mock_corpus1 = MagicMock()
        mock_corpus1.name = 'corpus-1'
        mock_corpus1.display_name = 'Test Corpus 1'
        mock_corpus1.description = 'Description 1'

        mock_corpus2 = MagicMock()
        mock_corpus2.name = 'corpus-2'
        mock_corpus2.display_name = 'Test Corpus 2'

        mock_rag.list_corpora.return_value = [mock_corpus1, mock_corpus2]

        service = RAGService(project_id='test-project', location='us-west1')
        result = service.list_corpora()

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]['name'], 'corpus-1')
        self.assertEqual(result[0]['display_name'], 'Test Corpus 1')


class TestRAGTools(unittest.TestCase):
    """Test cases for RAG tools."""

    def setUp(self):
        """Set up test fixtures."""
        self.env_patcher = patch.dict(os.environ, {
            'MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID': 'test-project'
        })
        self.env_patcher.start()

    def tearDown(self):
        """Clean up after tests."""
        self.env_patcher.stop()

    @patch('services.rag_service.get_rag_service')
    @patch('tools.rag_tools.get_brand_context')
    def test_query_brand_documents_success(self, mock_get_brand_context, mock_get_rag_service):
        """Test successful document query."""
        from tools.rag_tools import query_brand_documents

        # Mock brand context
        mock_get_brand_context.return_value = 'brand-123'

        # Mock RAG service
        mock_service = MagicMock()
        mock_result = MagicMock()
        mock_result.answer = 'Test answer from documents'
        mock_result.contexts = [{'text': 'Context 1', 'source': 'doc1'}]
        mock_service.query.return_value = mock_result
        mock_get_rag_service.return_value = mock_service

        result = query_brand_documents('What is in the document?')

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['answer'], 'Test answer from documents')
        self.assertEqual(result['sources_count'], 1)

    def test_query_brand_documents_no_brand(self):
        """Test query fails without brand context."""
        # Patch at the module level where it's imported
        with patch('tools.rag_tools.get_brand_context', return_value=None):
            from tools.rag_tools import query_brand_documents
            result = query_brand_documents('What is in the document?')

            self.assertEqual(result['status'], 'error')
            self.assertIn('Brand ID required', result['error'])

    @patch('services.rag_service.get_rag_service')
    @patch('tools.rag_tools.get_brand_context')
    def test_index_brand_document_success(self, mock_get_brand_context, mock_get_rag_service):
        """Test successful document indexing via tool."""
        from tools.rag_tools import index_brand_document

        mock_get_brand_context.return_value = 'brand-123'

        mock_service = MagicMock()
        mock_result = MagicMock()
        mock_result.success = True
        mock_result.corpus_name = 'test-corpus'
        mock_result.files_indexed = 1
        mock_result.message = 'Indexed successfully'
        mock_service.index_document.return_value = mock_result
        mock_get_rag_service.return_value = mock_service

        result = index_brand_document('gs://bucket/file.pdf')

        self.assertEqual(result['status'], 'success')
        self.assertEqual(result['files_indexed'], 1)

    @patch('tools.rag_tools.get_brand_context')
    def test_index_brand_document_invalid_uri(self, mock_get_brand_context):
        """Test indexing fails with invalid GCS URI."""
        from tools.rag_tools import index_brand_document

        mock_get_brand_context.return_value = 'brand-123'

        result = index_brand_document('https://example.com/file.pdf')

        self.assertEqual(result['status'], 'error')
        self.assertIn('Invalid GCS URI', result['error'])


class TestRAGToolIntegration(unittest.TestCase):
    """Test RAG tool registration in the agent."""

    def test_rag_tool_importable(self):
        """Test that RAG tools can be imported."""
        try:
            from tools.rag_tools import query_brand_documents, index_brand_document
            self.assertTrue(callable(query_brand_documents))
            self.assertTrue(callable(index_brand_document))
        except ImportError as e:
            self.fail(f"Failed to import RAG tools: {e}")

    def test_rag_tool_docstrings(self):
        """Test that RAG tools have proper docstrings."""
        from tools.rag_tools import query_brand_documents, index_brand_document

        self.assertIsNotNone(query_brand_documents.__doc__)
        self.assertIn('query', query_brand_documents.__doc__.lower())

        self.assertIsNotNone(index_brand_document.__doc__)
        self.assertIn('index', index_brand_document.__doc__.lower())


if __name__ == '__main__':
    unittest.main()
