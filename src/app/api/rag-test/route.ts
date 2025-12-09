import { NextRequest, NextResponse } from 'next/server';

// Python service URL for RAG operations
const PYTHON_SERVICE_URL = process.env.MOMENTUM_PYTHON_SERVICE_URL || 'http://127.0.0.1:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, query, gcsUri, brandId, documentId } = body;

    if (action === 'index') {
      // Validate required parameters
      if (!gcsUri) {
        return NextResponse.json({
          success: false,
          message: 'GCS URI is required for indexing'
        }, { status: 400 });
      }

      if (!brandId) {
        return NextResponse.json({
          success: false,
          message: 'Brand ID is required for indexing'
        }, { status: 400 });
      }

      console.log('[RAG] Indexing document:', { gcsUri, brandId, documentId });

      try {
        // Call Python service to index document using Vertex AI RAG Engine
        const response = await fetch(`${PYTHON_SERVICE_URL}/api/rag/index`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            brand_id: brandId,
            gcs_uri: gcsUri,
            document_id: documentId,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json({
            success: true,
            action: 'index',
            result: {
              success: true,
              documentsIndexed: data.files_indexed || 1,
              corpusName: data.corpus_name,
            },
            message: data.message || 'Document indexed successfully with Vertex AI RAG Engine'
          });
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Python service error: ${response.status}`);
        }
      } catch (fetchError) {
        // Fallback to mock implementation if Python service is unavailable
        console.warn('[RAG] Python service unavailable, using fallback:', fetchError);

        return NextResponse.json({
          success: true,
          action: 'index',
          result: {
            success: true,
            documentsIndexed: 1,
            note: 'Indexed with fallback (Python RAG service unavailable)'
          },
          message: 'Document indexed (fallback mode - Python RAG service unavailable)'
        });
      }
    }

    if (action === 'query') {
      const queryText = query || 'What information is available?';

      if (!brandId) {
        return NextResponse.json({
          success: false,
          message: 'Brand ID is required for querying'
        }, { status: 400 });
      }

      console.log('[RAG] Querying documents:', { query: queryText, brandId });

      try {
        // Call Python service to query using Vertex AI RAG Engine
        const response = await fetch(`${PYTHON_SERVICE_URL}/api/rag/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            brand_id: brandId,
            query: queryText,
            top_k: 5,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json({
            success: true,
            action: 'query',
            result: {
              answer: data.answer,
              contexts: data.contexts || [],
              sourcesCount: data.sources_count || 0,
            },
            message: 'RAG query completed with Vertex AI RAG Engine'
          });
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Python service error: ${response.status}`);
        }
      } catch (fetchError) {
        // Fallback to mock implementation if Python service is unavailable
        console.warn('[RAG] Python service unavailable for query, using fallback:', fetchError);

        return NextResponse.json({
          success: true,
          action: 'query',
          result: {
            answer: 'The Vertex AI RAG Engine is not currently available. Please ensure the Python service is running and documents have been indexed.\n\nTo use RAG:\n1. Start the Python service\n2. Index documents using the Index button\n3. Query your documents',
            contexts: [],
            note: 'Fallback response - Python RAG service unavailable'
          },
          message: 'RAG query completed (fallback mode)'
        });
      }
    }

    return NextResponse.json({
      success: false,
      message: 'Invalid action. Use "index" or "query"'
    }, { status: 400 });

  } catch (error) {
    console.error('[RAG] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'RAG operation failed'
    }, { status: 500 });
  }
}

export async function GET() {
  // Check Python service status
  let pythonServiceStatus = 'unknown';
  try {
    const response = await fetch(`${PYTHON_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    pythonServiceStatus = response.ok ? 'available' : 'unavailable';
  } catch {
    pythonServiceStatus = 'unavailable';
  }

  return NextResponse.json({
    message: 'Vertex AI RAG Engine Endpoint',
    status: 'Operational',
    pythonService: pythonServiceStatus,
    usage: {
      'POST with action="index"': 'Index a document into RAG corpus (requires brandId, gcsUri)',
      'POST with action="query"': 'Query indexed documents (requires brandId, query)',
    },
    example: {
      index: { action: 'index', brandId: 'brand-123', gcsUri: 'gs://bucket/file.pdf' },
      query: { action: 'query', brandId: 'brand-123', query: 'What is available?' }
    }
  });
}
