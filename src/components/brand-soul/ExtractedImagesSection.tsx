'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Image as ImageIcon, Loader2, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

type ExtractedColor = {
  hex: string;
  rgb: number[];
  proportion: number;
};

type ArtifactWithImages = {
  id: string;
  type: string;
  title: string;
  sourceUrl?: string;
  extractedImages: string[];
  extractedColors?: ExtractedColor[];
  createdAt: string;
};

export default function ExtractedImagesSection() {
  const { brandId } = useAuth();
  const [artifacts, setArtifacts] = useState<ArtifactWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const loadExtractedImages = async () => {
    if (!brandId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/brand-soul/extracted-images?brandId=${brandId}`);
      const data = await response.json();
      if (data.success) {
        setArtifacts(data.artifacts || []);
      }
    } catch (error) {
      console.error('Failed to load extracted images:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExtractedImages();
  }, [brandId]);

  if (!brandId) return null;

  const totalImages = artifacts.reduce((sum, artifact) => sum + artifact.extractedImages.length, 0);

  if (loading) {
    return (
      <Card className="border-indigo-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-indigo-600" />
            Team Visual Assets
          </CardTitle>
          <CardDescription>Images extracted from your team materials</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (artifacts.length === 0 || totalImages === 0) {
    return (
      <Card className="border-indigo-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-indigo-600" />
            Team Visual Assets
          </CardTitle>
          <CardDescription>Images extracted from your team materials</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No images extracted yet. Upload a website to extract visual assets.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-indigo-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-600" />
                Team Visual Assets
              </CardTitle>
              <CardDescription>
                {totalImages} image{totalImages !== 1 ? 's' : ''} extracted from {artifacts.length} source{artifacts.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadExtractedImages}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {artifacts.map((artifact) => (
            <div key={artifact.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {artifact.type}
                  </Badge>
                  <span className="text-sm font-medium">{artifact.title}</span>
                </div>
                {artifact.sourceUrl && (
                  <a 
                    href={artifact.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    View source
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              
              {/* Extracted Color Palette */}
              {artifact.extractedColors && artifact.extractedColors.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <span className="text-xs font-medium text-gray-600">Team Colors:</span>
                  <div className="flex gap-2">
                    {artifact.extractedColors.map((color, idx) => (
                      <div
                        key={idx}
                        className="group relative"
                        title={`${color.hex} (${(color.proportion * 100).toFixed(1)}%)`}
                      >
                        <div
                          className="w-8 h-8 rounded border border-gray-300 cursor-pointer hover:scale-110 transition-transform"
                          style={{ backgroundColor: color.hex }}
                        />
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {color.hex}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {artifact.extractedImages.map((imageUrl, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                    onClick={() => setSelectedImage(imageUrl)}
                  >
                    <img
                      src={imageUrl}
                      alt={`Extracted image ${idx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23999"%3E✕%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Image Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedImage}
              alt="Full size preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2 bg-white"
              onClick={() => setSelectedImage(null)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
