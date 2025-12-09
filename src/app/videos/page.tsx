
'use client';

import React, {useCallback, useEffect, useState, Suspense} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import {
  generateVideoAction,
  getVideosAction,
  deleteVideoAction,
  getUserDisplayNamesAction,
} from '@/app/actions';
import { semanticSearchMediaAction } from '@/lib/actions/media-library-actions';
import { getBrandMembersAction } from '@/app/actions/team-management';
import {EditVideoPage} from '@/components/EditVideoPage';
import {ErrorModal} from '@/components/ErrorModal';
import {VideoCameraIcon} from '@/components/icons';
import {VideoGrid} from '@/components/VideoGrid';
import {VideoPlayer} from '@/components/VideoPlayer';
import {Video} from '@/lib/types';
import { BrandMember } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Trash2, AlertTriangle, Eye, ArrowLeft, Search, X, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

type Page = 'gallery' | 'edit' | 'player' | 'error';
export const maxDuration = 300; // 5 minutes

function VideoPageContent() {
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
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);
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
  const [searchResults, setSearchResults] = useState<Video[] | null>(null);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const loadVideos = useCallback(async () => {
    if (!brandId) return;
    setInitialLoading(true);
    const [fetchedVideos, membersData] = await Promise.all([
      getVideosAction(brandId, filters),
      getBrandMembersAction(brandId)
    ]);

    setVideos(fetchedVideos);
    if (membersData.members) {
      setBrandMembers(membersData.members);
    }
    
    // Extract all unique user IDs from videos
    const userIds = new Set<string>();
    fetchedVideos.forEach(video => {
      if (video.generatedBy) userIds.add(video.generatedBy);
      if (video.uploadedBy) userIds.add(video.uploadedBy);
    });
    
    // Fetch display names for all users
    if (userIds.size > 0) {
      const displayNames = await getUserDisplayNamesAction(Array.from(userIds));
      setUserDisplayNames(displayNames);
    }
    
    setInitialLoading(false);
  }, [brandId, filters]);

  useEffect(() => {
    if(user && brandId) {
      loadVideos();
    }
  }, [loadVideos, user, brandId]);

  // Semantic Search Handler - EXACT SAME IMPLEMENTATION AS MEDIA LIBRARY
  // This matches Media Library's search when filters.type === 'video'
  const handleSemanticSearch = useCallback(async (query: string) => {
    if (!brandId || !query.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      // Use EXACT same search options structure as Media Library
      // Media Library uses: { mediaType: filters.type, source: filters.source, collections: filters.collections, tags: filters.tags, limit: 50 }
      // For Video Gallery, we simulate filters.type === 'video' with other filters as undefined
      // This ensures identical search behavior when Media Library has video filter applied
      const searchOptions = {
        mediaType: 'video' as 'image' | 'video' | undefined, // Same as filters.type === 'video' in Media Library
        source: undefined, // Same as filters.source === undefined (no source filter)
        collections: undefined, // Same as filters.collections === undefined (no collection filter)
        tags: undefined, // Same as filters.tags === undefined (no tag filter)
        limit: 50, // Same limit
      };
      console.log('[Video Gallery Search] Starting search with options:', JSON.stringify(searchOptions, null, 2));
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
        // Convert search results to Video format (Media Library converts to UnifiedMedia)
        // Use the same conversion pattern as Media Library - map all results
        const videoResults: Video[] = response.results.map(result => {
          // Debug: Log ALL result data including vision analysis (same as Media Library)
          console.log('[Search Result] Converting result:', result.id, {
            hasVisionDescription: !!result.visionDescription,
            visionDescription: result.visionDescription,
            hasVisionKeywords: !!result.visionKeywords?.length,
            visionKeywords: result.visionKeywords,
            hasVisionCategories: !!result.visionCategories?.length,
            visionCategories: result.visionCategories,
            allKeys: Object.keys(result),
          });
          
          const converted: Video = {
            id: result.id,
            brandId: brandId,
            title: result.title || 'Untitled Video',
            description: result.description || '',
            videoUrl: result.url || '',
            // Preserve vision analysis data from search results
            visionDescription: result.visionDescription,
            visionKeywords: result.visionKeywords,
            visionCategories: result.visionCategories,
          };
          
          // Debug: Log converted video to verify fields are preserved (same pattern as Media Library)
          console.log('[Search Result] Converted video:', converted.id, {
            title: converted.title,
            source: result.source,
            videoUrl: converted.videoUrl,
          });
          
          return converted;
        });
        setSearchResults(videoResults);
      }
    } catch (error) {
      console.error('[Semantic Search] Error:', error);
      setSearchResults(null); // Removed toast to match Media Library's catch block
    } finally {
      setIsSearching(false);
    }
  }, [brandId, toast]);

  // Debounced search effect - EXACT SAME IMPLEMENTATION AS MEDIA LIBRARY
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmedQuery = searchQuery.trim();
    console.log('[Video Gallery] Search query changed:', { 
      query: searchQuery, 
      trimmedLength: trimmedQuery.length,
      brandId: brandId ? 'present' : 'missing'
    });

    if (trimmedQuery.length >= 2) {
      console.log('[Video Gallery] Scheduling search in 300ms...');
      searchTimeoutRef.current = setTimeout(() => {
        console.log('[Video Gallery] Executing search now...');
        handleSemanticSearch(trimmedQuery);
      }, 300);
    } else {
      console.log('[Video Gallery] Query too short, clearing results');
      setSearchResults(null);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, handleSemanticSearch, brandId]);

  const newVideoId = searchParams.get('new');
  const editVideoId = searchParams.get('edit');

  useEffect(() => {
    // Block edit modes for sponsored users
    if (isReadOnly && (newVideoId || editVideoId)) {
      // toast({
      //   variant: 'destructive',
      //   title: 'Read-Only Access',
      //   description: 'You cannot edit or generate videos while viewing a sponsored brand profile.',
      // });
      router.replace('/videos');
      return;
    }
    
    if (newVideoId && brandId) {
      const newVideo: Video = {
        id: newVideoId,
        brandId: brandId,
        title: 'New video',
        description: '',
        videoUrl: '',
      };
      setActiveVideo(newVideo);
      setPage('edit');
    } else if (editVideoId) {
        const videoToEdit = videos.find(v => v.id === editVideoId);
        if (videoToEdit) {
            setActiveVideo(videoToEdit);
            setPage('edit');
        } else if (!initialLoading) {
            // toast({
            //   variant: 'destructive',
            //   title: 'Video not found',
            //   description: `Could not find a video with ID: ${editVideoId}`
            // });
            router.replace('/videos');
        }
    } else {
        setPage('gallery');
        setActiveVideo(null);
    }
  }, [newVideoId, editVideoId, videos, router, toast, initialLoading, brandId, isReadOnly]);

  const handlePlayVideo = useCallback(
    (video: Video) => {
      setActiveVideo(video);
      setPage('player');
    },
    [setActiveVideo, setPage]
  );

  const handleDeleteRequest = useCallback((video: Video) => {
    // Prevent deletion in read-only mode
    if (isReadOnly) {
      // toast({
      //   variant: 'destructive',
      //   title: 'Read-Only Access',
      //   description: 'You cannot delete videos while viewing a sponsored brand profile.',
      // });
      return;
    }
    setVideoToDelete(video);
  }, [isReadOnly, toast]);

  const handleConfirmDelete = async () => {
    if (!videoToDelete) return;
    
    // Double-check read-only protection
    if (isReadOnly) {
      // toast({
      //   variant: 'destructive',
      //   title: 'Read-Only Access',
      //   description: 'You cannot delete videos while viewing a sponsored brand profile.',
      // });
      return;
    }
    
    setIsDeleting(true);
    const result = await deleteVideoAction(videoToDelete.id);
    setIsDeleting(false);

    if (result.success) {
      setVideos((prev) => prev.filter((v) => v.id !== videoToDelete.id));
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
    setVideoToDelete(null);
  };


  const handleEditVideo = useCallback(
    (video: Video) => {
      router.push(`/videos?edit=${video.id}`);
    },
    [router]
  );

  const handleSaveVideo = useCallback(
    async (video: Video, inputs?: {
      imageUrl?: string;
      characterReferenceUrl?: string;
      startFrameUrl?: string;
      endFrameUrl?: string;
      resolution?: '720p' | '1080p';
      durationSeconds?: 4 | 6 | 8;
      personGeneration?: string;
      videoUrl?: string;
      referenceImages?: string[];
      useFastModel?: boolean;
      veoVideoUri?: string;  // Gemini API file URI for video extension
    }) => {
      if (!brandId) return;

      // Prevent saving in read-only mode
      if (isReadOnly) {
        toast({
          variant: 'destructive',
          title: 'Read-Only Access',
          description: 'You cannot generate videos while viewing a sponsored brand profile.',
        });
        return;
      }

      // Close the dialog immediately and return to gallery
      router.replace('/videos', { scroll: false });
      setPage('gallery');

      // Add job to queue
      const jobId = addJob({
        type: 'video-generation',
        title: `Generating: ${video.title}`,
        description: 'Creating AI video',
        resultUrl: '/videos',
      });
      startJob(jobId);
      setProgress(jobId, 5);

      // Show progress toast
      setGenerationProgress({
        open: true,
        status: 'loading',
        title: 'Generating video...',
        description: 'This may take 30-60 seconds. You can continue browsing.'
      });

      // Simulate progress during generation (slower for video)
      let currentProgress = 5;
      const progressInterval = setInterval(() => {
        currentProgress = Math.min(90, currentProgress + Math.random() * 8);
        setProgress(jobId, Math.round(currentProgress));
      }, 3000);

      // Generate video in background
      const {video: savedVideo, error} = await generateVideoAction(
        brandId,
        video.id,
        video.description,
        video.title,
        inputs?.imageUrl,
        inputs?.characterReferenceUrl,
        inputs?.startFrameUrl,
        inputs?.endFrameUrl,
        inputs?.resolution,
        inputs?.durationSeconds,
        inputs?.personGeneration,
        inputs?.videoUrl,
        inputs?.referenceImages,
        inputs?.useFastModel,
        inputs?.veoVideoUri  // Gemini API file URI for video extension
      );

      clearInterval(progressInterval);

      if (error) {
        failJob(jobId, error.join(', '));
        setGenerationProgress({
          open: true,
          status: 'error',
          title: 'Video generation failed',
          description: error.join(', ')
        });
        return;
      }

      // Reload videos to get the new one
      await loadVideos();

      completeJob(jobId, { resultUrl: '/videos' });
      // Show success and auto-open the video
      setGenerationProgress({
        open: true,
        status: 'success',
        title: 'Video generated successfully!',
        description: 'Opening your new video...'
      });

      if (savedVideo) {
        setTimeout(() => {
          setActiveVideo(savedVideo);
          setPage('player');
        }, 1000);
      }
    },
    [loadVideos, router, brandId, isReadOnly, toast, addJob, startJob, setProgress, completeJob, failJob]
  );

  const handleCancelEdit = useCallback(() => {
    router.replace('/videos');
  }, [router]);

  const handleClosePlayer = useCallback(() => {
    setPage('gallery');
    setActiveVideo(null);
  }, []);

  const handleCloseError = useCallback(() => {
    router.replace('/videos');
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
        <header className="mb-8">
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
                <VideoCameraIcon className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                <span>Video Gallery</span>
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
                onClick={() => router.push(`/videos?new=${crypto.randomUUID()}`)}
                className="px-6 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors"
              >
                New video
              </button>
            )}
          </div>
        </header>

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
                placeholder="Search videos with AI... (e.g., 'product demo', 'tutorial')"
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
                <p className="mt-4 text-muted-foreground">{isSearching ? 'Searching...' : 'Loading Videos...'}</p>
            </div>
        ) : page === 'gallery' ? (() => {
          // Use search results if search is active, otherwise use all videos
          const isSearchActive = searchQuery.trim().length >= 2;
          const displayVideos = isSearchActive && searchResults !== null
            ? searchResults
            : videos;

          return displayVideos.length > 0 ? (
            <VideoGrid videos={displayVideos} onPlayVideo={handlePlayVideo} onDeleteVideo={handleDeleteRequest} userDisplayNames={userDisplayNames}/>
          ) : (
            <div className="text-center py-20">
              <h2 className="text-xl text-gray-400">
                {isSearchActive ? 'No videos found matching your search.' : 'No videos yet.'}
              </h2>
              <p className="text-gray-500 mt-2">
                {isSearchActive
                  ? 'Try a different search term or clear the search.'
                  : 'Click New video to generate your first video.'
                }
              </p>
              {isSearchActive && (
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

      {page === 'player' && activeVideo && (
        <VideoPlayer
          video={activeVideo}
          onClose={handleClosePlayer}
          onEdit={handleEditVideo}
          onTitleUpdate={(videoId, newTitle) => {
            // Update local state when title is changed
            setVideos(prev => prev.map(vid => vid.id === videoId ? { ...vid, title: newTitle } : vid));
            setActiveVideo(prev => prev && prev.id === videoId ? { ...prev, title: newTitle } : prev);
          }}
        />
      )}
      {page === 'edit' && activeVideo && (
        <EditVideoPage
          video={activeVideo}
          onSave={handleSaveVideo}
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
      <AlertDialog open={!!videoToDelete} onOpenChange={(open) => !open && setVideoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <AlertTriangle className="inline-block mr-2 text-destructive" />
              Are you sure you want to delete this video?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the video titled &quot;{videoToDelete?.title}&quot;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Yes, delete video
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageTransition>
  );
}


/**
 * The main component of the application that manages the state and flow of the video gallery.
 * It handles video playback, editing, and saving, and displays different pages based on the current state.
 */
export default function VideoPage() {
  return (
    <Suspense>
      <VideoPageContent />
    </Suspense>
  )
}
