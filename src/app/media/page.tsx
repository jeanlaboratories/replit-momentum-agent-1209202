'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Upload, MoreVertical, RefreshCw, Loader2, X, Sparkles } from 'lucide-react';
import { MediaLibrarySidebar } from '@/components/media-library/media-library-sidebar';
import { VirtualMediaGrid } from '@/components/media-library/VirtualMediaGrid';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  getMediaPageAction,
  getAllMediaAction,
  getMediaStatsAction,
  getMediaCollectionsAction,
  createCollectionAction,
  syncBrandSoulAction,
  migrateExistingMediaAction,
  bulkMediaAction,
  uploadMediaAction,
  semanticSearchMediaAction,
  updateMediaAction,
  indexAllMediaAction,
  analyzeMediaVisionAction,
  getMediaByIdAction,
} from '@/lib/actions/media-library-actions';
import { getBrandMembersAction } from '@/app/actions/team-management';
import type { UnifiedMedia, MediaCollection, MediaSearchFilters } from '@/lib/types/media-library';
import type { BrandMember } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useJobQueue } from '@/contexts/job-queue-context';
import Image from 'next/image';
import { isSignedGcsUrl } from '@/lib/utils/image-proxy';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ToastAction } from '@/components/ui/toast';
import { shouldOptimizeImage } from '@/lib/image-utils';
import { useGlobalChatbot } from '@/contexts/global-chatbot-context';
import { CommentPanel } from '@/components/comments/CommentPanel';
import { PageTransition } from '@/components/ui/page-transition';
import { VisionAnalysisPanel } from '@/components/media-library/VisionAnalysisPanel';
import { isYouTubeUrl, getYouTubeEmbedUrl } from '@/lib/youtube';
import { EditableTitle } from '@/components/ui/editable-title';
import { MediaShareDialog } from '@/components/media-share-dialog';
import { Share2 } from 'lucide-react';

const ITEMS_PER_PAGE = 100; // Increased to show more items initially

