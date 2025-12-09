'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Sparkles,
  BookOpen,
  List,
  Hash,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface DocumentPreviewProps {
  documentId: string;
  documentName: string;
  documentUrl?: string;
  brandId: string;
  gcsUri?: string;
  onIndexComplete?: () => void;
}

interface DocumentSummary {
  title: string;
  summary: string;
  keyTopics: string[];
  documentType: string;
  wordCount?: number;
  isIndexed: boolean;
}

export function DocumentPreview({
  documentId,
  documentName,
  documentUrl,
  brandId,
  gcsUri,
  onIndexComplete
}: DocumentPreviewProps) {
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  // Auto-generate preview when component mounts
  useEffect(() => {
    if (documentId && brandId) {
      generatePreview();
    }
  }, [documentId, brandId]);

  const generatePreview = async () => {
    setLoading(true);
    setError(null);

    try {
      // First, try to get a summary from RAG if the document is indexed
      const response = await fetch('/api/rag-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'query',
          brandId,
          query: `Provide a comprehensive summary of the document "${documentName}". Include:
          1. A brief 2-3 sentence overview
          2. The main topics covered
          3. Key points or takeaways
          4. The type of document (guide, report, manual, etc.)`
        }),
      });

      const data = await response.json();

      if (data.success && data.result?.answer) {
        // Parse the AI response to extract structured information
        const answer = data.result.answer;

        // Extract key topics from the response
        const topicsMatch = answer.match(/topics?[:\s]*([\s\S]*?)(?:\n\n|key points|takeaways|$)/i);
        const topics = topicsMatch
          ? topicsMatch[1].split(/[,\n•\-]/).map((t: string) => t.trim()).filter((t: string) => t.length > 2 && t.length < 50).slice(0, 5)
          : extractTopicsFromName(documentName);

        setSummary({
          title: documentName.replace(/\.[^/.]+$/, ''), // Remove file extension
          summary: answer,
          keyTopics: topics.length > 0 ? topics : extractTopicsFromName(documentName),
          documentType: guessDocumentType(documentName),
          isIndexed: data.result.sourcesCount > 0
        });
      } else {
        // If RAG query fails, create a placeholder summary
        setSummary({
          title: documentName.replace(/\.[^/.]+$/, ''),
          summary: `This document "${documentName}" has been uploaded and is ready for indexing. Once indexed, you'll be able to search its contents and get AI-powered answers about its information.`,
          keyTopics: extractTopicsFromName(documentName),
          documentType: guessDocumentType(documentName),
          isIndexed: false
        });
      }
    } catch (err) {
      console.error('Error generating preview:', err);
      setError('Failed to generate preview');
      // Still show basic info
      setSummary({
        title: documentName.replace(/\.[^/.]+$/, ''),
        summary: 'Document uploaded successfully. Index this document to enable AI-powered search and Q&A.',
        keyTopics: extractTopicsFromName(documentName),
        documentType: guessDocumentType(documentName),
        isIndexed: false
      });
    } finally {
      setLoading(false);
    }
  };

  const handleIndex = async () => {
    if (!gcsUri && !documentUrl) {
      setError('Document URI not available');
      return;
    }

    setIndexing(true);
    setError(null);

    try {
      const response = await fetch('/api/rag-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'index',
          brandId,
          documentId,
          gcsUri: gcsUri || documentUrl,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Re-generate preview with indexed content
        await generatePreview();
        onIndexComplete?.();
      } else {
        setError(data.message || 'Failed to index document');
      }
    } catch (err) {
      console.error('Error indexing:', err);
      setError('Failed to index document');
    } finally {
      setIndexing(false);
    }
  };

  // Helper functions
  const extractTopicsFromName = (name: string): string[] => {
    const cleanName = name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    const words = cleanName.split(' ').filter(w => w.length > 3);
    return words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  };

  const guessDocumentType = (name: string): string => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('guide')) return 'Guide';
    if (lowerName.includes('manual')) return 'Manual';
    if (lowerName.includes('report')) return 'Report';
    if (lowerName.includes('policy')) return 'Policy';
    if (lowerName.includes('brand')) return 'Brand Document';
    if (lowerName.includes('style')) return 'Style Guide';
    if (lowerName.endsWith('.pdf')) return 'PDF Document';
    if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) return 'Word Document';
    if (lowerName.endsWith('.txt')) return 'Text Document';
    return 'Document';
  };

  const getFileExtension = (name: string): string => {
    const ext = name.split('.').pop()?.toUpperCase() || 'FILE';
    return ext;
  };

  if (loading) {
    return (
      <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30 transition-all duration-300 hover:shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* Document Icon */}
          <div className="relative">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <Badge
              variant="secondary"
              className="absolute -bottom-1 -right-1 text-[10px] px-1.5 py-0"
            >
              {getFileExtension(documentName)}
            </Badge>
          </div>

          {/* Title and Meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg truncate">{summary.title}</CardTitle>
              {summary.isIndexed ? (
                <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Indexed
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                  <Clock className="h-3 w-3 mr-1" />
                  Not Indexed
                </Badge>
              )}
            </div>
            <CardDescription className="flex items-center gap-2 mt-1">
              <BookOpen className="h-3 w-3" />
              {summary.documentType}
              {summary.wordCount && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <Hash className="h-3 w-3" />
                  {summary.wordCount.toLocaleString()} words
                </>
              )}
            </CardDescription>
          </div>

          {/* Expand/Collapse Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* AI Summary */}
          <div className="relative">
            <div className="absolute -left-2 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/50 to-primary/10 rounded-full" />
            <div className="pl-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">AI Summary</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {summary.summary}
              </p>
            </div>
          </div>

          {/* Key Topics */}
          {summary.keyTopics.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <List className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Key Topics</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {summary.keyTopics.map((topic, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="bg-background hover:bg-muted transition-colors"
                  >
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {!summary.isIndexed && (
              <Button
                onClick={handleIndex}
                disabled={indexing}
                className="flex-1"
              >
                {indexing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Indexing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Index for AI Search
                  </>
                )}
              </Button>
            )}

            {summary.isIndexed && (
              <Button
                onClick={generatePreview}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Summary
              </Button>
            )}

            {documentUrl && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.open(documentUrl, '_blank')}
                title="Open document"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
