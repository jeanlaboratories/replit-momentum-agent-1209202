'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { PageTransition } from '@/components/ui/page-transition';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, MessageCircle, Send, FileText, CheckCircle, Upload, Database, Search, AlertCircle } from 'lucide-react';
import { BrandDocumentSelector } from '@/components/rag/BrandDocumentSelector';
import { useAuth } from '@/hooks/use-auth';

export default function BrandKnowledgeBasePage() {
  const { brandId, loading: authLoading } = useAuth();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [indexedDocs, setIndexedDocs] = useState<string[]>([]);
  const [selectedBrandDocument, setSelectedBrandDocument] = useState<any>(null);

  const handleIndexDocument = async (useDemo = false) => {
    setIsIndexing(true);
    setError(null);

    if (!brandId && !useDemo) {
      setError('Please log in to index your brand documents.');
      setIsIndexing(false);
      return;
    }

    try {
      const indexData = useDemo
        ? {
            action: 'index',
            brandId: brandId || 'demo',
            gcsUri: 'gs://advantage-ai-documents/sample-menu.pdf',
          }
        : {
            action: 'index',
            brandId: brandId,
            documentId: selectedBrandDocument?.id,
            gcsUri: selectedBrandDocument?.gcsUri,
          };

      const result = await fetch('/api/rag-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(indexData),
      });

      const data = await result.json();
      
      if (data.success) {
        const docName = useDemo ? 'sample-menu.pdf' : selectedBrandDocument?.name || 'brand-document';
        setIndexedDocs(prev => [...prev, docName]);
        setError(null);
      } else {
        throw new Error(data.message || 'Indexing failed');
      }
    } catch (err) {
      console.error('Error indexing:', err);
      setError(err instanceof Error ? err.message : 'Indexing failed');
    } finally {
      setIsIndexing(false);
    }
  };

  const handleBrandDocumentIndex = async (brandId: string, documentId: string) => {
    if (selectedBrandDocument && selectedBrandDocument.id === documentId) {
      await handleIndexDocument(false);
    }
  };

  const handleIndexSample = async () => {
    setIsIndexing(true);
    setError(null);

    try {
      const result = await fetch('/api/rag-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'index',
          gcsUri: 'gs://advantage-ai-documents/sample-menu.pdf',
        }),
      });

      const data = await result.json();
      
      if (data.success) {
        setIndexedDocs(prev => [...prev, 'sample-menu.pdf']);
        setError(null);
      } else {
        throw new Error(data.message || 'Indexing failed');
      }
    } catch (err) {
      console.error('Error indexing:', err);
      setError(err instanceof Error ? err.message : 'Indexing failed');
    } finally {
      setIsIndexing(false);
    }
  };

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    if (!brandId) {
      setError('Please log in to query your brand documents.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await fetch('/api/rag-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'query',
          brandId: brandId,
          query: query.trim(),
        }),
      });

      const data = await result.json();

      if (data.success && data.result && data.result.answer) {
        setResponse(data.result.answer);
      } else {
        throw new Error(data.message || 'Query failed');
      }
    } catch (err) {
      console.error('Error querying:', err);
      setError(err instanceof Error ? err.message : 'Query failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while auth is loading
  if (authLoading) {
    return (
      <PageTransition className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Brand Knowledge Base</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Your AI-powered brand intelligence hub. Upload documents, and get instant answers
          about your brand guidelines, strategies, and content.
        </p>
        {!brandId && (
          <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg max-w-md mx-auto">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">Please log in to access your brand knowledge base.</span>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
        {/* Document Indexing Section */}
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-2">
              <Database className="h-6 w-6" />
              Step 1: Index Documents
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
            <Tabs defaultValue="brand" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="brand">Your Team Documents</TabsTrigger>
                <TabsTrigger value="demo">Demo Sample</TabsTrigger>
              </TabsList>
              
              <TabsContent value="brand" className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Use your actual team documents for personalized RAG testing.
                </p>
                <BrandDocumentSelector 
                  onDocumentSelected={setSelectedBrandDocument}
                  onIndexDocument={handleBrandDocumentIndex}
                />
              </TabsContent>
              
              <TabsContent value="demo" className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Test with sample menu documents to see how RAG works.
                </p>
                <Button 
                  onClick={() => handleIndexDocument(true)} 
                  disabled={isIndexing}
                  className="w-full"
                >
                  {isIndexing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Indexing Document...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Index Sample Document (GCS)
                    </>
                  )}
                </Button>
                
                <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded">
                  <p><strong>GCS Integration:</strong></p>
                  <p>• Documents are stored in Google Cloud Storage</p>
                  <p>• Content is processed and chunked for indexing</p>
                  <p>• Vector embeddings are created for semantic search</p>
                </div>
              </TabsContent>
            </Tabs>

            {indexedDocs.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Indexed Documents:</h4>
                {indexedDocs.map((doc, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm bg-green-50 p-2 rounded">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>{doc}</span>
                  </div>
                ))}
              </div>
            )}
          </GlassCardContent>
        </GlassCard>

        {/* Query Section */}
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-2">
              <Search className="h-6 w-6" />
              Step 2: Query Documents
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ask questions about the indexed documents. The AI will search for relevant content.
            </p>

            <form onSubmit={handleQuery} className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What would you like to know about the documents?"
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading || !query.trim()}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Searching documents and generating response...</span>
              </div>
            )}

            {response && (
              <GlassCard className="bg-green-50 border-green-200">
                <GlassCardContent className="pt-4">
                  <div className="text-sm font-medium text-green-800 mb-2">AI Response:</div>
                  <div className="text-green-700 whitespace-pre-wrap">{response}</div>
                </GlassCardContent>
              </GlassCard>
            )}

            {error && (
              <GlassCard className="bg-red-50 border-red-200">
                <GlassCardContent className="pt-4">
                  <div className="text-sm font-medium text-red-800 mb-2">Status:</div>
                  <div className="text-red-700">{error}</div>
                </GlassCardContent>
              </GlassCard>
            )}

            <div className="text-xs text-muted-foreground">
              <p><strong>Try these example queries:</strong></p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li>"What food items are available?"</li>
                <li>"Tell me about beverages"</li>
                <li>"What are the main topics?"</li>
              </ul>
            </div>
          </GlassCardContent>
        </GlassCard>
      </div>

      {/* How It Works Section */}
      <GlassCard className="max-w-4xl mx-auto">
        <GlassCardHeader>
          <GlassCardTitle>How Your Knowledge Base Works</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-semibold">1. Upload Documents</h3>
              <p className="text-sm text-muted-foreground">
                Upload your brand guidelines, marketing materials, and strategy documents securely to your knowledge base.
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Database className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold">2. AI Processing</h3>
              <p className="text-sm text-muted-foreground">
                Documents are automatically analyzed, indexed, and made searchable using advanced AI embeddings.
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                <MessageCircle className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-semibold">3. Get Answers</h3>
              <p className="text-sm text-muted-foreground">
                Ask questions in natural language and receive accurate, contextual answers based on your brand documents.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="font-semibold mb-3">Powered By</h4>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h5 className="font-medium mb-2">Secure Storage:</h5>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Enterprise-grade Google Cloud Storage</li>
                  <li>• Per-brand isolated data</li>
                  <li>• Automatic backup and versioning</li>
                  <li>• Role-based access control</li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium mb-2">AI Intelligence:</h5>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Vertex AI RAG Engine</li>
                  <li>• Gemini-powered responses</li>
                  <li>• Semantic search capabilities</li>
                  <li>• Real-time document processing</li>
                </ul>
              </div>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    </PageTransition>
  );
}