export default function MediaLibraryPage() {
  const { user, loading: authLoading, brandId } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { openChatbot } = useGlobalChatbot();
  const { addJob, startJob, setProgress, completeJob, failJob, updateJob } = useJobQueue();

  // Data State
  const [media, setMedia] = React.useState<UnifiedMedia[]>([]);
  const [collections, setCollections] = React.useState<MediaCollection[]>([]);
  const [stats, setStats] = React.useState<{
    total: number;
    images: number;
    videos: number;
    brandSoul: number;
    aiGenerated: number;
    uploads: number;
  }>({ total: 0, images: 0, videos: 0, brandSoul: 0, aiGenerated: 0, uploads: 0 });
  const [brandMembers, setBrandMembers] = React.useState<BrandMember[]>([]);

  // Pagination State
  const [cursor, setCursor] = React.useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = React.useState(true);
  const [isFetching, setIsFetching] = React.useState(false);
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);

  // Filter & Selection State
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filters, setFilters] = React.useState<MediaSearchFilters>({});
  const [selectedMedia, setSelectedMedia] = React.useState<UnifiedMedia | null>(null);
  
  // UI State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [newCollectionName, setNewCollectionName] = React.useState('');
  const [newCollectionDescription, setNewCollectionDescription] = React.useState('');
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isIndexing, setIsIndexing] = React.useState(false);
  const [isAnalyzingVision, setIsAnalyzingVision] = React.useState(false);
  const [hasMigrated, setHasMigrated] = React.useState(false);
  const [isBulkActionLoading, setIsBulkActionLoading] = React.useState(false);
  const [isAddToCollectionDialogOpen, setIsAddToCollectionDialogOpen] = React.useState(false);
  const [isAddTagsDialogOpen, setIsAddTagsDialogOpen] = React.useState(false);
  const [isDeleteConfirmDialogOpen, setIsDeleteConfirmDialogOpen] = React.useState(false);
  const [bulkTags, setBulkTags] = React.useState('');
  const [selectedCollectionId, setSelectedCollectionId] = React.useState<string>('');
  const [isUploading, setIsUploading] = React.useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const lastRequestIdRef = React.useRef<number>(0);

  // Semantic Search State
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<UnifiedMedia[] | null>(null);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Initial Data Load
  React.useEffect(() => {
    async function loadInitialData() {
      if (!brandId) return;

      try {
        const [collectionsData, statsData, membersData] = await Promise.all([
          getMediaCollectionsAction(brandId),
          getMediaStatsAction(brandId),
          getBrandMembersAction(brandId),
        ]);

        setCollections(collectionsData);
        setStats(statsData);
        if (membersData.members) {
          setBrandMembers(membersData.members);
        }

        // Check for migration need
        if (statsData.total === 0 && !hasMigrated) {
          console.log('[Media Library] No media found, attempting auto-migration...');
          setHasMigrated(true);
          const migrateResult = await migrateExistingMediaAction(brandId);
          if (migrateResult.success && migrateResult.migrated && migrateResult.migrated.total > 0) {
            toast({
              title: 'Media Library Initialized',
              description: `Imported ${migrateResult.migrated.total} existing items.`,
            });
            // Reload stats after migration
            const newStats = await getMediaStatsAction(brandId);
            setStats(newStats);
          }
        }
      } catch (error) {
        console.error('[Media Library] Init error:', error);
      }
    }

    loadInitialData();
  }, [brandId, hasMigrated, toast]);

  // Fetch Media (Reset on filter change)
  const fetchMedia = React.useCallback(async (reset = false) => {
    if (!brandId) return;

    if (reset) {
      setIsInitialLoading(true);
      setCursor(undefined);
      setMedia([]);
      setHasMore(true);
    } else {
      setIsFetching(true);
    }

    try {
      const requestId = ++lastRequestIdRef.current;
      const currentCursor = reset ? undefined : cursor;
      
      // CRITICAL FIX: Use getAllMediaAction to bypass pagination limitations
      // The smartScanMedia fallback has scanning limits that prevent showing all items
      if (reset && Object.keys(filters).length === 0) {
        // For initial load with no filters, get all media to ensure we see everything
        const allMedia = await getAllMediaAction(brandId);
        
        if (requestId !== lastRequestIdRef.current) {
          return;
        }
        
        setMedia(allMedia);
        setCursor(undefined);
        setHasMore(false);
        setIsInitialLoading(false);
        setIsFetching(false);
        return;
      }
      
      const result = await getMediaPageAction(
        brandId,
        currentCursor,
        ITEMS_PER_PAGE,
        filters
      );

      // Ignore stale requests
      if (requestId !== lastRequestIdRef.current) {
        return;
      }

      if (result.error) {
        console.error('[Media Library] Fetch error from server:', result.error);
        toast({
          title: 'Error',
          description: `Error loading media: ${result.error}`,
          variant: 'destructive',
        });
      }

      setMedia(prev => reset ? result.items : [...prev, ...result.items]);
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('[Media Library] Fetch error:', error);
      toast({
        title: 'Error',
        description: 'Failed to load media',
        variant: 'destructive',
      });
    } finally {
      setIsInitialLoading(false);
      setIsFetching(false);
    }
  }, [brandId, cursor, filters, toast]);

  // Trigger fetch on filter change
  React.useEffect(() => {
    fetchMedia(true);
  }, [filters, brandId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadMore = () => {
    if (!isFetching && hasMore) {
      fetchMedia(false);
    }
  };

  // Semantic Search Handler
  const handleSemanticSearch = React.useCallback(async (query: string) => {
    if (!brandId || !query.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const searchOptions = {
        mediaType: filters.type as 'image' | 'video' | undefined,
        source: filters.source,
        collections: filters.collections,
        tags: filters.tags,
        limit: 50,
      };
      console.log('[Media Library Search] Starting search with options:', JSON.stringify(searchOptions, null, 2));
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
        // Convert search results to UnifiedMedia format
        const mediaResults: UnifiedMedia[] = response.results.map(result => {
          // Debug: Log ALL result data including vision analysis
          console.log('[Search Result] Converting result:', result.id, {
            hasVisionDescription: !!result.visionDescription,
            visionDescription: result.visionDescription,
            hasVisionKeywords: !!result.visionKeywords?.length,
            visionKeywords: result.visionKeywords,
            hasVisionCategories: !!result.visionCategories?.length,
            visionCategories: result.visionCategories,
            allKeys: Object.keys(result),
          });
          
          const converted: UnifiedMedia = {
            id: result.id,
            brandId: brandId,
            type: result.type,
            url: result.url,
            thumbnailUrl: result.thumbnailUrl || result.url,
            title: result.title,
            description: result.description,
            tags: result.tags || [],
            collections: [],
            source: result.source as UnifiedMedia['source'],
            createdAt: new Date().toISOString(),
            createdBy: '',
            // Include vision analysis fields - explicitly preserve them
            visionDescription: result.visionDescription ?? undefined,
            visionKeywords: result.visionKeywords ?? undefined,
            visionCategories: result.visionCategories ?? undefined,
            enhancedSearchText: result.enhancedSearchText ?? undefined,
          };
          
          // Debug: Log converted media to verify fields are preserved
          console.log('[Search Result] Converted media:', converted.id, {
            hasVisionDescription: !!converted.visionDescription,
            visionDescription: converted.visionDescription,
            hasVisionKeywords: !!converted.visionKeywords?.length,
            visionKeywords: converted.visionKeywords,
          });
          
          return converted;
        });
        setSearchResults(mediaResults);
      }
    } catch (error) {
      console.error('[Semantic Search] Error:', error);
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  }, [brandId, filters, toast]);

  // Debounced search effect
  React.useEffect(() => {
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

  // Clear search when filters change
  React.useEffect(() => {
    if (searchQuery.trim()) {
      handleSemanticSearch(searchQuery);
    }
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectMedia = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === media.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(media.map(m => m.id)));
    }
  };

  const handleCreateCollection = async () => {
    if (!brandId) return;
    
    if (!newCollectionName.trim()) {
      toast({
        title: 'Error',
        description: 'Collection name is required',
        variant: 'destructive',
      });
      return;
    }

    const result = await createCollectionAction(
      brandId,
      newCollectionName.trim(),
      newCollectionDescription.trim() || undefined
    );

    if (result.success) {
      toast({
        title: 'Success',
        description: 'Collection created successfully',
      });
      
      const updatedCollections = await getMediaCollectionsAction(brandId);
      setCollections(updatedCollections);
      
      setIsCreateDialogOpen(false);
      setNewCollectionName('');
      setNewCollectionDescription('');
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to create collection',
        variant: 'destructive',
      });
    }
  };

  const handleSyncLibrary = async () => {
    if (!brandId) return;
    
    setIsSyncing(true);
    toast({
      title: 'Syncing Library...',
      description: 'Checking for new videos, images, and brand soul assets...',
    });

    try {
      const result = await migrateExistingMediaAction(brandId);
      
      if (result.success && result.migrated) {
        const { total, videos, images, brandSoul } = result.migrated;
        if (total > 0) {
          toast({
            title: 'Sync Complete',
            description: `Synced ${total} items (${videos} videos, ${images} images, ${brandSoul} assets).`,
          });
          fetchMedia(true); // Reload media
        } else {
          toast({
            title: 'Already Up to Date',
            description: 'No new items found to sync.',
          });
        }
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to sync library',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to sync library',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleIndexMedia = async () => {
    if (!brandId) return;
    
    // Add job to queue
    const jobId = addJob({
      type: 'media-indexing',
      title: 'Indexing Media for Search',
      description: 'Preparing all media for semantic search...',
      resultUrl: '/media',
    });
    startJob(jobId);
    setProgress(jobId, 5);

    setIsIndexing(true);
    
    try {
      // Get total media count for progress tracking
      const statsData = await getMediaStatsAction(brandId);
      const totalMedia = statsData.total || 0;
      
      if (totalMedia === 0) {
        completeJob(jobId, { resultUrl: '/media' });
        toast({
          title: 'No Media to Index',
          description: 'No media items found to index.',
        });
        setIsIndexing(false);
        return;
      }

      setProgress(jobId, 10);
      updateJob(jobId, { description: `Indexing ${totalMedia} media items...` });

      // Simulate progress updates during indexing
      let currentProgress = 10;
      const progressInterval = setInterval(() => {
        currentProgress = Math.min(90, currentProgress + 5);
        setProgress(jobId, currentProgress);
      }, 2000); // Update every 2 seconds

      // Call the indexing action
      const result = await indexAllMediaAction(brandId);
      
      clearInterval(progressInterval);
      
      if (result.success) {
        setProgress(jobId, 100);
        completeJob(jobId, { resultUrl: '/media' });
        
        // Show success message with error count if any
        const errorCount = result.errors?.length || 0;
        const description = errorCount > 0
          ? `Indexed ${result.indexed || 0} media items. ${errorCount} errors occurred.`
          : `${result.indexed || 0} media items indexed for search.`;
        
        toast({
          title: 'Indexing Complete',
          description,
        });
      } else {
        failJob(jobId, result.error || 'Failed to index media for search');
        
        // Show detailed error message
        let errorDescription = result.error || 'Failed to index media for search';
        if (result.errors && result.errors.length > 0) {
          errorDescription += `\n\nErrors:\n${result.errors.slice(0, 5).join('\n')}`;
          if (result.errors.length > 5) {
            errorDescription += `\n... and ${result.errors.length - 5} more errors`;
          }
        }
        
        toast({
          title: 'Indexing Failed',
          description: errorDescription,
          variant: 'destructive',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to index media for search';
      failJob(jobId, errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsIndexing(false);
    }
  };

  const handleVisionAnalysis = async () => {
    if (!brandId) return;
    
    // Add job to queue
    const jobId = addJob({
      type: 'vision-analysis' as any,
      title: 'Analyzing Media with AI Vision',
      description: 'Enhancing search capabilities with AI-powered image and video analysis...',
      resultUrl: '/media',
    });
    startJob(jobId);
    setProgress(jobId, 5);

    setIsAnalyzingVision(true);
    
    try {
      // Get total media count for progress tracking (images + videos)
      const statsData = await getMediaStatsAction(brandId);
      const totalImages = statsData.images || 0;
      const totalVideos = statsData.videos || 0;
      const totalMedia = totalImages + totalVideos;
      
      if (totalMedia === 0) {
        completeJob(jobId, { resultUrl: '/media' });
        toast({
          title: 'No Media to Analyze',
          description: 'No image or video files found to analyze.',
        });
        setIsAnalyzingVision(false);
        return;
      }

      setProgress(jobId, 10);
      const mediaDescription = totalVideos > 0 
        ? `Analyzing ${totalImages} images and ${totalVideos} videos with AI vision...`
        : `Analyzing ${totalImages} images with AI vision...`;
      updateJob(jobId, { description: mediaDescription });

      // Simulate progress updates during analysis
      let currentProgress = 10;
      const progressInterval = setInterval(() => {
        currentProgress = Math.min(90, currentProgress + 5);
        setProgress(jobId, currentProgress);
      }, 3000); // Update every 3 seconds (vision analysis is slower)

      // Call the vision analysis action
      const result = await analyzeMediaVisionAction(brandId, { analyzeAll: true });
      
      clearInterval(progressInterval);
      
      if (result.success) {
        setProgress(jobId, 100);
        completeJob(jobId, { resultUrl: '/media' });
        
        // Show success message with analysis count
        const errorCount = result.errors?.length || 0;
        const description = errorCount > 0
          ? `Analyzed ${result.analyzed || 0}/${result.total || 0} media items. ${errorCount} errors occurred.`
          : `${result.analyzed || 0}/${result.total || 0} media items analyzed with AI vision.`;
        
        toast({
          title: 'Vision Analysis Complete',
          description,
          action: result.analyzed && result.analyzed > 0 ? (
            <ToastAction altText="Refresh to see enhanced search">
              Refresh
            </ToastAction>
          ) : undefined,
        });

        // Refresh media to show vision data
        if (result.analyzed && result.analyzed > 0) {
          fetchMedia(true);
        }
      } else {
        failJob(jobId, result.error || 'Failed to analyze images');
        
        toast({
          title: 'Vision Analysis Failed',
          description: result.error || 'Failed to analyze media',
          variant: 'destructive',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze media';
      failJob(jobId, errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzingVision(false);
    }
  };

  const handleBulkAction = async (action: 'add-tags' | 'add-to-collection' | 'delete' | 'publish' | 'unpublish') => {
    if (!brandId || selectedIds.size === 0) return;

    setIsBulkActionLoading(true);
    
    try {
      let payload: { tags?: string[]; collectionId?: string } | undefined;

      if (action === 'add-tags') {
        const tags = bulkTags.split(',').map(t => t.trim()).filter(Boolean);
        if (tags.length === 0) return;
        payload = { tags };
      } else if (action === 'add-to-collection') {
        if (!selectedCollectionId) return;
        payload = { collectionId: selectedCollectionId };
      }

      const result = await bulkMediaAction(
        brandId,
        Array.from(selectedIds),
        action,
        payload
      );

      if (result.success) {
        toast({
          title: 'Success',
          description: `Successfully processed ${result.modified} items`,
        });
        
        // Reset state
        setSelectedIds(new Set());
        setIsAddToCollectionDialogOpen(false);
        setIsAddTagsDialogOpen(false);
        setBulkTags('');
        setSelectedCollectionId('');

        // Refresh data
        fetchMedia(true);

        // Refresh collections if needed
        if (action === 'add-to-collection' || action === 'delete') {
          const updatedCollections = await getMediaCollectionsAction(brandId);
          setCollections(updatedCollections);
        }
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Bulk action failed',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[Bulk Action] Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to perform bulk action',
        variant: 'destructive',
      });
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !brandId) return;

    // Reset input so same file can be selected again if needed
    e.target.value = '';

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      toast({
        title: 'Invalid File Type',
        description: 'Please upload an image or video file.',
        variant: 'destructive',
      });
      return;
    }

    // Max size check (e.g., 100MB)
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'File size must be less than 100MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    toast({
      title: 'Uploading...',
      description: `Uploading ${file.name}...`,
    });

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];

        const result = await uploadMediaAction(brandId, {
          name: file.name,
          type: file.type,
          size: file.size,
          base64Data,
        });

        if (result.success) {
          toast({
            title: 'Upload Complete',
            description: 'File uploaded successfully.',
          });
          fetchMedia(true);
        } else {
          toast({
            title: 'Upload Failed',
            description: result.error || 'Failed to upload file.',
            variant: 'destructive',
          });
        }
        setIsUploading(false);
      };

      reader.onerror = () => {
        toast({
          title: 'Error',
          description: 'Failed to read file.',
          variant: 'destructive',
        });
        setIsUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
      setIsUploading(false);
    }
  };

  if (authLoading || !user) {
    return null;
  }

  return (
    <PageTransition className="flex h-[calc(100vh-4rem)] w-full">
      <SidebarProvider defaultOpen={true}>
        <MediaLibrarySidebar
          collections={collections}
          activeFilters={filters}
          onFilterChange={setFilters}
          onCreateCollection={() => setIsCreateDialogOpen(true)}
          stats={stats}
          users={brandMembers}
        />
        <SidebarInset className="flex-1 overflow-hidden flex flex-col">
          <div className="container py-6 space-y-6 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <div>
                  <h1 className="text-3xl font-bold">Media Library</h1>
                  <p className="text-muted-foreground">
                    Showing {media.length.toLocaleString()} of {stats.total.toLocaleString()} items
                    {hasMore && media.length > 0 && (
                      <span className="ml-2 text-amber-600">• Scroll down or click "Load All" to see more</span>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleSyncLibrary}
                  disabled={isSyncing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                  Sync Library
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleIndexMedia}
                  disabled={isIndexing}
                >
                  <Search className={`h-4 w-4 mr-2 ${isIndexing ? 'animate-pulse' : ''}`} />
                  {isIndexing ? 'Indexing...' : 'Index for Search'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleVisionAnalysis}
                  disabled={isAnalyzingVision}
                >
                  <Sparkles className={`h-4 w-4 mr-2 ${isAnalyzingVision ? 'animate-pulse' : ''}`} />
                  {isAnalyzingVision ? 'Analyzing...' : 'AI Vision Analysis'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setFilters({})}
                  disabled={Object.keys(filters).length === 0}
                  className={Object.keys(filters).length === 0 ? 'opacity-50' : ''}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleUploadClick}
                  disabled={isUploading}
                >
                  <Upload className={`h-4 w-4 mr-2 ${isUploading ? 'animate-bounce' : ''}`} />
                  {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                />
                {selectedIds.size > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <MoreVertical className="h-4 w-4 mr-2" />
                        {selectedIds.size} selected
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => {
                        const selectedItems = media.filter(m => selectedIds.has(m.id));
                        const attachments = selectedItems.map(item => ({
                          type: item.type === 'image' ? 'image' : 'video',
                          url: item.url,
                          fileName: item.title,
                          mimeType: item.type === 'image' ? 'image/png' : 'video/mp4' // Approximate
                        }));
                        // @ts-ignore - MediaAttachment type mismatch between local and global
                        openChatbot({ attachments });
                      }}>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Send to Agent
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setIsAddToCollectionDialogOpen(true)}>
                        Add to Collection
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setIsAddTagsDialogOpen(true)}>
                        Add Tags
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setIsDeleteConfirmDialogOpen(true)}
                      >
                        Delete Selected
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleBulkAction('publish')}>
                        Publish Selected
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkAction('unpublish')}>
                        Unpublish Selected
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            {/* ... existing code ... */}

            <Dialog open={isAddToCollectionDialogOpen} onOpenChange={setIsAddToCollectionDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add to Collection</DialogTitle>
                  <DialogDescription>
                    Add {selectedIds.size} items to a collection
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="collection-select">Select Collection</Label>
                  <select
                    id="collection-select"
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={selectedCollectionId}
                    onChange={(e) => setSelectedCollectionId(e.target.value)}
                  >
                    <option value="">Select a collection...</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddToCollectionDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleBulkAction('add-to-collection')}
                    disabled={!selectedCollectionId || isBulkActionLoading}
                  >
                    {isBulkActionLoading ? 'Adding...' : 'Add to Collection'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isDeleteConfirmDialogOpen} onOpenChange={setIsDeleteConfirmDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Media</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete {selectedIds.size} items? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDeleteConfirmDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setIsDeleteConfirmDialogOpen(false);
                      handleBulkAction('delete');
                    }}
                    disabled={isBulkActionLoading}
                  >
                    {isBulkActionLoading ? 'Deleting...' : 'Delete'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddTagsDialogOpen} onOpenChange={setIsAddTagsDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Tags</DialogTitle>
                  <DialogDescription>
                    Add tags to {selectedIds.size} items (comma separated)
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="bulk-tags">Tags</Label>
                  <Input
                    id="bulk-tags"
                    placeholder="e.g., campaign, summer, 2024"
                    value={bulkTags}
                    onChange={(e) => setBulkTags(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddTagsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleBulkAction('add-tags')}
                    disabled={!bulkTags.trim() || isBulkActionLoading}
                  >
                    {isBulkActionLoading ? 'Adding...' : 'Add Tags'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="flex gap-4 flex-shrink-0">
              <div className="relative flex-1 max-w-md">
                {isSearching ? (
                  <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
                ) : (
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                )}
                <Input
                  placeholder="Search media with AI... (e.g., 'blue background', 'product photos')"
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

              <div className="flex gap-2">
                {!searchResults && hasMore && (
                  <Button variant="outline" onClick={async () => {
                    // Load all remaining items using getAllMediaAction
                    setIsFetching(true);
                    try {
                      const allMedia = await getAllMediaAction(brandId!);
                      setMedia(allMedia);
                      setHasMore(false);
                      setCursor(undefined);
                      toast({
                        title: 'All Media Loaded',
                        description: `Showing all ${allMedia.length} items`,
                      });
                    } catch (error) {
                      console.error('Failed to load all media:', error);
                      toast({
                        title: 'Error',
                        description: 'Failed to load all media',
                        variant: 'destructive',
                      });
                    } finally {
                      setIsFetching(false);
                    }
                  }} disabled={isFetching}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                    Load All ({stats.total - media.length} more)
                  </Button>
                )}
                <Button variant="outline" onClick={handleSelectAll}>
                  {selectedIds.size === (searchResults || media).length && (searchResults || media).length > 0
                    ? 'Deselect All'
                    : 'Select All'}
                </Button>
              </div>
            </div>

            <div className="flex-1 min-h-0 border rounded-lg bg-background/50 backdrop-blur-sm relative flex flex-col">
              {((searchResults || media).length > 0 || isInitialLoading || isSearching) ? (
                <>
                  <div className="flex-1 min-h-0">
                    <VirtualMediaGrid
                      media={searchResults || media}
                      selectedIds={selectedIds}
                      onSelectMedia={handleSelectMedia}
                      onMediaClick={async (media) => {
                    // Debug: Log what media is being selected
                    console.log('[Media Click] Selecting media:', media.id, {
                      hasVisionDescription: !!media.visionDescription,
                      visionDescription: media.visionDescription,
                      hasVisionKeywords: !!media.visionKeywords?.length,
                      visionKeywords: media.visionKeywords,
                      allKeys: Object.keys(media),
                      isFromSearch: !!searchResults,
                    });
                    
                    // Always fetch the full media item from Firestore to ensure we have all fields
                    // This is especially important for search results which may not include all fields
                    try {
                      if (brandId) {
                        const fullMedia = await getMediaByIdAction(media.id, brandId);
                        if (fullMedia) {
                          console.log('[Media Click] Fetched full media from Firestore:', fullMedia.id, {
                            hasVisionDescription: !!fullMedia.visionDescription,
                            visionDescription: fullMedia.visionDescription,
                            hasVisionKeywords: !!fullMedia.visionKeywords?.length,
                            visionKeywords: fullMedia.visionKeywords,
                          });
                          setSelectedMedia(fullMedia);
                        } else {
                          // Fallback to the media we have if fetch fails
                          console.warn('[Media Click] Failed to fetch full media, using search result');
                          setSelectedMedia(media);
                        }
                      } else {
                        setSelectedMedia(media);
                      }
                    } catch (error) {
                      console.error('[Media Click] Error fetching full media:', error);
                      // Fallback to the media we have
                      setSelectedMedia(media);
                    }
                  }}
                  isLoading={isInitialLoading || isSearching}
                  hasMore={searchResults ? false : hasMore}
                  onLoadMore={searchResults ? () => {} : handleLoadMore}
                      isFetchingNextPage={isFetching}
                      brandMembers={brandMembers}
                    />
                  </div>
                  
                  {/* Bottom pagination indicator */}
                  {!searchResults && hasMore && media.length > 0 && (
                    <div className="border-t bg-background/80 backdrop-blur-sm p-3 flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Showing {media.length} of {stats.total} items
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={async () => {
                          setIsFetching(true);
                          try {
                            const allMedia = await getAllMediaAction(brandId!);
                            setMedia(allMedia);
                            setHasMore(false);
                            setCursor(undefined);
                            toast({
                              title: 'All Media Loaded',
                              description: `Showing all ${allMedia.length} items`,
                            });
                          } catch (error) {
                            console.error('Failed to load all media:', error);
                            toast({
                              title: 'Error',
                              description: 'Failed to load all media',
                              variant: 'destructive',
                            });
                          } finally {
                            setIsFetching(false);
                          }
                        }}
                        disabled={isFetching}
                      >
                        {isFetching ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Load All ({stats.total - media.length} remaining)
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-muted-foreground mb-4">
                      {searchQuery ? 'No media found matching your search.' : 'No media found matching your filters.'}
                    </p>
                    {searchQuery && (
                      <Button variant="outline" onClick={() => { setSearchQuery(''); setSearchResults(null); }}>
                        Clear Search
                      </Button>
                    )}
                </div>
              )}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Collection</DialogTitle>
            <DialogDescription>
              Organize your media into collections
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="collection-name">Name</Label>
              <Input
                id="collection-name"
                placeholder="e.g., Product Photos"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="collection-description">Description (optional)</Label>
              <Input
                id="collection-description"
                placeholder="e.g., Images for product catalog"
                value={newCollectionDescription}
                onChange={(e) => setNewCollectionDescription(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCollection}>
              Create Collection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedMedia} onOpenChange={(open) => !open && setSelectedMedia(null)}>
        <DialogContent className="max-w-7xl h-[90vh] p-0 overflow-hidden flex flex-col md:flex-row gap-0">
          {selectedMedia && (
            <>
              {/* Left: Immersive Media View */}
              <div className="flex-1 bg-black flex items-center justify-center relative min-h-[40vh] md:min-h-full overflow-hidden group">
                {selectedMedia.type === 'image' ? (
                  isSignedGcsUrl(selectedMedia.url) ? (
                    <img
                      src={selectedMedia.url}
                      alt={selectedMedia.title}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                      <div className="relative w-full h-full">
                        <Image
                          src={selectedMedia.url}
                          alt={selectedMedia.title}
                          fill
                          className="object-contain"
                          unoptimized={!shouldOptimizeImage(selectedMedia.url)}
                        />
                      </div>
                  )
                ) : (
                    isYouTubeUrl(selectedMedia.url) ? (
                      <iframe
                        src={getYouTubeEmbedUrl(selectedMedia.url) || ''}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                        <video
                          src={selectedMedia.url}
                          controls
                          className="max-w-full max-h-full"
                        />
                      )
                )}
              </div>

              {/* Right: Sidebar for Details & Comments */}
              <div className="w-full md:w-[400px] flex flex-col bg-background border-l h-full overflow-hidden">
                <div className="p-6 border-b space-y-4 overflow-y-auto max-h-[40vh] flex-shrink-0">
                  <div>
                    <DialogHeader className="p-0 space-y-1">
                      {/* Visually hidden DialogTitle for accessibility */}
                      <DialogTitle className="sr-only">{selectedMedia.title}</DialogTitle>
                      <EditableTitle
                        value={selectedMedia.title}
                        onSave={async (newTitle) => {
                          if (!brandId) return;
                          const result = await updateMediaAction(brandId, selectedMedia.id, { title: newTitle });
                          if (result.success) {
                            // Update local state
                            setSelectedMedia({ ...selectedMedia, title: newTitle });
                            setMedia(prev => prev.map(m => m.id === selectedMedia.id ? { ...m, title: newTitle } : m));
                            toast({ title: 'Title updated', description: 'Media title has been saved.' });
                          } else {
                            toast({ title: 'Error', description: result.error || 'Failed to update title', variant: 'destructive' });
                            throw new Error(result.error);
                          }
                        }}
                        size="lg"
                        placeholder="Untitled"
                      />
                      {selectedMedia.description && (
                        <DialogDescription className="text-base">{selectedMedia.description}</DialogDescription>
                      )}
                    </DialogHeader>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">Type</p>
                      <p className="font-medium capitalize">{selectedMedia.type}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">Source</p>
                      <p className="font-medium capitalize">{selectedMedia.source?.replace('-', ' ')}</p>
                    </div>
                    {selectedMedia.createdAt && (
                      <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-1">Created</p>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {typeof selectedMedia.createdAt === 'string'
                              ? new Date(selectedMedia.createdAt).toLocaleDateString()
                              : (selectedMedia.createdAt as any).toDate().toLocaleDateString()}
                          </p>
                          {(() => {
                            const userId = selectedMedia.createdBy || selectedMedia.uploadedBy;
                            const member = brandMembers.find(m => m.userId === userId);
                            if (!member) return null;
                            return (
                              <Link href={`/brand-profile/personal?userId=${userId}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                                <Avatar className="h-4 w-4">
                                  {member.userPhotoURL ? (
                                    <AvatarImage src={member.userPhotoURL} />
                                  ) : (
                                    <AvatarFallback className="text-[8px]">{member.userDisplayName?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                  )}
                                </Avatar>
                                <span>{member.userDisplayName}</span>
                              </Link>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Audit Trail */}
                  {selectedMedia.auditTrail && selectedMedia.auditTrail.length > 0 && (
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-2">Audit Trail</p>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                        {selectedMedia.auditTrail.map((event, i) => {
                          const member = brandMembers.find(m => m.userId === event.userId);
                          return (
                            <div key={i} className="flex items-start gap-2 text-xs border-l-2 border-muted pl-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-1">
                                  <span className="font-medium capitalize">{event.action}</span>
                                  <span className="text-muted-foreground">by</span>
                                  <Link href={`/brand-profile/personal?userId=${event.userId}`} className="font-medium hover:text-primary transition-colors">
                                    {member?.userDisplayName || 'Unknown'}
                                  </Link>
                                </div>
                                <div className="text-muted-foreground text-[10px]">
                                  {new Date(event.timestamp).toLocaleString()}
                                </div>
                                {event.details && (
                                  <div className="text-muted-foreground mt-0.5">{event.details}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* AI Generation Info - Show for AI generated OR if there's a prompt (e.g., from uploaded image analysis) */}
                  {(selectedMedia.source === 'ai-generated' || selectedMedia.prompt || selectedMedia.description) && (
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-2">
                        {selectedMedia.source === 'ai-generated' ? 'AI Generation' : 'Media Description'}
                      </p>
                      <div className="bg-muted/50 rounded-lg p-3 space-y-3">
                        {(selectedMedia.prompt || selectedMedia.description) && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Prompt / Description</p>
                            <p className="text-sm italic">"{selectedMedia.prompt || selectedMedia.description}"</p>
                          </div>
                        )}
                        {(selectedMedia.inputImageUrl || selectedMedia.characterReferenceUrl || selectedMedia.startFrameUrl || selectedMedia.endFrameUrl) && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-2">Input Images</p>
                            <div className="grid grid-cols-2 gap-2">
                              {selectedMedia.inputImageUrl && (
                                <div className="relative aspect-square rounded border overflow-hidden bg-black">
                                  <img src={selectedMedia.inputImageUrl} alt="Input" className="object-contain w-full h-full" />
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-white px-1 py-0.5">Input</div>
                                </div>
                              )}
                              {selectedMedia.characterReferenceUrl && (
                                <div className="relative aspect-square rounded border overflow-hidden bg-black">
                                  <img src={selectedMedia.characterReferenceUrl} alt="Character Ref" className="object-contain w-full h-full" />
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-white px-1 py-0.5">Char Ref</div>
                                </div>
                              )}
                              {selectedMedia.startFrameUrl && (
                                <div className="relative aspect-square rounded border overflow-hidden bg-black">
                                  <img src={selectedMedia.startFrameUrl} alt="Start Frame" className="object-contain w-full h-full" />
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-white px-1 py-0.5">Start</div>
                                </div>
                              )}
                              {selectedMedia.endFrameUrl && (
                                <div className="relative aspect-square rounded border overflow-hidden bg-black">
                                  <img src={selectedMedia.endFrameUrl} alt="End Frame" className="object-contain w-full h-full" />
                                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-white px-1 py-0.5">End</div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedMedia.tags && selectedMedia.tags.length > 0 && (
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium mb-2">Tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedMedia.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="px-2 py-0.5 text-xs font-normal">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Vision Analysis Panel */}
                  {(selectedMedia.type === 'image' || selectedMedia.type === 'video') && (
                    <div>
                      {/* Debug: Log selected media vision analysis */}
                      {(() => {
                        console.log('[Selected Media] Vision analysis data:', {
                          id: selectedMedia.id,
                          type: selectedMedia.type,
                          hasVisionDescription: !!selectedMedia.visionDescription,
                          visionDescription: selectedMedia.visionDescription,
                          hasVisionKeywords: !!selectedMedia.visionKeywords?.length,
                          visionKeywords: selectedMedia.visionKeywords,
                          hasVisionCategories: !!selectedMedia.visionCategories?.length,
                          visionCategories: selectedMedia.visionCategories,
                          allKeys: Object.keys(selectedMedia),
                        });
                        return null;
                      })()}
                      <VisionAnalysisPanel key={selectedMedia.id} media={selectedMedia} />
                    </div>
                  )}
                </div>

                {/* Comments Section - Flex Grow */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-muted/5">
                  <CommentPanel
                    brandId={brandId || ''}
                    contextType={selectedMedia.type === 'video' ? 'video' : 'image'}
                    contextId={selectedMedia.id}
                    title="Comments"
                    initiallyExpanded={true}
                    variant="sidebar"
                    className="h-full"
                  />
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t bg-background flex items-center justify-between gap-3">
                  <Button variant="outline" onClick={() => setSelectedMedia(null)} className="flex-1">
                    Close
                  </Button>
                  <Button variant="outline" onClick={() => setIsShareDialogOpen(true)} className="flex-1">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                  <Button asChild className="flex-1">
                    <a href={selectedMedia.url} download target="_blank" rel="noopener noreferrer">
                      Download
                    </a>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Media Share Dialog */}
      {selectedMedia && (
        <MediaShareDialog
          isOpen={isShareDialogOpen}
          onOpenChange={setIsShareDialogOpen}
          mediaUrl={selectedMedia.url}
          mediaType={selectedMedia.type === 'video' ? 'video' : 'image'}
          mediaTitle={selectedMedia.title || selectedMedia.prompt || ''}
          brandId={brandId || undefined}
          mediaId={selectedMedia.id}
        />
      )}

    </PageTransition>
  );
}
