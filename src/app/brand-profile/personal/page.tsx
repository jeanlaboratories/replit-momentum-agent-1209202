'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ArrowLeft, Wand2, Upload, Trash2, Save, Pencil, XCircle, Image as ImageIcon, Video as VideoIcon, FileText, AlertTriangle, Eye, EyeOff, ChevronDown, ChevronUp, HelpCircle, Calendar } from 'lucide-react';
import { BrandProfile, BrandAsset, EditedImage, UserProfilePreferences, BrandMember } from '@/lib/types';
import {
  getBrandProfileAction,
  generateBrandTextAction,
  uploadBrandAssetAction,
  deleteBrandAssetAction,
  updateBrandAssetAction,
  regenerateBrandTextSectionAction,
  updateBrandTextAction,
  updateBrandBannerAction,
  updateBrandLogoAction,
  updateUserBrandIdentityAction,
  getImagesAction,
  getUserProfilePreferencesAction,
  updateUserProfilePreferenceAction,
  generateUserBrandTextAction,
  getBrandMembershipAction,
  getTeamMemberInfoAction,
  getTeamMemberPreferencesAction,
} from '@/app/actions';
import {
  toggleAssetLoveAction,
  getBrandEngagementAction
} from '@/app/actions/engagement-actions';
import { getPersonalSharedContentAction, getTeamMemberSharedContentAction, toggleVisibilityAction } from '@/app/actions/share-actions';
import { LoveInteraction } from '@/components/brand-profile-social/LoveInteraction';
import { CommentPanel } from '@/components/comments/CommentPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import NextImage from 'next/image';
import Link from 'next/link';
import { EditableBrandIdentityPanel } from '@/components/brand-profile-social/EditableBrandIdentityPanel';
import { MetricsStrip } from '@/components/brand-profile-social/MetricsStrip';
import { ContentFeed } from '@/components/brand-profile-social/ContentFeed';
import { BrandTextEditor } from '@/components/brand-profile-social/BrandTextEditor';
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardFooter, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { PageTransition } from '@/components/ui/page-transition';
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { MasonryGrid } from '@/components/ui/masonry-grid';
import { Grid3X3, Film, FileText as FileTextIcon, Info, LayoutGrid, Heart, MessageCircle } from 'lucide-react';
import { ProfileDocumentCard } from '@/components/rag/ProfileDocumentCard';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isYouTubeUrl, getYouTubeEmbedUrl, getYouTubeThumbnailUrl } from '@/lib/youtube';
import { CompactInput } from '@/components/ui/compact-input';
import { EditableTitle } from '@/components/ui/editable-title';
import { useJobQueue } from '@/contexts/job-queue-context';

