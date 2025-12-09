
'use client';

import React, { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  generateEditedImageAction,
  generateAiImageAction,
  getImagesAction,
  deleteImageAction,
  getUserDisplayNamesAction,
} from '@/app/actions';
import { semanticSearchMediaAction } from '@/lib/actions/media-library-actions';
import { getBrandMembersAction } from '@/app/actions/team-management';
import { EditImagePage } from '@/components/image-editing/EditImagePage';
import { ImageGenerationPage } from '@/components/image-editing/ImageGenerationPage';
import { ErrorModal } from '@/components/ErrorModal';
import { ImageIcon, Loader2, Trash2, AlertTriangle, Palette, Edit3, Eye, ArrowLeft, Search, X, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ImageGrid } from '@/components/image-editing/ImageGrid';
import { ImageViewer } from '@/components/image-editing/ImageViewer';
import { EditedImage } from '@/lib/types';
import { BrandMember } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useJobQueue } from '@/contexts/job-queue-context';
import { ProgressToast, ProgressToastStatus } from '@/components/ui/progress-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { PageTransition } from '@/components/ui/page-transition';

type Page = 'gallery' | 'edit' | 'viewer' | 'error' | 'generate';
type GalleryMode = 'editing' | 'generation';
export const maxDuration = 120; // 2 minutes

