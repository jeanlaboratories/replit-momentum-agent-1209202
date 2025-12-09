'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, MessageCircle, Send } from 'lucide-react';

interface RAGQueryInterfaceProps {
  brandId: string;
  title?: string;
  placeholder?: string;
}

export function RAGQueryInterface({
  brandId,
  title = "Ask Questions",
  placeholder = "What would you like to know about the documents?"
}: RAGQueryInterfaceProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

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

      if (!result.ok) {
        throw new Error('Failed to query documents');
      }

      const data = await result.json();

      if (data.success) {
        setResponse(data.result.answer);
      } else {
        throw new Error(data.message || 'Query failed');
      }
    } catch (err) {
      console.error('Error querying RAG:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="px-4 sm:px-6 py-4 sm:py-5">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
          <span className="truncate">{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
            className="flex-1 text-sm sm:text-base h-10 sm:h-11"
          />
          <Button 
            type="submit" 
            disabled={isLoading || !query.trim()}
            className="w-full sm:w-auto h-10 sm:h-11 px-6"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="sm:hidden">Processing...</span>
                <span className="hidden sm:inline">Processing</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Ask
              </>
            )}
          </Button>
        </form>

        {isLoading && (
          <div className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base text-muted-foreground p-3 sm:p-4 bg-muted/50 rounded-lg">
            <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin flex-shrink-0" />
            <span>Processing your question...</span>
          </div>
        )}

        {response && (
          <Card className="bg-green-50 border-green-200 shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="text-sm sm:text-base font-semibold text-green-800 mb-2 flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-green-600"></span>
                Response
              </div>
              <div className="text-sm sm:text-base text-green-700 whitespace-pre-wrap leading-relaxed break-words">
                {response}
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="bg-red-50 border-red-200 shadow-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="text-sm sm:text-base font-semibold text-red-800 mb-2 flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-red-600"></span>
                Error
              </div>
              <div className="text-sm sm:text-base text-red-700 break-words">
                {error}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-xs sm:text-sm text-muted-foreground bg-muted/30 p-3 sm:p-4 rounded-lg">
          <p className="leading-relaxed">
            Ask questions about uploaded documents. The AI will search through indexed content to provide relevant answers.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
