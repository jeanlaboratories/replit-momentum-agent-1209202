'use client';

import { FeedSection, PinnedPost, BrandAsset } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pin, ArrowRight, Image as ImageIcon, Video as VideoIcon, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NextImage from 'next/image';
import Link from 'next/link';

interface ContentFeedProps {
  pinnedPost?: PinnedPost;
  feedSections?: FeedSection[];
  images?: BrandAsset[];
  videos?: BrandAsset[];
  documents?: BrandAsset[];
  userDisplayNames?: { [userId: string]: string };
}

export function ContentFeed({ pinnedPost, feedSections, images = [], videos = [], documents = [], userDisplayNames = {} }: ContentFeedProps) {
  // Helper function to get uploader info from a BrandAsset
  const getUploaderInfo = (asset: BrandAsset) => {
    if (asset.uploadedBy) {
      return {
        userId: asset.uploadedBy,
        timestamp: asset.uploadedAt,
        displayName: userDisplayNames[asset.uploadedBy] || 'Loading...'
      };
    }
    return null;
  };

  // Only show Image Gallery, Video Gallery, and Team Documents tabs
  const defaultSections: FeedSection[] = [
    { 
      id: '2', 
      title: 'Image Gallery', 
      slug: 'images', 
      contentType: 'images',
      items: images.map(img => ({
        id: img.id,
        title: img.name,
        date: img.uploadedAt || '',
        excerpt: 'Team image',
        imageUrl: img.url,
      }))
    },
    { 
      id: '3', 
      title: 'Video Gallery', 
      slug: 'videos', 
      contentType: 'videos',
      items: videos.map(vid => ({
        id: vid.id,
        title: vid.name,
        date: vid.uploadedAt || '',
        excerpt: 'Team video',
        imageUrl: vid.url,
      }))
    },
    { 
      id: '4', 
      title: 'Team Documents', 
      slug: 'documents', 
      contentType: 'documents', 
      items: documents.map(doc => ({
        id: doc.id,
        title: doc.name,
        date: doc.uploadedAt || '',
        excerpt: 'Team document',
        imageUrl: doc.url,
      }))
    },
  ];

  return (
    <div className="space-y-4">
      {/* Pinned Post */}
      {pinnedPost && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Pin className="w-4 h-4 text-blue-600" />
              <Badge variant="secondary" className="text-xs">Pinned</Badge>
            </div>
            <CardTitle className="text-lg">{pinnedPost.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pinnedPost.imageUrl && (
              <div className="relative w-full h-48 rounded-md overflow-hidden">
                <NextImage
                  src={pinnedPost.imageUrl}
                  alt={pinnedPost.title || 'Pinned post image'}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <p className="text-sm text-muted-foreground">{pinnedPost.content}</p>
            {pinnedPost.linkUrl && (
              <Button variant="link" className="p-0 h-auto" asChild>
                <a href={pinnedPost.linkUrl} target="_blank" rel="noopener noreferrer">
                  {pinnedPost.linkText || 'Learn More'} <ArrowRight className="w-4 h-4 ml-1" />
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Feed Tabs */}
      <Tabs defaultValue={defaultSections[0]?.slug || 'images'} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          {defaultSections.map((section) => (
            <TabsTrigger key={section.id} value={section.slug}>
              {section.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {defaultSections.map((section) => (
          <TabsContent key={section.id} value={section.slug} className="mt-4 space-y-4">
            {section.items && section.items.length > 0 ? (
              section.contentType === 'images' ? (
                <div className="grid grid-cols-2 gap-4">
                  {images.map((img) => {
                    const uploaderInfo = getUploaderInfo(img);
                    return (
                      <Card key={img.id} className="overflow-hidden">
                        <div className="relative aspect-square">
                          <NextImage
                            src={img.url}
                            alt={img.name || 'Team image'}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <CardContent className="p-3 space-y-1">
                          <p className="text-sm font-medium truncate">{img.name}</p>
                          {uploaderInfo && (
                            <p className="text-xs text-muted-foreground">
                              Uploaded by{' '}
                              <Link 
                                href={`/brand-profile/personal?userId=${uploaderInfo.userId}`}
                                className="text-primary hover:underline"
                              >
                                {uploaderInfo.displayName}
                              </Link>
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : section.contentType === 'videos' ? (
                <div className="grid grid-cols-1 gap-4">
                  {videos.map((vid) => {
                    const uploaderInfo = getUploaderInfo(vid);
                    return (
                      <Card key={vid.id} className="overflow-hidden">
                        <div className="relative aspect-video">
                          <video
                            src={vid.url}
                            controls
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <CardContent className="p-3 space-y-1">
                          <p className="text-sm font-medium">{vid.name}</p>
                          {uploaderInfo && (
                            <p className="text-xs text-muted-foreground">
                              Uploaded by{' '}
                              <Link 
                                href={`/brand-profile/personal?userId=${uploaderInfo.userId}`}
                                className="text-primary hover:underline"
                              >
                                {uploaderInfo.displayName}
                              </Link>
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : section.contentType === 'documents' ? (
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const uploaderInfo = getUploaderInfo(doc);
                    return (
                      <Card key={doc.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="p-2 bg-muted rounded-md">
                                <FileText className="w-5 h-5 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{doc.name}</p>
                                {uploaderInfo ? (
                                  <p className="text-xs text-muted-foreground">
                                    Uploaded by{' '}
                                    <Link 
                                      href={`/brand-profile/personal?userId=${uploaderInfo.userId}`}
                                      className="text-primary hover:underline"
                                    >
                                      {uploaderInfo.displayName}
                                    </Link>
                                    {uploaderInfo.timestamp && (
                                      <>{' '}at {new Date(uploaderInfo.timestamp).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                      })}</>
                                    )}
                                  </p>
                                ) : doc.uploadedAt ? (
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(doc.uploadedAt).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" asChild>
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" download>
                                <Download className="w-4 h-4" />
                              </a>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                section.items.map((item) => (
                  <Card key={item.id}>
                    <CardHeader>
                      {item.imageUrl && (
                        <div className="relative w-full h-32 rounded-md overflow-hidden mb-3">
                          <NextImage
                            src={item.imageUrl}
                            alt={item.title || 'Content image'}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      <CardDescription className="text-xs">
                        {new Date(item.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{item.excerpt}</p>
                    </CardContent>
                  </Card>
                ))
              )
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No {section.title.toLowerCase()} available yet.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
