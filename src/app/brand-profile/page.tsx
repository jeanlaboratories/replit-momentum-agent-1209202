

'use client';

import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, FileText, Wand2, Upload, Trash2, Video, Image as ImageIcon, AlertTriangle, Eye, Pencil, Save, XCircle, HelpCircle, Heart, Lock, ChevronDown, ChevronUp, ArrowLeft, Users, Calendar } from 'lucide-react';
import { BrandProfile, BrandAsset, BrandText, Sponsorship } from '@/lib/types';
import {
  getBrandProfileAction,
  getBrandNameAction,
  generateBrandTextAction,
  uploadBrandAssetAction,
  deleteBrandAssetAction,
  updateBrandAssetAction,
  regenerateBrandTextSectionAction,
  updateBrandTextAction,
  askQuestionAboutDocsAction,
  getBrandMembershipAction,
  updateBrandBannerAction,
  updateBrandLogoAction,
  updateBrandIdentityAction,
  getImagesAction,
  getActiveTeammatesAction,
  copyTeammateBrandTextSectionAction,
  getUserDisplayNamesAction
} from '@/app/actions';
import {
  toggleAssetLoveAction,
  getBrandEngagementAction
} from '@/app/actions/engagement-actions';
import { LoveInteraction } from '@/components/brand-profile-social/LoveInteraction';
import { CommentPanel } from '@/components/comments/CommentPanel';
import { verifySponsorshipAccessAction } from '@/app/actions/sponsorship-management';
import { useToast } from '@/hooks/use-toast';
import { PageTransition } from '@/components/ui/page-transition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import NextImage from 'next/image';
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
  DialogFooter,
} from '@/components/ui/dialog';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';
import _ from 'lodash';
import { Label } from '@/components/ui/label';
import { hasMeaningfulContent } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { EditableBrandIdentityPanel } from '@/components/brand-profile-social/EditableBrandIdentityPanel';
import { MetricsStrip } from '@/components/brand-profile-social/MetricsStrip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { MasonryGrid } from '@/components/ui/masonry-grid';
import { Grid3X3, Film, FileText as FileTextIcon, Info, LayoutGrid, Heart as HeartIcon, MessageCircle, Lock as LockIcon, Users as UsersIcon } from 'lucide-react';
import { ProfileDocumentCard } from '@/components/rag/ProfileDocumentCard';
import { EditedImage } from '@/lib/types';
import { isYouTubeUrl, getYouTubeEmbedUrl, getYouTubeThumbnailUrl } from '@/lib/youtube';
import { CompactInput } from '@/components/ui/compact-input';
import { EditableTitle } from '@/components/ui/editable-title';
import { useJobQueue } from '@/contexts/job-queue-context';

const DEFAULT_BRAND_TEXT: BrandText = {
    coreText: { missionVision: '', brandStory: '', taglines: [] },
    marketingText: { adCopy: [], productDescriptions: [], emailCampaigns: [], landingPageCopy: '' },
    contentMarketingText: { blogPosts: [], socialMediaCaptions: [], whitePapers: [], videoScripts: [] },
    technicalSupportText: { userManuals: '', faqs: [] },
    publicRelationsText: { pressReleases: [], companyStatements: [], mediaKitText: '' }
};

type EditableField = {
  isEditing: boolean;
  isRegenerating: boolean;
  isCopying: boolean;
  currentValue: string | string[];
};

type EditingState = {
  [key: string]: EditableField;
};

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

