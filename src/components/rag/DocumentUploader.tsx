'use client';

import { useState } from 'react';
import { ObjectUploader } from '../ObjectUploader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import type { UploadResult } from '@uppy/core';

interface DocumentUploaderProps {
  onDocumentIndexed?: (documentPath: string) => void;
}

export function DocumentUploader({ onDocumentIndexed }: DocumentUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const handleGetUploadParameters = async () => {
    try {
      const response = await fetch('/api/objects/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get upload URL');
      }

      const data = await response.json();
      return {
        method: 'PUT' as const,
        url: data.uploadURL,
      };
    } catch (error) {
      console.error('Error getting upload parameters:', error);
      throw error;
    }
  };

  const handleComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (!result.successful || result.successful.length === 0) {
      setUploadStatus({
        type: 'error',
        message: 'No files were uploaded successfully.',
      });
      return;
    }

    const uploadedFile = result.successful[0];
    const documentUrl = uploadedFile.uploadURL;

    setIsIndexing(true);
    setUploadStatus({ type: null, message: '' });

    try {
      // Index the document with RAG
      const indexResponse = await fetch('/api/rag-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'index',
          gcsUri: documentUrl,
        }),
      });

      if (!indexResponse.ok) {
        throw new Error('Failed to index document');
      }

      const indexResult = await indexResponse.json();

      if (indexResult.success) {
        setUploadStatus({
          type: 'success',
          message: `Document uploaded and indexed successfully! ${indexResult.result.documentsIndexed} documents processed.`,
        });
        if (documentUrl) {
          onDocumentIndexed?.(documentUrl);
        }
      } else {
        throw new Error(indexResult.message || 'Failed to index document');
      }
    } catch (error) {
      console.error('Error indexing document:', error);
      setUploadStatus({
        type: 'error',
        message: `Document uploaded but indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsIndexing(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Upload Document
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ObjectUploader
          maxNumberOfFiles={1}
          maxFileSize={10485760} // 10MB
          onGetUploadParameters={handleGetUploadParameters}
          onComplete={handleComplete}
          buttonClassName="w-full"
        >
          <div className="flex items-center gap-2">
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            <span>Choose Document</span>
          </div>
        </ObjectUploader>

        {isIndexing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Processing and indexing document...</span>
          </div>
        )}

        {uploadStatus.type && (
          <div className={`flex items-center gap-2 text-sm ${
            uploadStatus.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`}>
            {uploadStatus.type === 'success' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>{uploadStatus.message}</span>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>Supported formats: PDF, TXT, DOC, DOCX</p>
          <p>Maximum file size: 10MB</p>
        </div>
      </CardContent>
    </Card>
  );
}