function ImagePageContent() {
  const { user, loading: authLoading, brandId } = useAuth();
  const { toast } = useToast();
  const { addJob, startJob, setProgress, completeJob, failJob } = useJobQueue();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Sponsorship context detection
  const sponsoredBrandId = searchParams.get('sponsor');
  const isSponsored = Boolean(sponsoredBrandId);
  const isReadOnly = isSponsored;
  
  const [page, setPage] = useState<Page>('gallery');
  const [galleryMode, setGalleryMode] = useState<GalleryMode>('editing');
  const [images, setImages] = useState<EditedImage[]>([]);
  const [activeImage, setActiveImage] = useState<EditedImage | null>(null);
  const [imageToDelete, setImageToDelete] = useState<EditedImage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [userDisplayNames, setUserDisplayNames] = useState<{ [userId: string]: string }>({});
  const [brandMembers, setBrandMembers] = useState<BrandMember[]>([]);
  const [filters, setFilters] = useState<{ userId?: string; dateRange?: { start: string; end: string } }>({});
  const [generationProgress, setGenerationProgress] = useState<{
    open: boolean;
    status: ProgressToastStatus;
    title: string;
    description?: string;
  }>({
    open: false,
    status: 'loading',
    title: '',
    description: ''
  });

  // Semantic Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<EditedImage[] | null>(null);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const loadImages = useCallback(async () => {
    if (!brandId) return;
    setInitialLoading(true);
    setInitialLoading(true);
    try {
      const [fetchedImages, membersData] = await Promise.all([
        getImagesAction(brandId, filters),
        getBrandMembersAction(brandId)
      ]);

        setImages(fetchedImages);
      if (membersData.members) {
        setBrandMembers(membersData.members);
      }
        
        // Extract all unique user IDs from images
        const userIds = new Set<string>();
        fetchedImages.forEach(image => {
          if (image.generatedBy) userIds.add(image.generatedBy);
          if (image.uploadedBy) userIds.add(image.uploadedBy);
        });
        
        // Fetch display names for all users
        if (userIds.size > 0) {
          const displayNames = await getUserDisplayNamesAction(Array.from(userIds));
          setUserDisplayNames(displayNames);
        }
    } catch (e) {
        console.error(e);
        // toast({
        //   variant: 'destructive',
        //   title: 'Failed to load images',
        //   description: e instanceof Error ? e.message : 'An unknown error occurred.',
        // })
    } finally {
        setInitialLoading(false);
    }
  }, [toast, brandId, filters]);

  useEffect(() => {
    if (user && brandId) {
      loadImages();
    }
  }, [loadImages, user, brandId]);

  // Semantic Search Handler - IDENTICAL TO MEDIA LIBRARY IMPLEMENTATION
  // This ensures Image Gallery gets exactly the same high-quality search as Media Library
  const handleSemanticSearch = useCallback(async (query: string) => {
    if (!brandId || !query.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      // CRITICAL FIX: Use IDENTICAL search options as Media Library
      // Media Library uses filters.type === 'image' when filtering by image type
      // We replicate this exact structure to ensure same backend processing
      const searchOptions = {
        mediaType: 'image' as 'image' | 'video' | undefined,
        source: undefined,
        collections: undefined, 
        tags: undefined,
        limit: 50,
      };
      console.log('[Image Gallery Search] Starting search with IDENTICAL options as Media Library:', JSON.stringify(searchOptions, null, 2));
      const response = await semanticSearchMediaAction(brandId, query, searchOptions);

      if (response.error) {
        console.error('[Semantic Search] Error:', response.error);
        toast({
          title: 'Search Error',
          description: response.error,
          variant: 'destructive',
        });
        setSearchResults(null);
      } else {
        // CRITICAL FIX: Process results IDENTICALLY to Media Library 
        // Preserve ALL vision analysis data in the conversion
        const imageResults: EditedImage[] = response.results
          .filter(result => result.type === 'image') // Explicit filter to match expected format
          .map(result => {
            // Debug: Log ALL result data including vision analysis (IDENTICAL to Media Library)
            console.log('[Image Gallery Search Result] Converting result:', result.id, {
              hasVisionDescription: !!result.visionDescription,
              visionDescription: result.visionDescription,
              hasVisionKeywords: !!result.visionKeywords?.length,
              visionKeywords: result.visionKeywords,
              hasVisionCategories: !!result.visionCategories?.length,
              visionCategories: result.visionCategories,
              relevanceScore: result.relevanceScore,
              allKeys: Object.keys(result),
            });
            
            // CRITICAL FIX: Convert to EditedImage format while preserving all metadata
            // Map source types correctly to determine if upload vs AI-generated
            const isUpload = result.source === 'upload' || result.source === 'brand-soul';
            
            const converted: EditedImage = {
              id: result.id,
              brandId: brandId,
              title: result.title || 'Untitled Image',
              prompt: (result as any).prompt || result.description || '',
              sourceImageUrl: isUpload ? (result.url || '') : '',
              generatedImageUrl: !isUpload ? (result.url || '') : '',
              uploadedBy: (result as any).uploadedBy,
              uploadedAt: (result as any).uploadedAt,
              generatedBy: (result as any).generatedBy,
              generatedAt: (result as any).generatedAt,
              // CRITICAL: Preserve vision analysis data for better search quality
              visionDescription: result.visionDescription,
              visionKeywords: result.visionKeywords,
              visionCategories: result.visionCategories,
              enhancedSearchText: result.enhancedSearchText,
              relevanceScore: result.relevanceScore,
            };
            
            // Debug: Verify vision data is preserved in converted result
            console.log('[Image Gallery Search Result] Converted image with vision data:', converted.id, {
              hasVisionDescription: !!converted.visionDescription,
              hasVisionKeywords: !!converted.visionKeywords?.length,
              relevanceScore: converted.relevanceScore,
            });
            
            return converted;
          });
        
        // Sort by relevance score (descending) to match search quality expectations
        imageResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
        
        console.log('[Image Gallery Search] Search completed successfully:', {
          query,
          totalResults: response.results.length,
          imageResults: imageResults.length,
          topResultScore: imageResults[0]?.relevanceScore,
          hasVisionData: imageResults.some(r => r.visionDescription || r.visionKeywords?.length)
        });
        
        setSearchResults(imageResults);
      }
    } catch (error) {
      console.error('[Semantic Search] Error:', error);
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  }, [brandId, toast]);

  // Debounced search effect - EXACT SAME IMPLEMENTATION AS MEDIA LIBRARY
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        handleSemanticSearch(searchQuery);
      }, 300);
    } else {
      setSearchResults(null);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, handleSemanticSearch]);

  const newImageId = searchParams.get('new');
  const generateImageId = searchParams.get('generate');
  const editImageId = searchParams.get('edit');
  const sourceImageUrl = searchParams.get('sourceImageUrl');
  const titleParam = searchParams.get('title');

  useEffect(() => {
    // Block edit/generate modes for sponsored users
    if (isReadOnly && (newImageId || generateImageId || editImageId)) {
      // toast({
      //   variant: 'destructive',
      //   title: 'Read-Only Access',
      //   description: 'You cannot edit or generate images while viewing a sponsored brand profile.',
      // });
      router.replace('/images');
      return;
    }
    
    if (newImageId && brandId) {
      const newImage: EditedImage = {
        id: newImageId,
        brandId: brandId,
        title: titleParam || 'New Image',
        prompt: '',
        sourceImageUrl: sourceImageUrl || '',
        generatedImageUrl: '',
      };
      setActiveImage(newImage);
      setGalleryMode('editing');
      setPage('edit');
    } else if (generateImageId && brandId) {
      const newImage: EditedImage = {
        id: generateImageId,
        brandId: brandId,
        title: 'Generated Image',
        prompt: '',
        sourceImageUrl: '',
        generatedImageUrl: '',
      };
      setActiveImage(newImage);
      setGalleryMode('generation');
      setPage('generate');
    } else if (editImageId) {
        const imageToEdit = images.find(img => img.id === editImageId);
        if (imageToEdit) {
            setActiveImage(imageToEdit);
            setGalleryMode('editing');
            setPage('edit');
        } else if (!initialLoading) {
            // If images are loaded and we still can't find it, it's an error
            // toast({
            //   variant: 'destructive',
            //   title: 'Image not found',
            //   description: `Could not find an image with ID: ${editImageId}`
            // });
            router.replace('/images');
        }
    } else {
        setPage('gallery');
        setActiveImage(null);
    }
  }, [newImageId, generateImageId, editImageId, images, router, toast, initialLoading, brandId, isReadOnly]);

  const handleViewImage = useCallback((image: EditedImage) => {
    setActiveImage(image);
    setPage('viewer');
  }, []);

  const handleDeleteRequest = useCallback((image: EditedImage) => {
    // Prevent deletion in read-only mode
    if (isReadOnly) {
      // toast({
      //   variant: 'destructive',
      //   title: 'Read-Only Access',
      //   description: 'You cannot delete images while viewing a sponsored brand profile.',
      // });
      return;
    }
    setImageToDelete(image);
  }, [isReadOnly, toast]);

  const handleConfirmDelete = async () => {
    if (!imageToDelete) return;
    
    // Double-check read-only protection
    if (isReadOnly) {
      // toast({
      //   variant: 'destructive',
      //   title: 'Read-Only Access',
      //   description: 'You cannot delete images while viewing a sponsored brand profile.',
      // });
      return;
    }
    
    setIsDeleting(true);
    const result = await deleteImageAction(imageToDelete.id);
    setIsDeleting(false);

    if (result.success) {
      setImages((prev) => prev.filter((v) => v.id !== imageToDelete.id));
      // toast({
      //   title: 'Success',
      //   description: result.message,
      // });
    } else {
      // toast({
      //   variant: 'destructive',
      //   title: 'Error',
      //   description: result.message,
      // });
    }
    setImageToDelete(null);
  };

   const handleEditImage = useCallback((image: EditedImage) => {
    // Prevent editing in read-only mode
    if (isReadOnly) {
      // toast({
      //   variant: 'destructive',
      //   title: 'Read-Only Access',
      //   description: 'You cannot edit images while viewing a sponsored brand profile.',
      // });
      return;
    }
    
    // For AI-generated images (have generatedImageUrl but no sourceImageUrl), 
    // use the generation flow instead of edit flow
    const isAiGenerated = image.generatedImageUrl && !image.sourceImageUrl;
    
    if (isAiGenerated) {
      router.push(`/images?generate=${image.id}`);
    } else {
      router.push(`/images?edit=${image.id}`);
    }
  }, [router, isReadOnly, toast]);

  const handleEditWithImageEditor = useCallback((image: EditedImage) => {
    // Prevent editing in read-only mode
    if (isReadOnly) {
      // toast({
      //   variant: 'destructive',
      //   title: 'Read-Only Access',
      //   description: 'You cannot edit images while viewing a sponsored brand profile.',
      // });
      return;
    }
    
    // Copy AI-generated image to use as source for image editing
    // Pass the source image URL via query params to preserve it through navigation
    const newImageId = crypto.randomUUID();
    const sourceImageUrl = encodeURIComponent(image.generatedImageUrl);
    const title = encodeURIComponent(`Edit of ${image.title}`);
    
    setGalleryMode('editing');
    router.push(`/images?new=${newImageId}&sourceImageUrl=${sourceImageUrl}&title=${title}`);
  }, [router, isReadOnly, toast]);

  const handleSaveImage = useCallback(
    async (image: EditedImage, options?: { maskUrl?: string }) => {
      if (!brandId) return;

      // Prevent saving in read-only mode
      if (isReadOnly) {
        return;
      }

      if (!image.sourceImageUrl) {
        toast({
          variant: 'destructive',
          title: 'Source image required',
          description: 'Please upload a source image before generating.',
        });
        return;
      }

      // Close dialog and return to gallery
      router.replace('/images', { scroll: false });
      setPage('gallery');

      // Add job to queue
      const jobId = addJob({
        type: 'image-editing',
        title: `Editing: ${image.title}`,
        description: 'Transforming image with AI',
        resultUrl: '/images',
      });
      startJob(jobId);
      setProgress(jobId, 5);

      // Show progress toast
      setGenerationProgress({
        open: true,
        status: 'loading',
        title: 'Generating edited image...',
        description: 'This may take 5-10 seconds. You can continue browsing.'
      });

      // Simulate progress during generation
      let currentProgress = 5;
      const progressInterval = setInterval(() => {
        currentProgress = Math.min(90, currentProgress + Math.random() * 15);
        setProgress(jobId, Math.round(currentProgress));
      }, 1500);

      const { image: savedImage, error } = await generateEditedImageAction(
        brandId,
        image.id,
        image.prompt,
        image.title,
        image.sourceImageUrl,
        image.additionalImageUrls,
        options?.maskUrl
      );

      clearInterval(progressInterval);

      if (error) {
        failJob(jobId, error.join(', '));
        setGenerationProgress({
          open: true,
          status: 'error',
          title: 'Image generation failed',
          description: error.join(', ')
        });
        return;
      }

      await loadImages();

      completeJob(jobId, { resultUrl: '/images' });
      setGenerationProgress({
        open: true,
        status: 'success',
        title: 'Image generated successfully!',
        description: 'Opening your new image...'
      });

      if (savedImage) {
        setTimeout(() => {
          setActiveImage(savedImage);
          setPage('viewer');
        }, 1000);
      }
    },
    [loadImages, router, toast, brandId, isReadOnly, addJob, startJob, setProgress, completeJob, failJob]
  );

  const handleGenerateImage = useCallback(
    async (image: EditedImage, options?: {
      aspectRatio?: string;
      numberOfImages?: number;
      personGeneration?: string;
    }) => {
      if (!brandId) return;

      // Prevent generation in read-only mode
      if (isReadOnly) {
        return;
      }

      if (!image.prompt.trim()) {
        toast({
          variant: 'destructive',
          title: 'Prompt required',
          description: 'Please provide a description for your image.',
        });
        return;
      }

      // Close dialog and return to gallery
      router.replace('/images', { scroll: false });
      setPage('gallery');

      // Add job to queue
      const numImages = options?.numberOfImages || 1;
      const jobId = addJob({
        type: 'image-generation',
        title: `Generating: ${image.title}`,
        description: `Creating ${numImages > 1 ? numImages + ' AI images' : 'AI image'}`,
        resultUrl: '/images',
      });
      startJob(jobId);
      setProgress(jobId, 5);

      // Show progress toast
      setGenerationProgress({
        open: true,
        status: 'loading',
        title: `Generating ${numImages > 1 ? numImages + ' ' : ''}AI image${numImages > 1 ? 's' : ''}...`,
        description: 'This may take 5-10 seconds. You can continue browsing.'
      });

      // Simulate progress during generation
      let currentProgress = 5;
      const progressInterval = setInterval(() => {
        currentProgress = Math.min(90, currentProgress + Math.random() * 15);
        setProgress(jobId, Math.round(currentProgress));
      }, 1500);

      const { image: savedImage, error } = await generateAiImageAction(
        brandId,
        image.id,
        image.prompt,
        image.title,
        options?.aspectRatio,
        options?.numberOfImages,
        options?.personGeneration
      );

      clearInterval(progressInterval);

      if (error) {
        failJob(jobId, error.join(', '));
        setGenerationProgress({
          open: true,
          status: 'error',
          title: 'Image generation failed',
          description: error.join(', ')
        });
        return;
      }

      await loadImages();

      completeJob(jobId, { resultUrl: '/images' });
      setGenerationProgress({
        open: true,
        status: 'success',
        title: 'Image generated successfully!',
        description: 'Opening your new image...'
      });

      if (savedImage) {
        setTimeout(() => {
          setActiveImage(savedImage);
          setPage('viewer');
        }, 1000);
      }
    },
    [loadImages, router, toast, brandId, isReadOnly, addJob, startJob, setProgress, completeJob, failJob]
  );

  const handleCancelEdit = useCallback(() => {
    router.replace('/images');
  }, [router]);

  const handleCloseViewer = useCallback(() => {
    setPage('gallery');
    setActiveImage(null);
  }, []);

  const handleCloseError = useCallback(() => {
    router.replace('/images');
    setErrorMessages([]);
  }, [router]);

  if (authLoading || !user) {
    return (
      <div className="flex h-full min-h-[calc(100vh-4rem)] flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <PageTransition className="bg-transparent text-foreground min-h-[calc(100vh-4rem)] font-sans">
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {page !== 'edit' && page !== 'generate' && (
          <header className="mb-8">
            <div className="mb-6">
              <button
                onClick={() => router.push('/media')}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4 group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span>Back to Media Library</span>
              </button>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground font-headline flex items-center gap-3">
                    <ImageIcon className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                    <span>AI Image Gallery</span>
                  </h1>
                  {isReadOnly && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-md text-amber-600 dark:text-amber-300">
                      <Eye className="w-4 h-4" />
                      <span className="text-sm font-medium">Read-Only View</span>
                    </div>
                  )}
                </div>
                {!isReadOnly && (
                  <button
                    onClick={() => {
                      const mode = galleryMode === 'editing' ? 'new' : 'generate';
                      const id = crypto.randomUUID();
                      router.push(`/images?${mode}=${id}`);
                    }}
                    className="px-6 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                  >
                    {galleryMode === 'editing' ? 'Edit Image' : 'Generate Image'}
                  </button>
                )}
              </div>
            </div>
            
            {/* Sleek Tab System */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 w-fit backdrop-blur-sm border border-border/50">
              <button
                onClick={() => setGalleryMode('editing')}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
                  galleryMode === 'editing'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Edit3 className="w-4 h-4" />
                <span>Image Editing</span>
              </button>
              <button
                onClick={() => setGalleryMode('generation')}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 ${
                  galleryMode === 'generation'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <Palette className="w-4 h-4" />
                <span>Image Generation</span>
              </button>
            </div>
          </header>
        )}

        {page === 'gallery' && (
          <div className="mb-6 flex flex-wrap gap-4 items-center">
            {/* Semantic Search Input */}
            <div className="relative flex-1 max-w-md">
              {isSearching ? (
                <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
              ) : (
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              )}
              <Input
                placeholder="Search images with AI... (e.g., 'sunset', 'product photo')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {searchResults && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {searchResults.length} results
              </Badge>
            )}

            <Select
              value={filters.userId || "all"}
              onValueChange={(value) => setFilters(prev => ({ ...prev, userId: value === "all" ? undefined : value }))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by Team Member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Team Members</SelectItem>
                {brandMembers.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.userDisplayName || member.userEmail}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.dateRange ? JSON.stringify(filters.dateRange) : "all"}
              onValueChange={(value) => {
                if (value === "all") {
                  setFilters(prev => ({ ...prev, dateRange: undefined }));
                } else {
                  setFilters(prev => ({ ...prev, dateRange: JSON.parse(value) }));
                }
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value={JSON.stringify({
                  start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                  end: new Date().toISOString()
                })}>Last 7 Days</SelectItem>
                <SelectItem value={JSON.stringify({
                  start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                  end: new Date().toISOString()
                })}>Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {(initialLoading || isSearching) && page === 'gallery' ? (
          <div className="flex h-full min-h-[calc(100vh-14rem)] flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">{isSearching ? 'Searching...' : 'Loading Images...'}</p>
          </div>
        ) : page === 'gallery' ? (() => {
          // Use search results if search is active, otherwise filter images based on gallery mode
          const isSearchActive = searchQuery.trim().length >= 2;
          // Check if we have search results (could be empty array [] or null)
          const hasSearchResults = searchResults !== null;
          const displayImages = isSearchActive && hasSearchResults
            ? searchResults
            : images.filter(image => {
                if (galleryMode === 'editing') {
                  // Show images with source URL (includes uploaded images and edited images)
                  return image.sourceImageUrl;
                } else {
                  // Show images with only generated URL (AI generated images from scratch)
                  return image.generatedImageUrl && !image.sourceImageUrl;
                }
              });

          console.log('[Image Gallery] Display state:', {
            isSearchActive,
            hasSearchResults,
            searchResultsLength: searchResults?.length ?? 'null',
            displayImagesLength: displayImages.length,
            searchQuery
          });

          return displayImages.length > 0 ? (
            <ImageGrid
              images={displayImages}
              onViewImage={handleViewImage}
              onDeleteImage={handleDeleteRequest}
              userDisplayNames={userDisplayNames}
            />
          ) : (
            <div className="text-center py-20">
              <h2 className="text-xl text-gray-400">
                {isSearchActive && hasSearchResults
                  ? 'No images found matching your search.'
                  : isSearchActive
                    ? 'Searching...'
                    : galleryMode === 'editing'
                      ? 'No images available for editing.'
                      : 'No AI generated images yet.'
                }
              </h2>
              <p className="text-gray-500 mt-2">
                {isSearchActive && hasSearchResults
                  ? 'Try a different search term or clear the search.'
                  : isSearchActive
                    ? 'Please wait while we search...'
                    : galleryMode === 'editing'
                      ? 'Upload images from Brand Soul or Brand Profile to edit them with AI.'
                      : 'Click "Generate Image" to create your first AI generated image.'
                }
              </p>
              {isSearchActive && hasSearchResults && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                  className="mt-4 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors"
                >
                  Clear Search
                </button>
              )}
            </div>
          );
        })() : null}
      </main>

      {page === 'viewer' && activeImage && (
        <ImageViewer
          image={activeImage}
          onClose={handleCloseViewer}
          onEdit={handleEditImage}
          onEditWithImageEditor={handleEditWithImageEditor}
          onTitleUpdate={(imageId, newTitle) => {
            // Update local state when title is changed
            setImages(prev => prev.map(img => img.id === imageId ? { ...img, title: newTitle } : img));
            setActiveImage(prev => prev && prev.id === imageId ? { ...prev, title: newTitle } : prev);
          }}
        />
      )}
      {page === 'edit' && activeImage && (
        <EditImagePage
          image={activeImage}
          onSave={handleSaveImage}
          onCancel={handleCancelEdit}
        />
      )}
      {page === 'generate' && activeImage && (
        <ImageGenerationPage
          image={activeImage}
          onSave={handleGenerateImage}
          onCancel={handleCancelEdit}
        />
      )}
      {page === 'error' && (
        <ErrorModal message={errorMessages} onClose={handleCloseError} />
      )}
      
      {/* Non-blocking progress toast */}
      <ProgressToast
        open={generationProgress.open}
        onOpenChange={(open) => setGenerationProgress(prev => ({ ...prev, open }))}
        status={generationProgress.status}
        title={generationProgress.title}
        description={generationProgress.description}
      />
      <AlertDialog
        open={!!imageToDelete}
        onOpenChange={(open) => !open && setImageToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <AlertTriangle className="inline-block mr-2 text-destructive" />
              Are you sure you want to delete this image?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the image titled &quot;
              {imageToDelete?.title}&quot; and its source file. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Yes, delete image
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageTransition>
  );
}

/**
 * The main component of the application that manages the state and flow of the image gallery.
 */
export default function ImagePage() {
  return (
    <Suspense>
      <ImagePageContent />
    </Suspense>
  );
}
