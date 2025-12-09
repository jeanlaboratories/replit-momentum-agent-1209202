'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Sparkles,
  BookOpen,
  List,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle,
  Clock,
  Trash2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';

interface ProfileDocumentCardProps {
  documentId: string;
  documentName: string;
  documentUrl: string;
  brandId: string;
  gcsUri?: string;
  onDelete?: () => void;
  canDelete?: boolean;
  onIndexComplete?: () => void;
}

interface DocumentSummary {
  title: string;
  summary: string;
  keyTopics: string[];
  documentType: string;
  isIndexed: boolean;
}

export function ProfileDocumentCard({
  documentId,
  documentName,
  documentUrl,
  brandId,
  gcsUri,
  onDelete,
  canDelete = false,
  onIndexComplete
}: ProfileDocumentCardProps) {
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [indexing, setIndexing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

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
      // Try to get a summary from RAG if the document is indexed
      const response = await fetch('/api/rag-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'query',
          brandId,
          query: `Summarize the document "${documentName}" in 2-3 sentences. What are the main topics?`
        }),
      });

      const data = await response.json();

      if (data.success && data.result?.answer && data.result.sourcesCount > 0) {
        const answer = data.result.answer;

        // Extract key topics
        const topics = extractTopicsFromResponse(answer, documentName);

        setSummary({
          title: documentName.replace(/\.[^/.]+$/, ''),
          summary: answer.length > 200 ? answer.substring(0, 200) + '...' : answer,
          keyTopics: topics,
          documentType: guessDocumentType(documentName),
          isIndexed: true
        });
      } else {
        // Document not indexed yet
        setSummary({
          title: documentName.replace(/\.[^/.]+$/, ''),
          summary: 'Click "Index" to enable AI-powered search and summaries for this document.',
          keyTopics: extractTopicsFromName(documentName),
          documentType: guessDocumentType(documentName),
          isIndexed: false
        });
      }
    } catch (err) {
      console.error('Error generating preview:', err);
      setSummary({
        title: documentName.replace(/\.[^/.]+$/, ''),
        summary: 'Click "Index" to enable AI-powered search.',
        keyTopics: extractTopicsFromName(documentName),
        documentType: guessDocumentType(documentName),
        isIndexed: false
      });
    } finally {
      setLoading(false);
    }
  };

  const handleIndex = async () => {
    const uri = gcsUri || documentUrl;
    if (!uri) {
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
          gcsUri: uri,
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
  const extractTopicsFromResponse = (answer: string, name: string): string[] => {
    const topicsMatch = answer.match(/topics?[:\s]*([\s\S]*?)(?:\n\n|key points|takeaways|$)/i);
    if (topicsMatch) {
      const topics = topicsMatch[1]
        .split(/[,\n•\-]/)
        .map((t: string) => t.trim())
        .filter((t: string) => t.length > 2 && t.length < 40)
        .slice(0, 4);
      if (topics.length > 0) return topics;
    }
    return extractTopicsFromName(name);
  };

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
    if (lowerName.endsWith('.pdf')) return 'PDF';
    if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) return 'Word';
    if (lowerName.endsWith('.txt')) return 'Text';
    return 'Document';
  };

  const getFileExtension = (name: string): string => {
    return name.split('.').pop()?.toUpperCase() || 'FILE';
  };

  if (loading) {
    return (
      <GlassCard className="overflow-hidden">
        <GlassCardContent className="p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }

  if (!summary) return null;

  return (
    <GlassCard className="overflow-hidden transition-all duration-300 hover:shadow-md group">
      <GlassCardContent className="p-4">
        {/* Header Row */}
        <div className="flex items-start gap-3">
          {/* Document Icon with Extension Badge */}
          <div className="relative shrink-0">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <Badge
              variant="secondary"
              className="absolute -bottom-1 -right-1 text-[9px] px-1 py-0 font-medium"
            >
              {getFileExtension(documentName)}
            </Badge>
          </div>

          {/* Title and Status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold truncate text-sm">{summary.title}</h4>
              {summary.isIndexed ? (
                <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] px-1.5 py-0">
                  <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                  Indexed
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] px-1.5 py-0">
                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                  Not Indexed
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              <BookOpen className="h-3 w-3" />
              <span>{summary.documentType}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setExpanded(!expanded)}
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => window.open(documentUrl, '_blank')}
              title="Open document"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            {canDelete && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={onDelete}
                title="Delete document"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div className="mt-4 space-y-3 pt-3 border-t">
            {/* AI Summary */}
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 to-primary/10 rounded-full" />
              <div className="pl-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-xs font-medium text-primary">AI Summary</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {summary.summary}
                </p>
              </div>
            </div>

            {/* Key Topics */}
            {summary.keyTopics.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <List className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium">Key Topics</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {summary.keyTopics.map((topic, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 bg-background"
                    >
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
                <AlertCircle className="h-3 w-3" />
                {error}
              </div>
            )}

            {/* Index/Refresh Button */}
            <div className="flex gap-2">
              {!summary.isIndexed ? (
                <Button
                  onClick={handleIndex}
                  disabled={indexing}
                  size="sm"
                  className="flex-1 h-8 text-xs"
                >
                  {indexing ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      Indexing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-1.5" />
                      Index for AI Search
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={generatePreview}
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                  Refresh Summary
                </Button>
              )}
            </div>
          </div>
        )}
      </GlassCardContent>
    </GlassCard>
  );
}