function ExpandableText({ text, maxLength = 150 }: { text: string, maxLength?: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = text.length > maxLength;
  const displayedText = isExpanded ? text : text.slice(0, maxLength) + (shouldTruncate ? '...' : '');

  if (!shouldTruncate) {
    return <p className="text-sm italic text-foreground">"{text}"</p>;
  }

  return (
    <div className="space-y-1">
      <p className="text-sm italic text-foreground">
        "{displayedText}"
      </p>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-xs text-primary hover:underline focus:outline-none"
      >
        {isExpanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
}

function RagQueryDialog({ brandId, documents }: { brandId: string, documents: any[] }) {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasIndexedDocs, setHasIndexedDocs] = useState(false);
  const { toast } = useToast();

  const indexBrandDocuments = async () => {
    if (documents.length === 0) {
      toast({ variant: 'destructive', title: 'No Documents', description: 'Please upload some documents first.' });
      return;
    }

    setIsIndexing(true);
    try {
      // Index each brand document
      for (const doc of documents) {
        const response = await fetch('/api/rag-test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'index',
            brandId: brandId,
            documentId: doc.id,
            gcsUri: doc.url, // Using the download URL directly
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to index document: ${doc.name}`);
        }
      }

      setHasIndexedDocs(true);
      toast({ title: 'Success', description: `Indexed ${documents.length} document(s) for querying.` });
    } catch (error) {
      console.error('Error indexing documents:', error);
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Failed to index documents' });
    } finally {
      setIsIndexing(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!query.trim()) return;

    setIsAsking(true);
    setAnswer('');

    try {
      const response = await fetch('/api/rag-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'query',
          query: query.trim(),
          brandId: brandId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to query documents');
      }

      const data = await response.json();

      if (data.success && data.result && data.result.answer) {
        setAnswer(data.result.answer);
      } else {
        throw new Error(data.message || 'Query failed');
      }
    } catch (error) {
      console.error('Error querying documents:', error);
      toast({ variant: 'destructive', title: 'Error', description: error instanceof Error ? error.message : 'Failed to query documents' });
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={documents.length === 0} className="w-full">
          <HelpCircle className="mr-2 h-4 w-4" /> Ask About Docs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ask Questions About Your Documents</DialogTitle>
          <DialogDescription>
            Ask questions about your uploaded documents. The AI will search through your content to provide relevant answers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!hasIndexedDocs && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                First, index your documents to enable querying:
              </div>
              <Button
                onClick={indexBrandDocuments}
                disabled={isIndexing || documents.length === 0}
                className="w-full"
              >
                {isIndexing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Indexing {documents.length} document(s)...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Index {documents.length} Document(s)
                  </>
                )}
              </Button>
            </div>
          )}

          {hasIndexedDocs && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="query">Your Question</Label>
                <div className="flex gap-2">
                  <Input
                    id="query"
                    placeholder="e.g., What is our brand voice?"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                  />
                  <Button onClick={handleAskQuestion} disabled={isAsking || !query.trim()}>
                    {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ask'}
                  </Button>
                </div>
              </div>

              {answer && (
                <div className="space-y-2">
                  <Label>Answer</Label>
                  <div className="p-4 rounded-lg bg-muted text-sm whitespace-pre-wrap">
                    {answer}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BrandProfileSocialPageContent() {
  const { user, loading: authLoading, brandId } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { addJob, startJob, setProgress, completeJob, failJob } = useJobQueue();
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [brandName, setBrandName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConfirmingGeneration, setIsConfirmingGeneration] = useState(false);
  const [isUploading, setIsUploading] = useState<'image' | 'video' | 'document' | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<BrandAsset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [assetToPreview, setAssetToPreview] = useState<BrandAsset | null>(null);
  const [generatedImages, setGeneratedImages] = useState<EditedImage[]>([]);
  const [personalSharedContent, setPersonalSharedContent] = useState<any[]>([]);
  const [userMembership, setUserMembership] = useState<BrandMember | null>(null);

  // Engagement State
  const [engagementStats, setEngagementStats] = useState<Record<string, number>>({});
  const [userLoves, setUserLoves] = useState<Record<string, boolean>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [engagementLoading, setEngagementLoading] = useState(true);

  // Determine which user's profile to display
  const profileUserId = searchParams.get('userId') || user?.uid || '';
  const isViewingOwnProfile = profileUserId === user?.uid;
  
  // Banner and logo selection states
  const [isSelectingBanner, setIsSelectingBanner] = useState(false);
  const [isSelectingLogo, setIsSelectingLogo] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<string>('');
  const [selectedLogo, setSelectedLogo] = useState<string>('');
  
  // Collapsible section states (all open by default)
  const [openSections, setOpenSections] = useState({
    identity: true,
    contentFeed: true,
    brandText: true,
    images: true,
    videos: true,
    documents: true
  });
  
  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const documentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadBrandProfile = async () => {
      if (!brandId || !user || !profileUserId) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch brand profile (base data)
        const fetchedProfile = await getBrandProfileAction(brandId);
        
        if (!fetchedProfile) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to load team profile',
          });
          setIsLoading(false);
          return;
        }

        // Fetch user membership to determine role (for the profile being viewed)
        // Use different action based on whether viewing own profile or teammate's
        const membership = isViewingOwnProfile
          ? await getBrandMembershipAction(profileUserId, brandId)
          : await getTeamMemberInfoAction(profileUserId, brandId);
        setUserMembership(membership);

        // Fetch user-specific preferences (for the profile being viewed)
        // Use different action based on whether viewing own profile or teammate's
        const userPreferences = isViewingOwnProfile
          ? await getUserProfilePreferencesAction(profileUserId, brandId)
          : await getTeamMemberPreferencesAction(profileUserId, brandId);

        // Merge user preferences with brand profile
        const mergedProfile: BrandProfile = {
          ...fetchedProfile,
          bannerImageUrl: userPreferences?.bannerImageUrl ?? fetchedProfile.bannerImageUrl,
          logoUrl: userPreferences?.logoUrl ?? fetchedProfile.logoUrl,
          brandText: userPreferences?.brandText ?? fetchedProfile.brandText,
        };

        setProfile(mergedProfile);
        // Use the membership display name if available, otherwise fallback
        setBrandName(membership?.userDisplayName || 'Team Member');
        setSelectedBanner(mergedProfile.bannerImageUrl || '');
        setSelectedLogo(mergedProfile.logoUrl || '');
        
        // Fetch generated images separately with error handling
        try {
          const fetchedImages = await getImagesAction(brandId);
          setGeneratedImages(fetchedImages || []);
        } catch (imageError) {
          console.warn('Could not load generated images:', imageError);
          setGeneratedImages([]);
        }

        // Fetch personal shared content (content shared from Initiative Content Editor)
        // Use different function based on whether viewing own profile or someone else's
        try {
          const sharedResult = isViewingOwnProfile
            ? await getPersonalSharedContentAction(brandId)
            : await getTeamMemberSharedContentAction(profileUserId, brandId);
          if (sharedResult.success && sharedResult.content) {
            setPersonalSharedContent(sharedResult.content);
          }
        } catch (sharedError) {
          console.warn('Could not load personal shared content:', sharedError);
          setPersonalSharedContent([]);
        }
      } catch (error) {
        console.error('Error loading brand profile:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'An error occurred while loading the team profile',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (brandId && user && !authLoading && profileUserId) {
      loadBrandProfile();
    }
    if (brandId && user && !authLoading && profileUserId) {
      loadBrandProfile();
    }
  }, [brandId, user, authLoading, profileUserId, toast]);

  // Load engagement stats
  useEffect(() => {
    const loadEngagement = async () => {
      if (!brandId || !user) return;

      const { success, data } = await getBrandEngagementAction(brandId);
      if (success && data) {
        setEngagementStats(data.stats);
        setUserLoves(data.userLoves);
        setCommentCounts(data.commentCounts || {});
      }
      setEngagementLoading(false);
    };

    loadEngagement();
  }, [brandId, user]);

  const handleToggleLove = async (assetId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    if (!brandId) return;

    // Optimistic update
    const isLoved = userLoves[assetId];
    const currentCount = engagementStats[assetId] || 0;

    setUserLoves(prev => ({ ...prev, [assetId]: !isLoved }));
    setEngagementStats(prev => ({
      ...prev,
      [assetId]: isLoved ? Math.max(0, currentCount - 1) : currentCount + 1
    }));

    const { success, newState } = await toggleAssetLoveAction(brandId, assetId);

    if (!success) {
      // Revert on failure
      setUserLoves(prev => ({ ...prev, [assetId]: isLoved }));
      setEngagementStats(prev => ({ ...prev, [assetId]: currentCount }));
      toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not update love status.' });
    } else if (newState) {
      // Sync with server state
      setEngagementStats(prev => ({ ...prev, [assetId]: newState.loveCount }));
      setUserLoves(prev => ({ ...prev, [assetId]: newState.isLoved }));
    }
  };

  const handleGenerateText = async () => {
    if (!brandId || !profileUserId || !isViewingOwnProfile) return;
    setIsGenerating(true);
    setIsConfirmingGeneration(false);

    // Add job to queue
    const jobId = addJob({
      type: 'brand-text-generation',
      title: 'Generating Personal Brand Text',
      description: 'Creating brand text content for personal profile',
      resultUrl: '/brand-profile/personal',
    });
    startJob(jobId);
    setProgress(jobId, 5);

    // Simulate progress during generation
    let currentProgress = 5;
    const progressInterval = setInterval(() => {
      currentProgress = Math.min(90, currentProgress + Math.random() * 10);
      setProgress(jobId, Math.round(currentProgress));
    }, 2000);

    const { brandText, error } = await generateUserBrandTextAction(profileUserId, brandId);
    clearInterval(progressInterval);

    if (error) {
      setIsGenerating(false);
      failJob(jobId, error);
      toast({ variant: 'destructive', title: 'Generation Failed', description: error });
    } else if (brandText) {
      setIsGenerating(false);
      setProfile(prev => ({ ...prev!, brandText }));
      completeJob(jobId, { resultUrl: '/brand-profile/personal' });
      toast({ title: 'Success', description: 'New team text generated and saved to your profile.' });
    }
  };

  const handleGenerationRequest = () => {
    if (profile?.brandText) {
      setIsConfirmingGeneration(true);
    } else {
      handleGenerateText();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'document') => {
    if (!brandId) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const maxSizeMB = type === 'video' ? 100 : type === 'image' ? 50 : 25;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    if (file.size > maxSizeBytes) {
      toast({ 
        variant: 'destructive', 
        title: 'File Too Large', 
        description: `${type === 'video' ? 'Video' : type === 'image' ? 'Image' : 'Document'} size must be less than ${maxSizeMB}MB. Current file size: ${(file.size / (1024 * 1024)).toFixed(1)}MB` 
      });
      if (type === 'document' && documentInputRef.current) documentInputRef.current.value = '';
      return;
    }

    setIsUploading(type);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      const dataUri = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
      });

      const { asset, error } = await uploadBrandAssetAction(brandId!, { name: file.name, dataUri, type });
      
      if (error) {
        throw new Error(error);
      } else if (asset) {
        setProfile(prev => {
          const newProfile = { ...prev! };
          if (type === 'image') {
            newProfile.images = [...(newProfile.images || []), asset];
          } else if (type === 'video') {
            newProfile.videos = [...(newProfile.videos || []), asset];
          } else if (type === 'document') {
            newProfile.documents = [...(newProfile.documents || []), asset];
          }
          return newProfile;
        });
      toast({ title: 'Success', description: `${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully.` });
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ 
        variant: 'destructive', 
        title: 'Upload Failed', 
        description: error.message || 'Failed to upload file. Please try again.' 
      });
    } finally {
      setIsUploading(null);
      if (type === 'document' && documentInputRef.current) documentInputRef.current.value = '';
    }
  };

  const handleDeleteAsset = async () => {
    if (!brandId || !assetToDelete) return;
    setIsDeleting(true);
    const { success, error } = await deleteBrandAssetAction(brandId, assetToDelete.id, assetToDelete.url, assetToDelete.type);
    setIsDeleting(false);
    setAssetToDelete(null);

    if (error) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: error });
    } else if (success) {
      setProfile(prev => {
        const newProfile = { ...prev! };
        if (assetToDelete.type === 'image') newProfile.images = (newProfile.images || []).filter(img => img.id !== assetToDelete.id);
        if (assetToDelete.type === 'video') newProfile.videos = (newProfile.videos || []).filter(vid => vid.id !== assetToDelete.id);
        if (assetToDelete.type === 'document') newProfile.documents = (newProfile.documents || []).filter(doc => doc.id !== assetToDelete.id);
        return newProfile;
      });
      toast({ title: 'Success', description: 'Asset deleted.' });
    }
  };

  const handleBannerSelection = async () => {
    if (!brandId || !selectedBanner || !profileUserId || !isViewingOwnProfile) return;
    
    try {
      const { success, error } = await updateUserProfilePreferenceAction(profileUserId, brandId, {
        bannerImageUrl: selectedBanner
      });
      if (error) {
        throw new Error(error);
      }
      
      if (success) {
        setProfile(prev => ({ ...prev!, bannerImageUrl: selectedBanner }));
        setIsSelectingBanner(false);
      toast({ title: 'Success', description: 'Banner updated successfully.' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to update banner.' });
    }
  };

  const handleLogoSelection = async () => {
    if (!brandId || !selectedLogo || !profileUserId || !isViewingOwnProfile) return;
    
    try {
      const { success, error } = await updateUserProfilePreferenceAction(profileUserId, brandId, {
        logoUrl: selectedLogo
      });
      if (error) {
        throw new Error(error);
      }
      
      if (success) {
        setProfile(prev => ({ ...prev!, logoUrl: selectedLogo }));
        setIsSelectingLogo(false);
      toast({ title: 'Success', description: 'Profile picture updated successfully.' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to update profile picture.' });
    }
  };

  // Handle redirect to login in useEffect to avoid render-phase navigation
  useEffect(() => {
    if (!authLoading && (!user || !brandId)) {
      router.push('/login');
    }
  }, [authLoading, user, brandId, router]);

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !brandId) {
    return null;
  }

  if (!profile) {
    return (
      <PageTransition>
        <div className="container mx-auto py-8">
          <div className="text-center">
            <p className="text-muted-foreground">No team profile found</p>
            <Button asChild className="mt-4">
              <Link href="/brand-profile">Go to Team Profile</Link>
            </Button>
          </div>
        </div>
      </PageTransition>
    );
  }

  // Combine brand assets (uploaded images) with AI-generated images and personal shared content
  const brandAssets = profile.images || [];
  const aiGeneratedAssets = generatedImages.map(img => ({
    id: img.id,
    name: img.title,
    url: img.generatedImageUrl || img.sourceImageUrl,
    type: 'image' as const
  }));
  // Transform personal shared content to match the asset format, including isPublished for visibility
  const sharedAssets = personalSharedContent.map(item => ({
    id: item.id,
    name: item.title || item.description?.substring(0, 50) || 'Shared Content',
    url: item.generatedImageUrl || item.sourceImageUrl,
    type: (item.mediaType || 'image') as 'image' | 'video',
    isPublished: item.isPublished !== false, // Default to true if not set
    isShared: true, // Mark as shared content for visibility toggle UI
    // Campaign linking - allows "View Campaign" button
    sourceCampaignId: item.sourceCampaignId || null,
    sourceCampaignDate: item.sourceCampaignDate || null,
  }));
  const imageAssets = [...brandAssets.map(a => ({ ...a, isPublished: true, isShared: false })), ...aiGeneratedAssets.map(a => ({ ...a, isPublished: true, isShared: false })), ...sharedAssets];

  // Handle visibility toggle for shared content
  const handleToggleVisibility = async (assetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!brandId) return;

    // Find the asset to toggle
    const asset = sharedAssets.find(a => a.id === assetId);
    if (!asset) return;

    // Optimistic update
    const currentIsPublished = asset.isPublished;
    setPersonalSharedContent(prev =>
      prev.map(item =>
        item.id === assetId
          ? { ...item, isPublished: !currentIsPublished }
          : item
      )
    );

    try {
      const result = await toggleVisibilityAction(assetId, brandId);
      if (!result.success) {
        // Revert on failure
        setPersonalSharedContent(prev =>
          prev.map(item =>
            item.id === assetId
              ? { ...item, isPublished: currentIsPublished }
              : item
          )
        );
        toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to toggle visibility.' });
      } else {
        toast({
          title: 'Visibility Updated',
          description: result.isPublished ? 'Content is now public.' : 'Content is now private.'
        });
      }
    } catch (error) {
      // Revert on error
      setPersonalSharedContent(prev =>
        prev.map(item =>
          item.id === assetId
            ? { ...item, isPublished: currentIsPublished }
            : item
        )
      );
      toast({ variant: 'destructive', title: 'Error', description: 'An error occurred.' });
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        {/* Top Navigation Bar */}
        <div className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 h-14 flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild className="-ml-2">
              <Link href="/brand-profile">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Team View
              </Link>
            </Button>
            <div className="font-semibold text-sm">{brandName}</div>
            <div className="w-20 flex justify-end">
              {isViewingOwnProfile && (
                <Button variant="ghost" size="icon" onClick={handleGenerationRequest} disabled={isGenerating}>
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto pb-20">
          {/* Profile Header Section */}
          <div className="relative mb-8">
            {/* Banner */}
            <div className="relative h-48 md:h-64 w-full bg-muted overflow-hidden group">
              {selectedBanner ? (
                <NextImage
                  src={selectedBanner}
                  alt="Banner"
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-80" />
              )}
              {isViewingOwnProfile && (
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button variant="secondary" size="sm" onClick={() => setIsSelectingBanner(true)}>
                    <Pencil className="w-4 h-4 mr-2" /> Change Banner
                  </Button>
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="px-4 md:px-8">
              <div className="relative -mt-16 mb-6 flex flex-col md:flex-row items-start md:items-end gap-6">
                {/* Avatar */}
                <div className="relative group shrink-0">
                  <div className="rounded-full p-1 bg-background">
                    <Avatar className="w-32 h-32 md:w-40 md:h-40 border-4 border-background shadow-xl">
                      <AvatarImage src={selectedLogo} className="object-cover" />
                      <AvatarFallback className="text-4xl">{brandName.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </div>
                  {isViewingOwnProfile && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full overflow-hidden opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity cursor-pointer" onClick={() => setIsSelectingLogo(true)}>
                      <Pencil className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>

                {/* Actions & Stats */}
                <div className="flex-1 w-full md:mb-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h1 className="text-2xl md:text-3xl font-bold">{brandName}</h1>
                      <p className="text-muted-foreground font-medium">@{brandName.toLowerCase().replace(/\s+/g, '')}</p>
                    </div>

                  </div>
                </div>
              </div>

              {/* Bio & Metrics */}
              <div className="space-y-6 max-w-3xl">
                <div className="grid grid-cols-3 gap-8 text-center md:text-left w-full md:w-auto border-y md:border-none py-4 md:py-0">
                  <div>
                    <div className="font-bold text-lg">{imageAssets.length}</div>
                    <div className="text-xs text-muted-foreground">Posts</div>
                  </div>
                  <div>
                    <div className="font-bold text-lg">{profile.videos?.length || 0}</div>
                    <div className="text-xs text-muted-foreground">Videos</div>
                  </div>
                  <div>
                    <div className="font-bold text-lg">{profile.documents?.length || 0}</div>
                    <div className="text-xs text-muted-foreground">Documents</div>
                  </div>
                </div>

                <div className="text-sm md:text-base space-y-2">
                  {profile.summary ? (
                    <p className="whitespace-pre-wrap">{profile.summary}</p>
                  ) : (
                    <p className="text-muted-foreground italic">No bio yet.</p>
                  )}
                  {profile.tagline && (
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">{profile.tagline}</Badge>
                    </div>
                  )}
                </div>

                {/* Engagement Metrics Strip */}
                {profile.engagementMetrics && profile.engagementMetrics.length > 0 && (
                  <MetricsStrip metrics={profile.engagementMetrics} />
                )}
              </div>
            </div>
          </div>

          {/* Content Tabs */}
          <Tabs defaultValue="grid" className="w-full mt-8">
            <div className="sticky top-14 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
              <TabsList className="w-full justify-center h-12 bg-transparent p-0 rounded-none container mx-auto">
                <TabsTrigger
                  value="grid"
                  className="flex-1 h-full max-w-[120px] rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:shadow-none bg-transparent text-muted-foreground data-[state=active]:text-foreground uppercase text-xs tracking-widest"
                >
                  <Grid3X3 className="w-4 h-4 mr-2" /> Posts
                </TabsTrigger>
                <TabsTrigger
                  value="videos"
                  className="flex-1 h-full max-w-[120px] rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:shadow-none bg-transparent text-muted-foreground data-[state=active]:text-foreground uppercase text-xs tracking-widest"
                >
                  <Film className="w-4 h-4 mr-2" /> Reels
                </TabsTrigger>
                <TabsTrigger
                  value="docs"
                  className="flex-1 h-full max-w-[120px] rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:shadow-none bg-transparent text-muted-foreground data-[state=active]:text-foreground uppercase text-xs tracking-widest"
                >
                  <FileTextIcon className="w-4 h-4 mr-2" /> Docs
                </TabsTrigger>
                <TabsTrigger
                  value="about"
                  className="flex-1 h-full max-w-[120px] rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:shadow-none bg-transparent text-muted-foreground data-[state=active]:text-foreground uppercase text-xs tracking-widest"
                  id="edit-profile-trigger"
                >
                  <Info className="w-4 h-4 mr-2" /> About
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="container mx-auto px-1 md:px-4 py-4 min-h-[50vh]">
              {/* GRID TAB (Mixed Images) */}
              <TabsContent value="grid" className="mt-0">
                {isViewingOwnProfile && (
                  <div className="mb-6">
                    <CompactInput placeholder="Ask Team Companion about photos..." className="mb-4" />
                  </div>
                )}

                {imageAssets.length > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-1 md:gap-4">
                    {imageAssets.map(img => (
                      <div key={img.id} className={`relative group aspect-square overflow-hidden bg-muted rounded-md cursor-pointer ${!img.isPublished ? 'opacity-60' : ''}`}>
                          <NextImage
                            src={img.url}
                            alt={img.name}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                          {/* Private indicator badge */}
                          {!img.isPublished && (
                            <div className="absolute top-2 left-2 z-10">
                              <Badge variant="secondary" className="bg-black/70 text-white text-xs px-2 py-0.5">
                                <EyeOff className="w-3 h-3 mr-1" /> Private
                              </Badge>
                            </div>
                          )}
                          {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white" onClick={() => setAssetToPreview(img)}>
                            <LoveInteraction
                              assetId={img.id}
                              brandId={brandId || ''}
                              initialCount={engagementStats[img.id] || 0}
                              initialIsLoved={userLoves[img.id] || false}
                              onToggle={(e) => handleToggleLove(img.id, e)}
                              className="text-white"
                              iconClassName="w-5 h-5 mr-2 text-white"
                            />
                            <div
                              className="flex items-center font-bold hover:scale-110 transition-transform"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAssetToPreview(img);
                              }}
                            >
                              <MessageCircle className="w-5 h-5 mr-2 fill-white" />
                              {commentCounts[img.id] || 0}
                            </div>
                          </div>
                          {/* Action buttons */}
                          {isViewingOwnProfile && (
                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {/* View Campaign button for shared content with campaign link */}
                              {img.isShared && (img as any).sourceCampaignId && (
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className="h-8 w-8 bg-black/50 hover:bg-black/70"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Navigate to campaign with date query param to open calendar view on that day
                                    const campaignId = (img as any).sourceCampaignId;
                                    const campaignDate = (img as any).sourceCampaignDate;
                                    const url = campaignDate
                                      ? `/?campaignId=${campaignId}&date=${campaignDate}`
                                      : `/?campaignId=${campaignId}`;
                                    router.push(url);
                                  }}
                                  title="View Campaign"
                                >
                                  <Calendar className="h-4 w-4 text-white" />
                                </Button>
                              )}
                              {/* Visibility toggle for shared content */}
                              {img.isShared && (
                                <Button
                                  variant="secondary"
                                  size="icon"
                                  className="h-8 w-8 bg-black/50 hover:bg-black/70"
                                  onClick={(e) => handleToggleVisibility(img.id, e)}
                                  title={img.isPublished ? 'Make private' : 'Make public'}
                                >
                                  {img.isPublished ? <Eye className="h-4 w-4 text-white" /> : <EyeOff className="h-4 w-4 text-white" />}
                                </Button>
                              )}
                              <Button
                                variant="destructive"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => { e.stopPropagation(); setAssetToDelete(img); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 rounded-full border-2 border-dashed flex items-center justify-center mb-4">
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Share Photos</h3>
                      <p className="text-muted-foreground mb-6 max-w-sm">When you share photos, they will appear on your profile.</p>
                  </div>
                )}
              </TabsContent>

              {/* VIDEOS TAB */}
              <TabsContent value="videos" className="mt-0">
                {isViewingOwnProfile && (
                  <div className="mb-6">
                    <CompactInput placeholder="Ask Team Companion about videos..." className="mb-4" />
                  </div>
                )}

                {(profile.videos || []).length > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-1 md:gap-4">
                    {profile.videos!.map(vid => (
                      <div key={vid.id} className="relative group aspect-[9/16] overflow-hidden bg-muted rounded-md cursor-pointer" onClick={() => setAssetToPreview(vid)}>
                        <video
                          src={vid.url}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <Film className="w-8 h-8 text-white opacity-80 group-hover:scale-110 transition-transform" />
                            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="flex items-center gap-3 text-sm">
                                <LoveInteraction
                                  assetId={vid.id}
                                  brandId={brandId || ''}
                                  initialCount={engagementStats[vid.id] || 0}
                                  initialIsLoved={userLoves[vid.id] || false}
                                  onToggle={(e) => handleToggleLove(vid.id, e)}
                                  className="text-white hover:text-red-400"
                                  iconClassName="w-3 h-3 mr-1"
                                />
                                <div
                                  className="flex items-center gap-1 cursor-pointer hover:text-blue-400 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAssetToPreview(vid);
                                  }}
                                >
                                  <MessageCircle className="w-3 h-3 mr-1" />
                                  {commentCounts[vid.id] || 0}
                                </div>
                              </div>
                            </div>
                          </div>
                          {isViewingOwnProfile && (
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                              onClick={(e) => { e.stopPropagation(); setAssetToDelete(vid); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 rounded-full border-2 border-dashed flex items-center justify-center mb-4">
                      <Film className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Share Reels</h3>
                      <p className="text-muted-foreground mb-6 max-w-sm">Share videos to engage with your team.</p>
                  </div>
                )}
              </TabsContent>

              {/* DOCS TAB */}
              <TabsContent value="docs" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-4">
                    {(profile.documents || []).length > 0 ? (
                      profile.documents!.map(doc => (
                        <ProfileDocumentCard
                          key={doc.id}
                          documentId={doc.id}
                          documentName={doc.name}
                          documentUrl={doc.url}
                          brandId={brandId as string}
                          gcsUri={doc.url}
                          canDelete={isViewingOwnProfile}
                          onDelete={() => setAssetToDelete(doc)}
                        />
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg border-dashed">
                        <FileTextIcon className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
                        <h3 className="text-lg font-medium">No documents yet</h3>
                        <p className="text-sm text-muted-foreground mt-2">Upload documents to enable AI-powered search and summaries</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    {isViewingOwnProfile && (
                      <div className="bg-muted/50 rounded-xl p-6 border">
                        <div className="text-center">
                          <h3 className="font-semibold mb-2">Upload Document</h3>
                          <p className="text-sm text-muted-foreground mb-4">Upload guidelines, white papers, or other personal documents.</p>
                          <Button className="w-full" onClick={() => documentInputRef.current?.click()} disabled={isUploading === 'document'}>
                            {isUploading === 'document' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                            {isUploading === 'document' ? 'Uploading...' : 'Select Document'}
                          </Button>
                          <Input type="file" ref={documentInputRef} className="hidden" accept=".pdf,.doc,.docx,.txt" onChange={(e) => handleFileUpload(e, 'document')} />
                        </div>
                      </div>
                    )}

                    <div className="p-6 rounded-xl border bg-card">
                      <h3 className="font-semibold mb-2">Ask About Docs</h3>
                      <p className="text-sm text-muted-foreground mb-4">Use AI to query your uploaded documents.</p>
                      {brandId && <RagQueryDialog brandId={brandId} documents={profile.documents || []} />}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ABOUT TAB (Identity & Text) */}
              <TabsContent value="about" className="mt-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                  <div className="lg:col-span-1">
                    <h3 className="text-lg font-semibold mb-4">Identity</h3>
                    <EditableBrandIdentityPanel
                      brandName={brandName}
                      brandProfile={profile}
                      onEditLogo={isViewingOwnProfile ? () => setIsSelectingLogo(true) : undefined}
                      onUpdateField={async (field, value) => {
                        if (!user?.uid || !brandId || !isViewingOwnProfile) return;
                        if (field === 'name') return;
                        const result = await updateUserBrandIdentityAction(user.uid, brandId, field, value);
                        if (result.success) {
                          if (field === 'displayName') setBrandName(value);
                          else if (profile) setProfile({ ...profile, [field]: value });
                        }
                      }}
                      canEdit={isViewingOwnProfile}
                      isPersonalProfile={true}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <h3 className="text-lg font-semibold mb-4">Brand Voice & Text</h3>
                    <BrandTextEditor
                      brandId={brandId!}
                      userId={isViewingOwnProfile ? profileUserId : undefined}
                      initialBrandText={profile.brandText}
                      onUpdate={(updatedText) => setProfile(prev => ({ ...prev!, brandText: updatedText }))}
                    />
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Dialogs (Banner, Logo, Delete, etc.) - Kept from original */}
        <Dialog open={isSelectingBanner} onOpenChange={setIsSelectingBanner}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Select Banner Image</DialogTitle>
              <DialogDescription>Choose an image from your gallery</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
              {imageAssets.map(asset => (
                <div
                  key={asset.id}
                  className={`relative aspect-video rounded-md overflow-hidden border-2 cursor-pointer transition-all ${
                    selectedBanner === asset.url ? 'border-primary ring-2 ring-primary' : 'border-transparent hover:border-muted-foreground/50'
                  }`}
                  onClick={() => setSelectedBanner(asset.url)}
                >
                  <NextImage src={asset.url} alt={asset.name} fill className="object-cover" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsSelectingBanner(false)}>Cancel</Button>
              <Button onClick={handleBannerSelection} disabled={!selectedBanner}>Set Banner</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isSelectingLogo} onOpenChange={setIsSelectingLogo}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Select Profile Picture</DialogTitle>
              <DialogDescription>Choose an image from your gallery</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
              {imageAssets.map(img => (
                <div
                  key={img.id}
                  className={`relative aspect-square rounded-full overflow-hidden border-2 cursor-pointer transition-all ${
                    selectedLogo === img.url ? 'border-primary ring-2 ring-primary' : 'border-transparent hover:border-muted-foreground/50'
                  }`}
                  onClick={() => setSelectedLogo(img.url)}
                >
                  <NextImage src={img.url} alt={img.name} fill className="object-cover" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsSelectingLogo(false)}>Cancel</Button>
              <Button onClick={handleLogoSelection} disabled={!selectedLogo}>Set Profile Picture</Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!assetToDelete} onOpenChange={(open) => !open && setAssetToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {assetToDelete?.type}?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{assetToDelete?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAsset} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isConfirmingGeneration} onOpenChange={setIsConfirmingGeneration}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Overwrite Existing Content?</AlertDialogTitle>
              <AlertDialogDescription>
                Generating new text will overwrite the existing content. Continue?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isGenerating}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleGenerateText} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Yes, Overwrite'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!assetToPreview} onOpenChange={(open) => !open && setAssetToPreview(null)}>
          <DialogContent className="max-w-7xl w-full p-0 overflow-hidden bg-background border-none h-[90vh] flex flex-col md:flex-row">
            <DialogTitle className="sr-only">{assetToPreview?.name || 'Asset Preview'}</DialogTitle>

            {/* Left: Asset View */}
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden group">
              {assetToPreview?.type === 'image' && (
                <div className="relative w-full h-full">
                  <NextImage
                    src={assetToPreview.url}
                    alt={assetToPreview.name || 'Asset preview'}
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              )}
              {assetToPreview?.type === 'video' && (
                isYouTubeUrl(assetToPreview.url) ? (
                  <iframe
                    src={getYouTubeEmbedUrl(assetToPreview.url) || ''}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                    <video src={assetToPreview.url} controls autoPlay className="max-w-full max-h-full" />
                  )
              )}
              {assetToPreview?.type === 'document' && (
                <div className="w-full h-full bg-white">
                  <iframe src={assetToPreview.url} className="h-full w-full" title={assetToPreview.name} />
                </div>
              )}
            </div>

            {/* Right: Sidebar */}
            <div className="w-full md:w-[400px] bg-background border-l flex flex-col h-full overflow-hidden">
              {/* Sidebar Header */}
              <div className="p-4 border-b flex items-start justify-between gap-4 bg-background z-10">
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarImage src={selectedLogo} />
                    <AvatarFallback>{brandName.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <EditableTitle
                      value={assetToPreview?.name || 'Untitled'}
                      onSave={async (newName) => {
                        if (!assetToPreview || !brandId) return;
                        const result = await updateBrandAssetAction(brandId, assetToPreview.id, assetToPreview.type, { name: newName });
                        if (result.success) {
                          // Update local state
                          setAssetToPreview({ ...assetToPreview, name: newName });
                          const assetCollection = assetToPreview.type === 'image' ? 'images' : assetToPreview.type === 'video' ? 'videos' : 'documents';
                          setProfile(prev => {
                            if (!prev) return prev;
                            const assets = (prev[assetCollection as keyof BrandProfile] as BrandAsset[]) || [];
                            const updatedAssets = assets.map(a => a.id === assetToPreview.id ? { ...a, name: newName } : a);
                            return { ...prev, [assetCollection]: updatedAssets };
                          });
                          toast({ title: 'Title updated', description: 'Asset title has been saved.' });
                        } else {
                          toast({ title: 'Error', description: result.message || 'Failed to update title', variant: 'destructive' });
                          throw new Error(result.message);
                        }
                      }}
                      size="lg"
                      placeholder="Untitled"
                      disabled={!isViewingOwnProfile}
                    />
                    <p className="text-xs text-muted-foreground truncate">
                      Uploaded {new Date().toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Prompt Display */}
              {assetToPreview?.prompt && (
                <div className="px-4 py-3 border-b bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Generation Prompt</p>
                  <ExpandableText text={assetToPreview.prompt} maxLength={150} />
                </div>
              )}

              {/* Comments Section */}
              <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-muted/5">
                {brandId && assetToPreview && (
                  <CommentPanel
                    brandId={brandId}
                    contextType={assetToPreview.type === 'video' ? 'video' : 'image'}
                    contextId={assetToPreview.id}
                    showInline={true}
                    variant="sidebar"
                    className="h-full"
                  />
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t bg-background space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <LoveInteraction
                      assetId={assetToPreview?.id || ''}
                      brandId={brandId || ''}
                      initialCount={assetToPreview ? (engagementStats[assetToPreview.id] || 0) : 0}
                      initialIsLoved={assetToPreview ? (userLoves[assetToPreview.id] || false) : false}
                      onToggle={(e) => assetToPreview && handleToggleLove(assetToPreview.id, e)}
                    />
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MessageCircle className="w-6 h-6" />
                      <span className="font-medium">{assetToPreview ? (commentCounts[assetToPreview.id] || 0) : 0}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1" variant="secondary" asChild>
                    <a href={assetToPreview?.url} target="_blank" rel="noopener noreferrer">Open Original</a>
                  </Button>
                  {isViewingOwnProfile && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => {
                        setAssetToDelete(assetToPreview);
                        setAssetToPreview(null);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}

export default function BrandProfileSocialPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <BrandProfileSocialPageContent />
    </Suspense>
  );
}