function RagQueryDialog({brandId, documents}: {brandId: string, documents: any[]}) {
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
          brandId: brandId,
          query: query.trim(),
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
        <Button variant="outline" disabled={documents.length === 0}>
          <HelpCircle className="mr-2 h-4 w-4" /> Ask About Docs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ask Questions About Your Documents</DialogTitle>
          <DialogDescription>
            Ask questions about your uploaded team documents. The AI will search through your content to provide relevant answers.
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
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="What would you like to know about your documents?"
                    disabled={isAsking}
                    onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                    className="flex-1"
                  />
                  <Button onClick={handleAskQuestion} disabled={isAsking || !query.trim()}>
                    {isAsking ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <HelpCircle className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {answer && (
                <div className="space-y-2">
                  <Label>Answer</Label>
                  <div className="bg-muted p-3 rounded-md text-sm whitespace-pre-wrap">
                    {answer}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Example questions: "What are our brand colors?", "What is our mission statement?", "What services do we offer?"
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BrandTextDisplay({ initialBrandText, brandId, isReadOnly = false, attributions }: { initialBrandText: BrandProfile['brandText'], brandId: string, isReadOnly?: boolean, attributions?: Record<string, { userId: string; userName: string; copiedAt: string }> }) {
    const { toast } = useToast();
    const [brandText, setBrandText] = useState(initialBrandText);
    const [editingState, setEditingState] = useState<EditingState>({});
    const [localAttributions, setLocalAttributions] = useState<Record<string, { userId: string; userName: string; copiedAt: string }>>(attributions || {});
    const [teammates, setTeammates] = useState<Array<{ userId: string; name: string; email: string; role: string; brandText: BrandText | null }>>([]);
    const [loadingTeammates, setLoadingTeammates] = useState(false);

    useEffect(() => {
        setBrandText(initialBrandText);
    }, [initialBrandText]);

    useEffect(() => {
        if (!isReadOnly && brandId) {
            loadTeammates();
        }
    }, [isReadOnly, brandId]);

    const loadTeammates = async () => {
        setLoadingTeammates(true);
        const { teammates: fetchedTeammates, error } = await getActiveTeammatesAction(brandId);
        if (error) {
            console.error('Failed to load teammates:', error);
        } else if (fetchedTeammates) {
            setTeammates(fetchedTeammates);
        }
        setLoadingTeammates(false);
    };

    const startEditing = (key: string, value: string | string[]) => {
        setEditingState(prev => ({
            ...prev,
            [key]: { isEditing: true, isRegenerating: false, isCopying: false, currentValue: value }
        }));
    };

    const cancelEditing = (key: string) => {
        setEditingState(prev => {
            const newState = { ...prev };
            delete newState[key];
            return newState;
        });
    };

    const handleValueChange = (key: string, value: string | string[]) => {
        setEditingState(prev => ({
            ...prev,
            [key]: { ...prev[key], currentValue: value }
        }));
    };

    const handleSave = async (key: string) => {
        const field = editingState[key];
        if (!field) return;

        // Security: Prevent mutations in read-only mode
        if (isReadOnly) {
      toast({ variant: 'destructive', title: 'Action Not Allowed', description: 'Cannot save changes in read-only mode.' });
            return;
        }

        const { error } = await updateBrandTextAction(brandId, key, field.currentValue);
        if (error) {
      toast({ variant: 'destructive', title: 'Save Failed', description: error });
        } else {
            setBrandText(prev => {
                const newText = _.cloneDeep(prev || DEFAULT_BRAND_TEXT);
                _.set(newText, key, field.currentValue);
                return newText;
            });
            cancelEditing(key);
      toast({ title: 'Success', description: 'Your changes have been saved.' });
        }
    };

    const handleRegenerate = async (key: string, sectionTitle: string) => {
        // Security: Prevent mutations in read-only mode
        if (isReadOnly) {
      toast({ variant: 'destructive', title: 'Action Not Allowed', description: 'Cannot regenerate content in read-only mode.' });
            return;
        }

        setEditingState(prev => ({
            ...prev,
            [key]: { isEditing: false, isRegenerating: true, isCopying: false, currentValue: _.get(brandText, key) }
        }));

        const { newContent, error } = await regenerateBrandTextSectionAction(brandId, key, sectionTitle);

        setEditingState(prev => {
            const newState = { ...prev };
            delete newState[key];
            return newState;
        });

        if (error) {
      toast({ variant: 'destructive', title: 'Regeneration Failed', description: error });
        } else if (newContent) {
             setBrandText(prev => {
                const newText = _.cloneDeep(prev || DEFAULT_BRAND_TEXT);
                _.set(newText, key, newContent);
                return newText;
            });
      toast({ title: 'Success', description: `${sectionTitle} regenerated.` });
        }
    };

    const handleCopyFromTeammate = async (key: string, sectionTitle: string, teammateUserId: string, teammateName: string) => {
        // Security: Prevent mutations in read-only mode
        if (isReadOnly) {
      toast({ variant: 'destructive', title: 'Action Not Allowed', description: 'Cannot copy content in read-only mode.' });
            return;
        }

        // Set copying state to show spinner
        setEditingState(prev => ({
            ...prev,
            [key]: { isEditing: false, isRegenerating: false, isCopying: true, currentValue: _.get(brandText, key) }
        }));

        const { success, newValue, error } = await copyTeammateBrandTextSectionAction(brandId, key, teammateUserId, teammateName);

        // Clear copying state
        setEditingState(prev => {
            const newState = { ...prev };
            delete newState[key];
            return newState;
        });

        if (error) {
      toast({ variant: 'destructive', title: 'Copy Failed', description: error });
        } else if (success && newValue) {
            // Update brand text optimistically
            setBrandText(prev => {
                const newText = _.cloneDeep(prev || DEFAULT_BRAND_TEXT);
                _.set(newText, key, newValue);
                return newText;
            });

            // Update attributions locally
            setLocalAttributions(prev => ({
                ...prev,
                [key]: {
                    userId: teammateUserId,
                    userName: teammateName,
                    copiedAt: new Date().toISOString()
                }
            }));

      toast({ title: 'Success', description: `${sectionTitle} copied from ${teammateName}'s profile.` });
        }
    };


    const renderField = (title: string, value: string | string[] | undefined, key: string, isList = false) => {
        const state = editingState[key];
        const isEditing = state?.isEditing;
        const isRegenerating = state?.isRegenerating;
        const isCopying = state?.isCopying;

        if (isRegenerating) {
            return (
                <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">{title}</h4>
                    <div className="flex items-center gap-2 text-muted-foreground p-4 border rounded-lg">
                        <Loader2 className="h-4 w-4 animate-spin"/>
                        <span>Regenerating content...</span>
                    </div>
                </div>
            );
        }

        if (isCopying) {
            return (
                <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">{title}</h4>
                    <div className="flex items-center gap-2 text-muted-foreground p-4 border rounded-lg">
                        <Loader2 className="h-4 w-4 animate-spin"/>
                        <span>Copying content...</span>
                    </div>
                </div>
            );
        }

        if (isEditing) {
            return (
                 <div className="space-y-2">
                    <h4 className="font-semibold text-foreground">{title}</h4>
                    {isList ? (
                  <Textarea
                            className="min-h-[120px]"
                            value={Array.isArray(state.currentValue) ? state.currentValue.join('\n') : state.currentValue}
                            onChange={(e) => handleValueChange(key, e.target.value.split('\n'))}
                        />
                    ) : (
                    <Textarea
                            className="min-h-[120px]"
                            value={state.currentValue as string}
                            onChange={(e) => handleValueChange(key, e.target.value)}
                        />
                    )}
                    <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSave(key)}><Save className="mr-2 h-4 w-4"/>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => cancelEditing(key)}><XCircle className="mr-2 h-4 w-4"/>Cancel</Button>
                    </div>
                </div>
            );
        }

        if (!value || (isList && Array.isArray(value) && value.length === 0)) {
             return (
                <div className="space-y-2 group relative">
                    <h4 className="font-semibold text-foreground">{title}</h4>
                    <p className="text-sm text-muted-foreground italic">No content yet.</p>
                     {!isReadOnly && (
                       <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRegenerate(key, title)}>
                              <Wand2 className="h-4 w-4" />
                          </Button>
                      </div>
                     )}
                </div>
            );
        }

        const attribution = localAttributions[key];

        return (
            <div className="space-y-2 group relative">
                <h4 className="font-semibold text-foreground">{title}</h4>
                {attribution && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                        <Users className="h-3 w-3" />
                        <span>Using content from {attribution.userName}'s profile</span>
                    </div>
                )}
                {isList ? (
                     <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-2">
                        {(value as string[]).map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                ) : (
                    <p className="text-muted-foreground whitespace-pre-wrap">{value as string}</p>
                )}
                 {!isReadOnly && (
                   <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditing(key, value)}>
                          <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRegenerate(key, title)}>
                          <Wand2 className="h-4 w-4" />
                      </Button>
                      {teammates.length > 0 && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                <Users className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64" align="end">
                            <div className="space-y-2">
                              <h4 className="text-sm font-semibold">Copy from teammate</h4>
                              <div className="space-y-1">
                                {teammates.map((teammate) => {
                                  const sectionContent = _.get(teammate.brandText, key);
                                  const hasContent = hasMeaningfulContent(sectionContent);
                                  return (
                                    <Button
                                      key={teammate.userId}
                                      variant="ghost"
                                      className="w-full justify-start text-sm"
                                      disabled={!hasContent}
                                      onClick={() => handleCopyFromTeammate(key, title, teammate.userId, teammate.name)}
                                    >
                                      {teammate.name}
                                      {!hasContent && <span className="ml-auto text-xs text-muted-foreground">(no content)</span>}
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                  </div>
                 )}
            </div>
        );
    };

    if (!brandText) return <p className="text-sm text-muted-foreground">No brand text generated yet. Click the "Generate with AI" button to create it.</p>;

    return (
        <Accordion type="multiple" defaultValue={['core-text']} className="w-full space-y-2">
            <AccordionItem value="core-text">
                <AccordionTrigger className="font-semibold">Core Text</AccordionTrigger>
                <AccordionContent className="space-y-4">
                    {renderField("Mission & Vision", brandText.coreText?.missionVision, 'coreText.missionVision')}
                    {renderField("Brand Story", brandText.coreText?.brandStory, 'coreText.brandStory')}
                    {renderField("Taglines & Slogans", brandText.coreText?.taglines, 'coreText.taglines', true)}
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="marketing-text">
                <AccordionTrigger className="font-semibold">Outreach & Communication Text</AccordionTrigger>
                <AccordionContent className="space-y-4">
                    {renderField("Ad Copy Examples", brandText.marketingText?.adCopy, 'marketingText.adCopy', true)}
                    {renderField("Product Descriptions", brandText.marketingText?.productDescriptions, 'marketingText.productDescriptions', true)}
                    {renderField("Email Initiative Snippets", brandText.marketingText?.emailCampaigns, 'marketingText.emailCampaigns', true)}
                    {renderField("Landing Page Copy", brandText.marketingText?.landingPageCopy, 'marketingText.landingPageCopy')}
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="content-marketing-text">
                <AccordionTrigger className="font-semibold">Content Creation Text</AccordionTrigger>
                <AccordionContent className="space-y-4">
                    {renderField("Blog Post Ideas", brandText.contentMarketingText?.blogPosts, 'contentMarketingText.blogPosts', true)}
                    {renderField("Social Media Captions", brandText.contentMarketingText?.socialMediaCaptions, 'contentMarketingText.socialMediaCaptions', true)}
                    {renderField("White Paper / Case Study Ideas", brandText.contentMarketingText?.whitePapers, 'contentMarketingText.whitePapers', true)}
                    {renderField("Video Script Ideas", brandText.contentMarketingText?.videoScripts, 'contentMarketingText.videoScripts', true)}
                </AccordionContent>
            </AccordionItem>
             <AccordionItem value="technical-text">
                <AccordionTrigger className="font-semibold">Technical & Support Text</AccordionTrigger>
                <AccordionContent className="space-y-4">
                    {renderField("User Manual Snippet", brandText.technicalSupportText?.userManuals, 'technicalSupportText.userManuals')}
                    {/* Note: In-place editing for FAQs is more complex, skipping for now to keep it clean */}
                </AccordionContent>
            </AccordionItem>
             <AccordionItem value="pr-text">
                <AccordionTrigger className="font-semibold">Public Relations (PR) Text</AccordionTrigger>
                <AccordionContent className="space-y-4">
                    {renderField("Press Release Ideas", brandText.publicRelationsText?.pressReleases, 'publicRelationsText.pressReleases', true)}
                    {renderField("Company Statement Examples", brandText.publicRelationsText?.companyStatements, 'publicRelationsText.companyStatements', true)}
                    {renderField("Media Kit Summary", brandText.publicRelationsText?.mediaKitText, 'publicRelationsText.mediaKitText')}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}


function BrandProfileContent() {
  const { user, loading: authLoading, brandId } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { addJob, startJob, setProgress, completeJob, failJob } = useJobQueue();

  // Check if accessing through sponsorship
  const sponsoredBrandId = searchParams.get('sponsor');
  const isSponsored = Boolean(sponsoredBrandId);

  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [brandName, setBrandName] = useState<string>('Team Profile');
  const [loading, setLoading] = useState(true);
  const [sponsorship, setSponsorship] = useState<Sponsorship | null>(null);
  const [sponsorshipLoading, setSponsorshipLoading] = useState(isSponsored);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConfirmingGeneration, setIsConfirmingGeneration] = useState(false);
  const [isUploading, setIsUploading] = useState<'image' | 'video' | 'document' | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<BrandAsset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [assetToPreview, setAssetToPreview] = useState<BrandAsset | null>(null);
  const [userMembership, setUserMembership] = useState<{role: 'MANAGER' | 'CONTRIBUTOR'} | null>(null);
  const [generatedImages, setGeneratedImages] = useState<EditedImage[]>([]);
  const [userDisplayNames, setUserDisplayNames] = useState<{ [userId: string]: string }>({});

  // Engagement State
  const [engagementStats, setEngagementStats] = useState<Record<string, number>>({});
  const [userLoves, setUserLoves] = useState<Record<string, boolean>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [engagementLoading, setEngagementLoading] = useState(true);

  // Banner and logo selection states
  const [isSelectingBanner, setIsSelectingBanner] = useState(false);
  const [isSelectingLogo, setIsSelectingLogo] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<string>('');
  const [selectedLogo, setSelectedLogo] = useState<string>('');

  const documentInputRef = useRef<HTMLInputElement>(null);


  const fetchProfile = useCallback(async () => {
    if (brandId) {
      setLoading(true);

      // If accessing through sponsorship, verify the relationship and load sponsored brand
      if (isSponsored && sponsoredBrandId) {
        setSponsorshipLoading(true);
        try {
          // Verify that current user's brand sponsors the target brand
          const { sponsorship: sponsorshipData, error } = await verifySponsorshipAccessAction(brandId, sponsoredBrandId);
          if (error || !sponsorshipData) {
            // toast({
            //   variant: 'destructive',
            //   title: 'Access Denied',
            //   description: error || 'You do not have valid sponsorship access to this brand profile.'
            // });
            router.push('/settings/team');
            return;
          }
          setSponsorship(sponsorshipData);

          // Load the sponsor brand's profile using special sponsorship access
          const { getSponsorBrandProfileAction } = await import('../actions');
          const sponsorBrandProfile = await getSponsorBrandProfileAction(sponsoredBrandId, brandId!);
          setProfile(sponsorBrandProfile || { summary: '', images: [], videos: [], documents: [] });

          // Set banner and logo from sponsored profile (always reset to clear stale state)
          setSelectedBanner(sponsorBrandProfile?.bannerImageUrl || '');
          setSelectedLogo(sponsorBrandProfile?.logoUrl || '');
        } catch (error) {
          console.error('Error verifying sponsorship:', error);
          // toast({
          //   variant: 'destructive',
          //   title: 'Access Error',
          //   description: 'Unable to verify sponsorship access.'
          // });
          router.push('/settings/team');
          return;
        } finally {
          setSponsorshipLoading(false);
        }
      } else {
        // Normal mode: load current user's brand profile
        const brandProfile = await getBrandProfileAction(brandId);
        setProfile(brandProfile || { summary: '', images: [], videos: [], documents: [] });

        // Fetch brand name
        const { name } = await getBrandNameAction(brandId);
        setBrandName(name || 'Team Profile');

        // Set banner and logo from profile (always reset to clear stale state)
        setSelectedBanner(brandProfile?.bannerImageUrl || '');
        setSelectedLogo(brandProfile?.logoUrl || '');

        // Fetch generated images separately
        try {
          const fetchedImages = await getImagesAction(brandId);
          setGeneratedImages(fetchedImages || []);
        } catch (imageError) {
          console.warn('Could not load generated images:', imageError);
          setGeneratedImages([]);
        }

        // Extract all unique user IDs from brand assets
        const userIds = new Set<string>();
        [...(brandProfile?.images || []), ...(brandProfile?.videos || []), ...(brandProfile?.documents || [])].forEach(asset => {
          if (asset.uploadedBy) {
            userIds.add(asset.uploadedBy);
          }
        });

        // Fetch display names for all users
        if (userIds.size > 0) {
          try {
            const displayNames = await getUserDisplayNamesAction(Array.from(userIds));
            setUserDisplayNames(displayNames);
          } catch (error) {
            console.warn('Could not load user display names:', error);
          }
        }
      }
      setLoading(false);
    }
  }, [brandId, isSponsored, sponsoredBrandId, router, toast]);


  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else {
        fetchProfile();
    }
  }, [user, authLoading, router, fetchProfile]);

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

  useEffect(() => {
    const loadUserMembership = async () => {
      if (user?.uid && brandId && !isSponsored) {
        const membership = await getBrandMembershipAction(user.uid, brandId);
        setUserMembership(membership);
      }
    };
    loadUserMembership();
  }, [user, brandId, isSponsored]);

  const isManager = userMembership?.role === 'MANAGER';

  const handleGenerationRequest = () => {
    if (profile?.brandText) {
      setIsConfirmingGeneration(true);
    } else {
      handleGenerateText();
    }
  };

  const handleGenerateText = async () => {
    if (!brandId) return;
    // Security: Prevent mutations in read-only sponsored mode
    if (isSponsored) {
      toast({ variant: 'destructive', title: 'Action Not Allowed', description: 'Cannot generate text in read-only mode.' });
      return;
    }
    setIsGenerating(true);
    setIsConfirmingGeneration(false);

    // Add job to queue
    const jobId = addJob({
      type: 'brand-text-generation',
      title: 'Generating Team Brand Text',
      description: 'Creating brand text content for team profile',
      resultUrl: '/brand-profile',
    });
    startJob(jobId);
    setProgress(jobId, 5);

    // Simulate progress during generation
    let currentProgress = 5;
    const progressInterval = setInterval(() => {
      currentProgress = Math.min(90, currentProgress + Math.random() * 10);
      setProgress(jobId, Math.round(currentProgress));
    }, 2000);

    const { brandText, error } = await generateBrandTextAction(brandId);
    clearInterval(progressInterval);
    setIsGenerating(false);

    if (error) {
      failJob(jobId, error);
      toast({ variant: 'destructive', title: 'Generation Failed', description: error });
    } else if (brandText) {
      setProfile(prev => ({ ...prev!, brandText }));
      completeJob(jobId, { resultUrl: '/brand-profile' });
      toast({ title: 'Success', description: 'New team text generated and saved.' });
    }
  };

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'document') => {
    if (!brandId) return;
    // Security: Prevent mutations in read-only sponsored mode
    if (isSponsored) {
      toast({ variant: 'destructive', title: 'Action Not Allowed', description: 'Cannot upload files in read-only mode.' });
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    // Production-safe file size limits
    const maxSizeMB = type === 'video' ? 100 : type === 'image' ? 50 : 25; // More conservative limits
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    if (file.size > maxSizeBytes) {
      toast({
        variant: 'destructive',
        title: 'File Too Large',
        description: `${type === 'video' ? 'Video' : type === 'image' ? 'Image' : 'Document'} size must be less than ${maxSizeMB}MB. Current file size: ${(file.size / (1024 * 1024)).toFixed(1)}MB`
      });
      // Clear file input
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
      
      // Provide user-friendly error messages for common production issues
      let errorMessage = error.message || 'An unknown error occurred.';
      
      if (errorMessage.includes('413') || errorMessage.includes('entity too large')) {
        errorMessage = 'File is too large for upload. Please use a smaller file.';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ECONNRESET')) {
        errorMessage = 'Upload timed out. Please try again with a smaller file.';
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        errorMessage = 'Network error during upload. Please check your connection and try again.';
      }
      
      toast({ variant: 'destructive', title: 'Upload Failed', description: errorMessage });
    } finally {
      setIsUploading(null);
      if (type === 'document' && documentInputRef.current) documentInputRef.current.value = '';
    }
  };

  const handleDeleteAsset = async () => {
    if (!brandId || !assetToDelete) return;
    // Security: Prevent mutations in read-only sponsored mode
    if (isSponsored) {
      toast({ variant: 'destructive', title: 'Action Not Allowed', description: 'Cannot delete assets in read-only mode.' });
      setAssetToDelete(null);
      return;
    }
    setIsDeleting(true);
    const { success, error } = await deleteBrandAssetAction(brandId, assetToDelete.id, assetToDelete.url, assetToDelete.type);
    setIsDeleting(false);
    setAssetToDelete(null);

    if (error) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: error });
    } else if(success) {
        setProfile(prev => {
            const newProfile = { ...prev! };
            if(assetToDelete.type === 'image') newProfile.images = (newProfile.images || []).filter(img => img.id !== assetToDelete.id);
            if(assetToDelete.type === 'video') newProfile.videos = (newProfile.videos || []).filter(vid => vid.id !== assetToDelete.id);
            if(assetToDelete.type === 'document') newProfile.documents = (newProfile.documents || []).filter(doc => doc.id !== assetToDelete.id);
            return newProfile;
        });
      toast({ title: 'Success', description: 'Asset deleted.' });
    }
  };

  const handleBannerSelection = async () => {
    if (!brandId || !selectedBanner) return;
    if (isSponsored || !isManager) {
      toast({ variant: 'destructive', title: 'Action Not Allowed', description: 'Only managers can update the banner.' });
      return;
    }
    
    const { success, error } = await updateBrandBannerAction(brandId, selectedBanner);
    if (error) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error });
    } else {
      setProfile(prev => ({ ...prev!, bannerImageUrl: selectedBanner }));
      toast({ title: 'Success', description: 'Banner updated successfully.' });
      setIsSelectingBanner(false);
    }
  };

  const handleLogoSelection = async () => {
    if (!brandId || !selectedLogo) return;
    if (isSponsored || !isManager) {
      toast({ variant: 'destructive', title: 'Action Not Allowed', description: 'Only managers can update the logo.' });
      return;
    }
    
    const { success, error } = await updateBrandLogoAction(brandId, selectedLogo);
    if (error) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error });
    } else {
      setProfile(prev => ({ ...prev!, logoUrl: selectedLogo }));
      toast({ title: 'Success', description: 'Logo updated successfully.' });
      setIsSelectingLogo(false);
    }
  };

  // Combine brand assets with AI generated images
  const brandAssets = [...(profile?.images || [])];
  const aiGeneratedAssets = generatedImages.map(img => ({
    id: img.id,
    name: img.title,
    url: img.generatedImageUrl,
    type: 'image' as const,
    sourceCampaignId: (img as any).sourceCampaignId || null,
    sourceCampaignDate: (img as any).sourceCampaignDate || null,
    sourceType: (img as any).sourceType || null,
  }));
  const imageAssets = [...brandAssets, ...aiGeneratedAssets].filter(asset => asset.url && asset.url.trim() !== '');

  if (authLoading || !user || loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageTransition className="min-h-screen bg-background text-foreground">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild className="-ml-2">
              <Link href="/brand-profile/personal">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Personal View
              </Link>
            </Button>
            <span className="font-semibold hidden md:inline-block">{brandName}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isSponsored && isManager && (
              <Button onClick={handleGenerationRequest} disabled={isGenerating} size="sm" variant="outline">
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                <span className="hidden sm:inline">Generate All Text</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Sponsorship/Read-only notice */}
      {(isSponsored || !isManager) && (
        <div className="bg-muted/50 border-b">
          <div className="container py-2 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            {isSponsored ? (
              <>
                <HeartIcon className="h-3 w-3" />
                Sponsored by {sponsorship?.sponsorBrandName} (Read-Only)
              </>
            ) : (
              <>
                  <LockIcon className="h-3 w-3" />
                Read-Only Access (Manager permissions required to edit)
              </>
            )}
          </div>
        </div>
      )}

      <div className="container max-w-5xl mx-auto pb-20">
        {/* Profile Header */}
        <div className="mb-8">
          {/* Banner */}
          <div className="relative h-48 md:h-64 w-full rounded-b-xl overflow-hidden bg-muted group">
            {(selectedBanner || profile?.bannerImageUrl) ? (
              <NextImage
                src={selectedBanner || profile?.bannerImageUrl || ''}
                alt="Banner"
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-blue-600 to-purple-600">
                <h1 className="text-4xl font-bold text-white/20">Team Profile</h1>
              </div>
            )}
            {!isSponsored && isManager && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button variant="secondary" size="sm" onClick={() => setIsSelectingBanner(true)}>
                  <Pencil className="w-4 h-4 mr-2" /> Change Banner
                </Button>
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="px-4 md:px-8 relative">
            <div className="flex flex-col md:flex-row gap-6 items-start -mt-12 md:-mt-16 mb-6">
              {/* Avatar */}
              <div className="relative group shrink-0">
                <div className="h-24 w-24 md:h-32 md:w-32 rounded-full border-4 border-background bg-background overflow-hidden shadow-lg">
                  <Avatar className="h-full w-full">
                    <AvatarImage src={selectedLogo || profile?.logoUrl} alt={brandName} className="object-cover" />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {brandName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                {!isSponsored && isManager && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => setIsSelectingLogo(true)}>
                    <Pencil className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>

              {/* Info & Stats */}
              <div className="flex-1 pt-12 md:pt-16 w-full">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold">{brandName}</h1>
                    <p className="text-muted-foreground">@{brandName.toLowerCase().replace(/\s+/g, '')}</p>
                  </div>

                  <div className="flex gap-6 text-center">
                    <div>
                      <div className="font-bold text-lg">{imageAssets.length}</div>
                      <div className="text-xs text-muted-foreground">Posts</div>
                    </div>
                    <div>
                      <div className="font-bold text-lg">{(profile?.videos || []).length}</div>
                      <div className="text-xs text-muted-foreground">Videos</div>
                    </div>
                    <div>
                      <div className="font-bold text-lg">{(profile?.documents || []).length}</div>
                      <div className="text-xs text-muted-foreground">Docs</div>
                    </div>
                  </div>
                </div>

                {/* Bio */}
                <div className="mt-4 max-w-2xl">
                  {profile?.summary ? (
                    <p className="whitespace-pre-wrap">{profile.summary}</p>
                  ) : (
                    <p className="text-muted-foreground italic">No team summary yet.</p>
                  )}
                  {profile?.tagline && (
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">{profile.tagline}</Badge>
                    </div>
                  )}
                </div>

                {/* Engagement Metrics */}
                {profile?.engagementMetrics && profile.engagementMetrics.length > 0 && (
                  <div className="mt-4">
                    <MetricsStrip metrics={profile.engagementMetrics} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="posts" className="w-full">
          <div className="sticky top-14 z-30 bg-background/95 backdrop-blur border-b mb-6">
            <div className="container px-0">
              <TabsList className="w-full justify-start h-12 bg-transparent p-0 space-x-6 rounded-none">
                <TabsTrigger
                  value="posts"
                  className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 font-medium text-muted-foreground data-[state=active]:text-foreground"
                >
                  <Grid3X3 className="w-4 h-4 mr-2" />
                  Posts
                </TabsTrigger>
                <TabsTrigger
                  value="reels"
                  className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 font-medium text-muted-foreground data-[state=active]:text-foreground"
                >
                  <Film className="w-4 h-4 mr-2" />
                  Reels
                </TabsTrigger>
                <TabsTrigger
                  value="docs"
                  className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 font-medium text-muted-foreground data-[state=active]:text-foreground"
                >
                  <FileTextIcon className="w-4 h-4 mr-2" />
                  Docs
                </TabsTrigger>
                <TabsTrigger
                  value="about"
                  className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 font-medium text-muted-foreground data-[state=active]:text-foreground"
                >
                  <Info className="w-4 h-4 mr-2" />
                  About
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Posts Tab (Images) */}
          <TabsContent value="posts" className="px-4 min-h-[400px]">
            {!isSponsored && isManager && (
              <div className="mb-6">
                <CompactInput placeholder="Ask Team Companion about photos..." className="mb-4" />
              </div>
            )}

            {imageAssets.length > 0 ? (
              <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-1 md:gap-4">
                {imageAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="relative group aspect-square overflow-hidden bg-muted rounded-md cursor-pointer"
                    onClick={() => setAssetToPreview(asset)}
                  >
                    <NextImage
                      src={asset.url}
                      alt={asset.name || 'Post'}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white" onClick={(e) => {
                      e.stopPropagation();
                      setAssetToPreview(asset);
                    }}>
                      <div className="flex items-center font-bold hover:scale-110 transition-transform">
                        <LoveInteraction
                          assetId={asset.id}
                          brandId={brandId || ''}
                          initialCount={engagementStats[asset.id] || 0}
                          initialIsLoved={userLoves[asset.id] || false}
                          onToggle={(e) => handleToggleLove(asset.id, e)}
                          className="text-white"
                          iconClassName="w-5 h-5 mr-2 text-white"
                        />
                      </div>
                    </div>
                    {/* View Campaign button for shared content with campaign link */}
                    {(asset as any).sourceCampaignId && (
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 bg-black/50 hover:bg-black/70"
                        onClick={(e) => {
                          e.stopPropagation();
                          const campaignId = (asset as any).sourceCampaignId;
                          const campaignDate = (asset as any).sourceCampaignDate;
                          const url = campaignDate
                            ? `/?campaignId=${campaignId}&date=${campaignDate}`
                            : `/?campaignId=${campaignId}`;
                          router.push(url);
                        }}
                        title="View Campaign"
                      >
                        <Calendar className="w-4 h-4 text-white" />
                      </Button>
                    )}
                    {!isSponsored && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssetToDelete(asset);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <LayoutGrid className="w-16 h-16 mb-4 opacity-20" />
                <p>No posts yet</p>
                </div>
            )}
          </TabsContent>

          {/* Reels Tab (Videos) */}
          <TabsContent value="reels" className="px-4 min-h-[400px]">
            {!isSponsored && isManager && (
              <div className="mb-6">
                <CompactInput placeholder="Ask Team Companion about videos..." className="mb-4" />
              </div>
            )}

            {(profile?.videos || []).filter(v => v.url && v.url.trim() !== '').length > 0 ? (
              <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-1 md:gap-4">
                {profile?.videos.filter(v => v.url && v.url.trim() !== '').map((video) => (
                  <div
                    key={video.id}
                    className="relative group aspect-[9/16] overflow-hidden bg-black rounded-md cursor-pointer"
                    onClick={() => setAssetToPreview(video)}
                  >
                    {isYouTubeUrl(video.url) ? (
                      <img
                        src={getYouTubeThumbnailUrl(video.url) || ''}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity"
                        alt={video.name}
                      />
                    ) : (
                        <video
                          src={video.url}
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity"
                        />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                        <Film className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="font-medium truncate text-sm">{video.name}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-3 text-sm">
                          <LoveInteraction
                            assetId={video.id}
                            brandId={brandId || ''}
                            initialCount={engagementStats[video.id] || 0}
                            initialIsLoved={userLoves[video.id] || false}
                            onToggle={(e) => handleToggleLove(video.id, e)}
                            className="text-white hover:text-red-400"
                            iconClassName="w-3 h-3 mr-1"
                          />
                          <div
                            className="flex items-center gap-1 cursor-pointer hover:text-blue-400 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAssetToPreview(video);
                            }}
                          >
                            <MessageCircle className="w-3 h-3 mr-1" />
                            {commentCounts[video.id] || 0}
                          </div>
                        </div>
                      </div>
                    </div>
                    {!isSponsored && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssetToDelete(video);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Film className="w-16 h-16 mb-4 opacity-20" />
                <p>No videos yet</p>
                </div>
            )}
          </TabsContent>

          {/* Docs Tab */}
          <TabsContent value="docs" className="px-4 min-h-[400px]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                {(profile?.documents || []).filter(d => d.url && d.url.trim() !== '').length > 0 ? (
                  profile?.documents.filter(d => d.url && d.url.trim() !== '').map((doc) => (
                    <ProfileDocumentCard
                      key={doc.id}
                      documentId={doc.id}
                      documentName={doc.name}
                      documentUrl={doc.url}
                      brandId={brandId as string}
                      gcsUri={doc.url}
                      canDelete={!isSponsored && isManager}
                      onDelete={() => setAssetToDelete(doc)}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border rounded-lg border-dashed">
                    <FileTextIcon className="w-12 h-12 mb-4 opacity-20" />
                    <p>No documents uploaded</p>
                    <p className="text-sm mt-2">Upload documents to enable AI-powered search and summaries</p>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {!isSponsored && isManager && (
                  <div className="bg-muted/50 rounded-xl p-6 border">
                    <div className="text-center">
                      <h3 className="font-semibold mb-2">Upload Document</h3>
                      <p className="text-sm text-muted-foreground mb-4">Upload guidelines, white papers, or other team documents.</p>
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
                  <RagQueryDialog brandId={brandId as string} documents={profile?.documents || []} />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about" className="px-4 pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <div className="lg:col-span-1">
                <h3 className="text-lg font-semibold mb-4">Identity</h3>
                <EditableBrandIdentityPanel
                  brandName={brandName}
                  brandProfile={profile!}
                  onEditLogo={(!isSponsored && isManager) ? () => setIsSelectingLogo(true) : undefined}
                  onUpdateField={async (field, value) => {
                    if (!brandId || !isManager || isSponsored) return;
                    if (field === 'name') {
                      const result = await updateBrandIdentityAction(brandId, field, value);
                      if (result.success) setBrandName(value);
                    } else if (field !== 'displayName') {
                      const result = await updateBrandIdentityAction(brandId, field, value);
                      if (result.success && profile) setProfile({ ...profile, [field]: value });
                    }
                  }}
                  canEdit={!isSponsored && isManager}
                  isPersonalProfile={false}
                />
              </div>

              <div className="lg:col-span-2">
                <h3 className="text-lg font-semibold mb-4">Brand Voice & Text</h3>
                <BrandTextDisplay
                  initialBrandText={profile?.brandText}
                  brandId={(isSponsored ? sponsoredBrandId : brandId) as string}
                  isReadOnly={isSponsored || !isManager}
                  attributions={profile?.brandTextAttributions}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <Dialog open={isSelectingBanner} onOpenChange={setIsSelectingBanner}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Banner Image</DialogTitle>
            <DialogDescription>Choose an image from your gallery to use as the banner</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
            {imageAssets.length > 0 ? (
              imageAssets.map(asset => (
                <div
                  key={asset.id}
                  className={`relative aspect-video rounded-md overflow-hidden border-2 cursor-pointer transition-all ${
                    selectedBanner === asset.url ? 'border-blue-600 ring-2 ring-blue-600' : 'border-transparent hover:border-gray-400'
                  }`}
                  onClick={() => setSelectedBanner(asset.url)}
                >
                  <NextImage src={asset.url} alt={asset.name || 'Asset preview'} fill className="object-cover" />
                </div>
              ))
            ) : (
              <p className="col-span-full text-center text-muted-foreground py-8">No images available. Upload images first.</p>
            )}
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
            <DialogDescription>Choose an image from your gallery to use as the profile picture</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
            {imageAssets.length > 0 ? (
              imageAssets.map(asset => (
                <div
                  key={asset.id}
                  className={`relative aspect-square rounded-full overflow-hidden border-2 cursor-pointer transition-all ${
                    selectedLogo === asset.url ? 'border-blue-600 ring-2 ring-blue-600' : 'border-transparent hover:border-gray-400'
                  }`}
                  onClick={() => setSelectedLogo(asset.url)}
                >
                  <NextImage src={asset.url} alt={asset.name || 'Asset preview'} fill className="object-cover" />
                </div>
              ))
            ) : (
              <p className="col-span-full text-center text-muted-foreground py-8">No images available. Upload images or generate with AI first.</p>
            )}
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
                <AlertDialogTitle>
                <AlertTriangle className="inline-block mr-2 text-destructive" />
                Are you sure you want to delete this asset?
                </AlertDialogTitle>
                <AlertDialogDescription>
                This will permanently delete the file &quot;{assetToDelete?.name}&quot; from your brand profile. This action cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAsset} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Yes, delete asset
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isConfirmingGeneration} onOpenChange={setIsConfirmingGeneration}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>
                    <AlertTriangle className="inline-block mr-2 text-destructive" />
                    Overwrite Existing Content?
                </AlertDialogTitle>
                <AlertDialogDescription>
                    You have already generated brand text. Generating new text will overwrite the existing content. Are you sure you want to continue?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isGenerating}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleGenerateText} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                    Yes, Overwrite
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
                    disabled={isSponsored}
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
                {/* Share/More actions could go here */}
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" variant="secondary" asChild>
                  <a href={assetToPreview?.url} target="_blank" rel="noopener noreferrer">Open Original</a>
                </Button>
                {!isSponsored && (
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
    </PageTransition>
  );
}

export default function BrandProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-lg font-medium">Loading team profile...</span>
        </div>
      </div>
    }>
      <BrandProfileContent />
    </Suspense>
  );
}
