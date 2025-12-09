'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Database, Loader2, Upload, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { uploadBrandAssetAction } from '@/app/actions';
import { DocumentPreview } from './DocumentPreview';

interface BrandDocument {
  id: string;
  name: string;
  url: string;
  type: string;
  gcsUri: string;
}

interface BrandDocumentSelectorProps {
  onDocumentSelected?: (document: BrandDocument) => void;
  onIndexDocument?: (brandId: string, documentId: string) => void;
}

export function BrandDocumentSelector({ onDocumentSelected, onIndexDocument }: BrandDocumentSelectorProps) {
  const { user, brandId } = useAuth();
  const [documents, setDocuments] = useState<BrandDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedDocument, setUploadedDocument] = useState<BrandDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (brandId) {
      fetchBrandDocuments();
    }
  }, [brandId]);

  const fetchBrandDocuments = async () => {
    if (!brandId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/brand-documents?brandId=${brandId}`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Error fetching brand documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentSelect = (documentId: string) => {
    setSelectedDocument(documentId);
    const document = documents.find(doc => doc.id === documentId);
    if (document && onDocumentSelected) {
      onDocumentSelected(document);
    }
  };

  const handleIndexDocument = async () => {
    if (!selectedDocument || !brandId) return;

    setIndexing(true);
    try {
      if (onIndexDocument) {
        await onIndexDocument(brandId, selectedDocument);
      }
    } catch (error) {
      console.error('Error indexing document:', error);
    } finally {
      setIndexing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !brandId) return;

    setUploading(true);
    try {
      // Convert file to data URI
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUri = event.target?.result as string;

        const result = await uploadBrandAssetAction(brandId, {
          name: file.name,
          dataUri,
          type: 'document'
        });

        if (result.asset && !result.error) {
          // Refresh the documents list
          await fetchBrandDocuments();

          // Create the new document object
          const newDocument: BrandDocument = {
            id: result.asset.id,
            name: result.asset.name,
            url: result.asset.url,
            type: result.asset.type,
            gcsUri: `gs://${process.env.MOMENTUM_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}/brand_assets/${brandId}/documents/${result.asset.name}`
          };

          // Auto-select the newly uploaded document
          setSelectedDocument(result.asset.id);

          // Store uploaded document for preview
          setUploadedDocument(newDocument);

          // Pass the selected document to parent
          if (onDocumentSelected) {
            onDocumentSelected(newDocument);
          }
        } else {
          console.error('Upload failed:', result.error);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const selectedDoc = documents.find(doc => doc.id === selectedDocument);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading your brand documents...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Brand Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue={documents.length > 0 ? "existing" : "upload"} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Existing Documents</TabsTrigger>
            <TabsTrigger value="upload">Upload New Document</TabsTrigger>
          </TabsList>
          
          <TabsContent value="existing" className="space-y-4">
            {documents.length === 0 ? (
              <div className="text-center py-6">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-4">
                  No brand documents found. Upload a document to get started.
                </p>
                <Button variant="outline" onClick={() => window.open('/brand-profile', '_blank')}>
                  Go to Brand Profile
                </Button>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">Choose a document to test:</label>
                  <Select value={selectedDocument || ''} onValueChange={handleDocumentSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a brand document..." />
                    </SelectTrigger>
                    <SelectContent>
                      {documents.map(doc => (
                        <SelectItem key={doc.id} value={doc.id}>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span>{doc.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedDoc && brandId && (
                  <DocumentPreview
                    documentId={selectedDoc.id}
                    documentName={selectedDoc.name}
                    documentUrl={selectedDoc.url}
                    brandId={brandId}
                    gcsUri={selectedDoc.gcsUri}
                    onIndexComplete={() => {
                      // Notify parent that indexing is complete
                      if (onIndexDocument) {
                        onIndexDocument(brandId, selectedDoc.id);
                      }
                    }}
                  />
                )}
              </>
            )}
          </TabsContent>
          
          <TabsContent value="upload" className="space-y-4">
            {uploadedDocument && brandId ? (
              <div className="space-y-4">
                <DocumentPreview
                  documentId={uploadedDocument.id}
                  documentName={uploadedDocument.name}
                  documentUrl={uploadedDocument.url}
                  brandId={brandId}
                  gcsUri={uploadedDocument.gcsUri}
                  onIndexComplete={() => {
                    if (onIndexDocument) {
                      onIndexDocument(brandId, uploadedDocument.id);
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    setUploadedDocument(null);
                    fileInputRef.current?.click();
                  }}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Another Document
                </Button>
              </div>
            ) : (
              <div className="text-center py-6">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a document to test RAG with your content
                </p>

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading Document...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Choose Document to Upload
                    </>
                  )}
                </Button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                />

                <p className="text-xs text-muted-foreground mt-2">
                  Supports PDF, DOC, DOCX, and TXT files
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded-lg">
          <p><strong>How it works:</strong></p>
          <p>1. Upload or select a brand document</p>
          <p>2. Click "Index" to process it for RAG</p>
          <p>3. Ask questions about your brand content</p>
        </div>
      </CardContent>
    </Card>
  );
}