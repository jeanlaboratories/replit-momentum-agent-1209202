
'use client';

import {useState, useEffect, useCallback, useRef} from 'react';
import type {CampaignTimeline, GeneratedCampaignContent, BrandProfile, EditedImage, Video, CampaignDay, ContentBlock, GeneratedContentBlock} from '@/lib/types';
import CampaignTimelineEditor from '@/components/campaign-timeline-editor';
import CampaignPreview from '@/components/campaign-preview';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
} from '@/components/ui/glass-card';
import { PageTransition } from '@/components/ui/page-transition';
import {useAuth} from '@/hooks/use-auth';
import { useBrandData } from '@/hooks/use-brand-data';
import {useRouter, useSearchParams} from 'next/navigation';
import {Loader2, FileText, Plus, ImageIcon, Video as VideoIcon, Music2, Sparkles} from 'lucide-react';
import { getBrandProfileAction, generateBrandSummaryAction } from './actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { generateId } from '@/lib/utils';
import _ from 'lodash';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarInset,
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import NextImage from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { differenceInCalendarDays } from 'date-fns';
import { isBeforeToday, isTodayOrFuture } from '@/lib/utils';
import { useTimezone } from '@/contexts/TimezoneContext';
import { formatDateInTimezone, isBeforeTodayInTimezone, parseISODateInTimezone } from '@/lib/timezone-utils';


type Step = 'TIMELINE_EDITOR' | 'CAMPAIGN_PREVIEW';

function BrandContextSidebar({
  onAddAsset,
}: {
  onAddAsset: (asset: { name: string; url: string; type: 'image' | 'video'}) => void;
}) {
  const { brandProfile, images, videos, loading, refetch } = useBrandData();
  const { brandId } = useAuth();
  const { toast } = useToast();
  const [generatingSummary, setGeneratingSummary] = useState(false);
  
  const recentMedia = [
    ...images.slice(0, 1).map(img => ({ name: img.title, url: img.generatedImageUrl || img.sourceImageUrl, type: 'image' as const })),
    ...videos.slice(0, 1).map(vid => ({ name: vid.title, url: vid.videoUrl, type: 'video' as const }))
  ];

  return (
    <>
      <SidebarHeader>
        <h2 className="text-lg font-headline font-semibold">Team Context</h2>
        <p className="text-sm text-sidebar-foreground/70">
          This context will be used for your initiative. Manage it on the <a href="/brand-profile" className="underline">Team Profile</a> page.
        </p>
      </SidebarHeader>
      <SidebarContent className="p-0">
         <SidebarGroup>
            <div className="flex items-center justify-between px-2">
              <SidebarGroupLabel>
                Team Mission
              </SidebarGroupLabel>
              {brandId && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 text-xs"
                  onClick={async () => {
                    setGeneratingSummary(true);
                    try {
                      const { summary, error } = await generateBrandSummaryAction(brandId);
                      if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error });
                      } else if (summary) {
                        await refetch.profile();
      toast({ title: 'Forward Motion Achieved!', description: `Your team's direction is now crystal clear and ready to propel you forward` });
                      }
                    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate summary' });
                    } finally {
                      setGeneratingSummary(false);
                    }
                  }}
                  disabled={generatingSummary}
                >
                  {generatingSummary ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-1" />
                      {brandProfile?.summary ? 'Regenerate' : 'Generate'}
                    </>
                  )}
                </Button>
              )}
            </div>
          <p className="rounded-lg bg-primary/10 p-3 text-sm text-foreground border border-primary/20">
            {brandProfile?.summary || "No summary available."}
            </p>
         </SidebarGroup>
        
        {loading.media ? <Loader2 className="animate-spin mx-auto" /> : recentMedia.length > 0 && (
            <SidebarGroup>
                <SidebarGroupLabel>Recent Media</SidebarGroupLabel>
                <div className="grid grid-cols-2 gap-2">
                    {recentMedia.map((asset, index) => (
                    <button
                        key={index}
                        onClick={() => onAddAsset(asset)}
                        className="relative aspect-video overflow-hidden rounded-lg bg-muted group"
                    >
                        {asset.type === 'video' ? (
                        <video
                            src={asset.url}
                            key={asset.url}
                            controls={false}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover"
                        />
                        ) : (
                        <NextImage
                            src={asset.url}
                            alt={asset.name}
                            fill
                            sizes="(max-width: 768px) 50vw, 25vw"
                            className="object-cover"
                        />
                        )}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Plus className="h-8 w-8 text-white" />
                        </div>
                    </button>
                    ))}
              <Link href="/images" className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-colors aspect-video">
                <ImageIcon className="h-6 w-6 text-primary" />
                <span className="text-xs text-primary font-medium">Image Gallery</span>
                    </Link>
              <Link href="/videos" className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-colors aspect_video">
                <VideoIcon className="h-6 w-6 text-primary" />
                <span className="text-xs text-primary font-medium">Video Gallery</span>
                    </Link>
              <Link href="/music" className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-colors aspect-video">
                <Music2 className="h-6 w-6 text-primary" />
                <span className="text-xs text-primary font-medium">Music Gallery</span>
                    </Link>
                </div>
            </SidebarGroup>
        )}
      </SidebarContent>
    </>
  )
}

const getCampaignStartDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
};

const getDefaultCampaignName = () => {
    const today = new Date();
    const month = today.toLocaleString('en-US', { month: 'short' });
    const day = today.getDate();
    const year = today.getFullYear();
    return `My New Team Project ${month} ${day}, ${year}`;
};

export default function Home() {
  const [step, setStep] = useState<Step>('TIMELINE_EDITOR');
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [campaignTimeline, setCampaignTimeline] = useState<CampaignTimeline>([]);
  const [initialCampaignTimeline, setInitialCampaignTimeline] = useState<CampaignTimeline>([]);
  const [generatedContent, setGeneratedContent] =
    useState<GeneratedCampaignContent | null>(null);
  const [initialGeneratedContent, setInitialGeneratedContent] = useState<GeneratedCampaignContent | null>(null);
  const [loadedCampaignId, setLoadedCampaignId] = useState<string | null>(null);
  const [campaignUpdatedAt, setCampaignUpdatedAt] = useState<string | null>(null);
  const [campaignUpdatedBy, setCampaignUpdatedBy] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState(() => getDefaultCampaignName());
  const [campaignPrompt, setCampaignPrompt] = useState<string>('');
  const [characterConsistency, setCharacterConsistency] = useState<{
    enabled: boolean;
    characters: { id: string; name: string; characterSheetUrl: string; isActive: boolean; }[];
    useSceneToSceneConsistency: boolean;
    maxReferenceImages: number;
  } | undefined>(undefined);

  const {user, loading: authLoading, brandId} = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { timezone } = useTimezone();

  const [profileLoading, setProfileLoading] = useState(true);
  const [urlCampaignId, setUrlCampaignId] = useState<string | null>(null);
  const [pendingNavigationDate, setPendingNavigationDate] = useState<string | null>(null);

  const [view, setView] = useState<'calendar' | 'day'>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedDay, setSelectedDay] = useState<CampaignDay | null>(null);
  const [campaignStartDate] = useState(() => getCampaignStartDate());

  const hasUnsavedChanges = !_.isEqual(campaignTimeline, initialCampaignTimeline) || !_.isEqual(generatedContent, initialGeneratedContent);
  
  useUnsavedChanges(hasUnsavedChanges);

  const fetchProfile = useCallback(async () => {
    if (brandId) {
      setProfileLoading(true);
      let userProfile = await getBrandProfileAction(brandId);
      
      // If the profile exists but the summary doesn't, generate it.
      if (userProfile && !userProfile.summary) {
        const loadingToast = toast({ title: 'Igniting Momentum...', description: 'Setting your team in motion with an AI-powered mission statement' });
        const { summary, error } = await generateBrandSummaryAction(brandId);
        if (error) {
          toast({ variant: 'destructive', title: 'Mission Generation Failed', description: error });
        } else if(summary) {
          userProfile.summary = summary;
          if (loadingToast) {
            loadingToast.dismiss();
          }
        }
      }
      
      setBrandProfile(userProfile);
      setProfileLoading(false);
    }
  }, [brandId, toast]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if(user && brandId) {
        fetchProfile();
    }
  }, [user, authLoading, router, fetchProfile, brandId]);


    const handleAddAsset = (asset: { name: string; url: string; type: 'image' | 'video'}) => {
        if (!selectedDay) {
      toast({
        title: 'Select a Day',
        description: 'Click a day on the calendar to add this asset.'
      });
            return;
        }

        const newContentBlock: ContentBlock = {
            id: generateId(),
            contentType: 'Social Media Post',
            keyMessage: '',
            toneOfVoice: 'Professional',
            assetUrl: asset.url
        };
        
        setCampaignTimeline(prev => {
            return prev.map(d => {
                if (d.id === selectedDay.id) {
                    return {...d, contentBlocks: [...d.contentBlocks, newContentBlock]}
                }
                return d;
            })
        });
        
      toast({
        title: 'Momentum Building!',
        description: `"${asset.name}" added to amplify your impact on day ${selectedDay.day}`,
      });
    }

  const getDayFromDate = (date: Date, timeline: CampaignTimeline, startDate: Date) => {
    const dayNumber = differenceInCalendarDays(date, startDate) + 1;
    if (dayNumber < 1) return null;
    
    return timeline.find(day => day.day === dayNumber);
  }

  // Find or create a day for a given date
  const findOrCreateDay = useCallback((date: Date, shouldEnterView: boolean = false) => {
    // Check if selected date is in the past (timezone-aware)
    if (isBeforeTodayInTimezone(date, timezone)) {
      toast({
        variant: 'destructive',
        title: 'Past Date Not Allowed',
        description: 'Initiatives can only be scheduled for today or future dates.',
      });
        return;
    }

    // Use timezone-aware date formatting for comparison (matches calendar-view behavior)
    const selectedDateStr = formatDateInTimezone(date, timezone);

    // First, try to find an existing day by its persisted date field
    // Use parseISODateInTimezone to match how calendar-view parses dates
    let day = campaignTimeline.find(d => {
        const dayDate = parseISODateInTimezone(d.date, timezone);
        const dayDateStr = formatDateInTimezone(dayDate, timezone);
        return dayDateStr === selectedDateStr;
    });

    if (day) {
        setSelectedDay(day);
        if (shouldEnterView) {
            setView('day');
        }
    } else {
        // No existing day for this date - create a new one
        // Normalize date to local midnight for storage
        const normalizedDate = new Date(date);
        normalizedDate.setHours(0, 0, 0, 0);

        const newDayData: CampaignDay = {
            id: 'temp-id', // Temporary ID, will be renumbered
            day: 0, // Temporary number, will be renumbered
            date: normalizedDate.toISOString(), // Store the normalized date (midnight)
            contentBlocks: [],
        };

        // Add new day, sort by DATE (chronological), then renumber
        const updatedTimeline = [...campaignTimeline, newDayData]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map((d, index) => ({
                ...d,
                day: index + 1, // Renumber chronologically
                id: `day-${index + 1}`, // Update ID to match
            }));

        // Find the newly created day after renumbering (use timezone-aware comparison)
        const newDay = updatedTimeline.find(d => {
            const dayDate = parseISODateInTimezone(d.date, timezone);
            const dDateStr = formatDateInTimezone(dayDate, timezone);
            return dDateStr === selectedDateStr;
        });

        setCampaignTimeline(updatedTimeline);
        setSelectedDay(newDay || updatedTimeline[0]);

        if (shouldEnterView) {
            setView('day');
        }
    }
  }, [campaignTimeline, toast, setSelectedDay, setCampaignTimeline, setView, timezone]);
  
  // Handler for single-click: create day but stay in calendar view
  const handleDayCreate = useCallback((date: Date) => {
    findOrCreateDay(date, false);
  }, [findOrCreateDay]);
  
  // Handler for bulk creation: create multiple days but stay in calendar view
  const handleDaysCreate = useCallback((dates: Date[]) => {
    setCampaignTimeline(prev => {
      let currentTimeline = [...prev];
      let changed = false;

      dates.forEach(date => {
        // Use timezone-aware date formatting for comparison
        const selectedDateStr = formatDateInTimezone(date, timezone);

        const exists = currentTimeline.some(d => {
          const dayDateStr = formatDateInTimezone(new Date(d.date), timezone);
          return dayDateStr === selectedDateStr;
        });

        if (!exists) {
          // Normalize to local midnight for storage
          const normalizedDate = new Date(date);
          normalizedDate.setHours(0, 0, 0, 0);

          const newDayData: CampaignDay = {
            id: 'temp-id',
            day: 0,
            date: normalizedDate.toISOString(),
            contentBlocks: [{
              id: generateId(),
              contentType: 'Social Media Post',
              keyMessage: '',
              toneOfVoice: 'Professional',
            }],
          };
          currentTimeline.push(newDayData);
          changed = true;
        }
      });

      if (!changed) return prev;

      // Sort and renumber once at the end
      return currentTimeline
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((d, index) => ({
          ...d,
          day: index + 1,
          id: `day-${index + 1}`,
        }));
    });

    if (dates.length > 0) {
      toast({
        title: 'Days Created',
        description: 'Default content blocks added. Click Generate to create content.',
      });
    }
  }, [setCampaignTimeline, toast, timezone]);

  const handleDayRemove = useCallback((date: Date) => {
    // Use timezone-aware date formatting for comparison
    const dateStr = formatDateInTimezone(date, timezone);

    setCampaignTimeline(prev => {
      const dayToRemove = prev.find(d => formatDateInTimezone(new Date(d.date), timezone) === dateStr);

      if (!dayToRemove) return prev;

      if (dayToRemove.contentBlocks.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Cannot Remove Day',
          description: 'You can only remove days that have no content blocks.',
        });
        return prev;
      }

      const updatedTimeline = prev
        .filter(d => d.id !== dayToRemove.id)
        .map((day, index) => ({
          ...day,
          day: index + 1,
          id: `day-${index + 1}`,
          date: day.date,
        }));

      return updatedTimeline;
    });

    toast({
      title: 'Day Removed',
      description: 'The empty day has been removed.',
    });
  }, [setCampaignTimeline, toast, timezone]);

  // Handler for double-click: create day and enter day view
  const handleEnterDayView = useCallback((date: Date) => {
    findOrCreateDay(date, true);
  }, [findOrCreateDay]);

  const onCampaignLoaded = useCallback((
    loadedTimeline: CampaignTimeline,
    loadedContent: GeneratedCampaignContent,
    campaignId: string,
    name: string,
    auditInfo?: {
      updatedAt?: string;
      updatedBy?: string;
      createdAt?: string;
      createdBy?: string;
      originalPrompt?: string;
      characterConsistency?: {
        enabled: boolean;
        characters: { id: string; name: string; characterSheetUrl: string; isActive: boolean; }[];
        useSceneToSceneConsistency: boolean;
        maxReferenceImages: number;
      };
    }
  ) => {
    setCampaignTimeline(loadedTimeline);
    setGeneratedContent(loadedContent);
    setInitialCampaignTimeline(_.cloneDeep(loadedTimeline));
    setInitialGeneratedContent(_.cloneDeep(loadedContent));
    setLoadedCampaignId(campaignId);
    if (auditInfo?.updatedAt) {
      setCampaignUpdatedAt(auditInfo.updatedAt);
    }
    if (auditInfo?.updatedBy) {
      setCampaignUpdatedBy(auditInfo.updatedBy);
    }
    if (auditInfo?.originalPrompt) {
      setCampaignPrompt(auditInfo.originalPrompt);
    }
    if (auditInfo?.characterConsistency) {
      setCharacterConsistency(auditInfo.characterConsistency);
    }
    setCampaignName(name);
    setStep('TIMELINE_EDITOR');
    setView('calendar');
  }, []);

  useEffect(() => {
    if (selectedDay) {
        const updatedDay = campaignTimeline.find(d => d.id === selectedDay.id);
        if (updatedDay) {
            setSelectedDay(updatedDay);
        } else {
            setSelectedDay(null);
            setView('calendar');
        }
    }
  }, [campaignTimeline, selectedDay]);
  
  // Update selectedDay when selectedDate changes (for navigation)
  // Uses timezone-aware date comparison to match calendar-view behavior
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDay(null);
      return;
    }

    // Use timezone-aware date formatting for comparison (matches calendar-view and findOrCreateDay)
    const selectedDateStr = formatDateInTimezone(selectedDate, timezone);

    // Find the day that matches this date
    // Use parseISODateInTimezone to match how calendar-view parses dates
    const day = campaignTimeline.find(d => {
      const dayDate = parseISODateInTimezone(d.date, timezone);
      const dayDateStr = formatDateInTimezone(dayDate, timezone);
      return dayDateStr === selectedDateStr;
    });

    if (day) {
      // Only update if it's different to avoid infinite loops
      if (!selectedDay || selectedDay.id !== day.id) {
        setSelectedDay(day);
      }
    } else {
      // No day exists for this date
      setSelectedDay(null);
    }
  }, [selectedDate, campaignTimeline, timezone]);

  // Check URL params and sessionStorage for campaign ID on mount
  useEffect(() => {
    // First check URL parameters (from calendar icon click on shared posts)
    const urlCampaignIdParam = searchParams.get('campaignId');
    const urlDateParam = searchParams.get('date');

    if (urlCampaignIdParam) {
      setUrlCampaignId(urlCampaignIdParam);
      if (urlDateParam) {
        setPendingNavigationDate(urlDateParam);
      }
      // Clean up URL without triggering a navigation
      window.history.replaceState({}, '', '/');
      return;
    }

    // Fall back to sessionStorage
    if (typeof window !== 'undefined') {
      const campaignId = sessionStorage.getItem('autoLoadCampaignId');
      if (campaignId) {
        setUrlCampaignId(campaignId);
        // Clear sessionStorage and localStorage for pending campaign
        sessionStorage.removeItem('autoLoadCampaignId');
        localStorage.removeItem('pendingCampaign');
        sessionStorage.removeItem('pendingCampaign');
      }
    }
  }, [searchParams]);

  // Auto-load campaign when urlCampaignId is set
  useEffect(() => {
    const autoLoadCampaign = async () => {
      if (urlCampaignId && brandId && !profileLoading) {
        // Import and call the load campaign action
        const { loadCampaignAction } = await import('@/app/actions');
        const result = await loadCampaignAction(urlCampaignId);
        
        if (!result.error && result.campaignContent && result.campaignName) {
          // Transform to timeline format (same logic as in campaign-timeline-editor.tsx)
          const startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          
          const loadedTimeline: CampaignTimeline = result.campaignContent.map((day) => {
            let dayDate: Date;
            if (day.date) {
              dayDate = new Date(day.date);
            } else {
              dayDate = new Date(startDate);
              dayDate.setDate(dayDate.getDate() + (day.day - 1));
            }
            
            return {
              id: `day-${day.day}`,
              day: day.day,
              date: dayDate.toISOString(),
              contentBlocks: (day.contentBlocks || []).map(block => ({
                id: block.id || generateId(),
                contentType: block.contentType as ContentBlock['contentType'],
                keyMessage: block.keyMessage || '',
                toneOfVoice: (block.toneOfVoice as ContentBlock['toneOfVoice']) || 'Professional',
                assetUrl: (block as any).assetUrl,
                imageUrl: block.imageUrl,
                scheduledTime: block.scheduledTime,
                adCopy: block.adCopy,
              }))
            };
          });

          onCampaignLoaded(loadedTimeline, result.campaignContent, urlCampaignId, result.campaignName, {
            updatedAt: result.updatedAt,
            updatedBy: result.updatedBy,
            createdAt: result.createdAt,
            createdBy: result.createdBy,
            originalPrompt: result.originalPrompt,
            characterConsistency: result.characterConsistency,
          });

          // Navigate to the specific date if provided (from shared post calendar icon)
          if (pendingNavigationDate) {
            const targetDate = new Date(pendingNavigationDate);
            // Find the matching day in the loaded timeline
            const matchingDay = loadedTimeline.find(day => {
              const dayDate = parseISODateInTimezone(day.date, timezone);
              const dayDateStr = formatDateInTimezone(dayDate, timezone);
              const targetDateStr = formatDateInTimezone(targetDate, timezone);
              return dayDateStr === targetDateStr;
            });

            if (matchingDay) {
              setSelectedDate(targetDate);
              setSelectedDay(matchingDay);
              setView('day');
              toast({
                title: 'Initiative Loaded',
                description: `Navigated to ${targetDate.toLocaleDateString()} in "${result.campaignName}"`,
              });
            } else {
              // Just load the campaign, date might not match
              toast({
                title: 'Initiative Loaded',
                description: `Your AI-generated initiative "${result.campaignName}" has been loaded successfully!`,
              });
            }
            setPendingNavigationDate(null);
          } else {
            toast({
              title: 'Initiative Loaded',
              description: `Your AI-generated initiative "${result.campaignName}" has been loaded successfully!`,
            });
          }

          // Clear the urlCampaignId so we don't try to load again
          setUrlCampaignId(null);
        }
      }
    };
    
    autoLoadCampaign();
  }, [urlCampaignId, brandId, profileLoading, onCampaignLoaded, toast, pendingNavigationDate]);

  if (authLoading || !user || profileLoading || !brandId) {
    return (
      <PageTransition>
        <div className="flex h-full min-h-[calc(100vh-var(--header-height))] flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </PageTransition>
    );
  }

  if (!brandProfile) {
    return (
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <PageTransition>
          <GlassCard className="w-full max-w-lg text-center" gradient>
            <GlassCardHeader>
              <GlassCardTitle className="font-headline text-2xl">
                Create Your Team Profile
              </GlassCardTitle>
              <GlassCardDescription>
                To start creating initiatives, you first need to set up your team
                profile. This will help the AI generate content that matches your team.
              </GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent>
              <Button asChild className="w-full sm:w-auto">
                <Link href="/brand-profile">
                  <FileText className="mr-2 h-4 w-4" /> Go to Team Profile
                </Link>
              </Button>
            </GlassCardContent>
          </GlassCard>
        </PageTransition>
        </div>
    );
  }

  const handleCampaignGenerated = (content: GeneratedCampaignContent) => {
    const enrichedContent = content.map((day) => {
        const originalDay = campaignTimeline.find(d => d.day === day.day);
        return {
            ...day,
            date: originalDay?.date, // Include date to preserve day gaps
            contentBlocks: day.contentBlocks.map((block, blockIndex) => {
                const originalBlock = originalDay?.contentBlocks[blockIndex];
                return {
                    ...block,
                    keyMessage: originalBlock?.keyMessage || '',
                    toneOfVoice: originalBlock?.toneOfVoice || 'Professional',
                    assetUrl: originalBlock?.assetUrl,
                    // Set imageUrl from assetUrl so the media displays in the preview
                    imageUrl: originalBlock?.assetUrl || block.imageUrl,
                    scheduledTime: originalBlock?.scheduledTime
                };
            }),
        };
    });

    setGeneratedContent(enrichedContent);
    setInitialGeneratedContent(_.cloneDeep(enrichedContent));
    setInitialCampaignTimeline(_.cloneDeep(campaignTimeline));
    setStep('CAMPAIGN_PREVIEW');
  };
  
  const onCampaignSaved = (id: string, updatedAt?: string) => {
    setInitialCampaignTimeline(_.cloneDeep(campaignTimeline));
    setInitialGeneratedContent(_.cloneDeep(generatedContent));
    setLoadedCampaignId(id);
    if (updatedAt) {
      setCampaignUpdatedAt(updatedAt);
    }
  };
  
  const handleNewCampaign = () => {
    setCampaignTimeline([]);
    setGeneratedContent(null);
    setLoadedCampaignId(null);
    setCampaignUpdatedAt(null);
    setCampaignUpdatedBy(null);
    setInitialCampaignTimeline([]);
    setInitialGeneratedContent(null);
    setCampaignName(getDefaultCampaignName());
    setView('calendar');
    setSelectedDate(new Date());
    
    // Clear any pending campaign generation state
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pendingCampaign');
      sessionStorage.removeItem('pendingCampaign');
      sessionStorage.removeItem('autoLoadCampaignId');
    }
    
    toast({
      title: 'New Initiative Started',
      description: 'Your calendar has been cleared.',
    });
  };

  const handleEditCampaign = () => {
    // Sync timeline with generated content before switching to preview
    const newGeneratedContent = campaignTimeline.map(timelineDay => {
        const existingGeneratedDay = generatedContent?.find(gd => gd.day === timelineDay.day);
        const newContentBlocks: GeneratedContentBlock[] = timelineDay.contentBlocks.map((timelineBlock, index) => {
            const existingBlock = existingGeneratedDay?.contentBlocks[index];

            if (existingBlock) {
                return {
                    ...existingBlock,
                    contentType: timelineBlock.contentType,
                    keyMessage: timelineBlock.keyMessage,
                    toneOfVoice: timelineBlock.toneOfVoice,
                    assetUrl: timelineBlock.assetUrl,
                    scheduledTime: timelineBlock.scheduledTime,
                    // Make sure to carry over the imageUrl if it exists from the timeline block
                    imageUrl: timelineBlock.assetUrl || existingBlock.imageUrl,
                };
            }

            return {
                contentType: timelineBlock.contentType,
                adCopy: '',
                imagePrompt: '',
                keyMessage: timelineBlock.keyMessage,
                toneOfVoice: timelineBlock.toneOfVoice,
                assetUrl: timelineBlock.assetUrl,
                // Set the imageUrl from the assetUrl on creation
                imageUrl: timelineBlock.assetUrl, 
                scheduledTime: timelineBlock.scheduledTime,
            };
        });

        return {
            day: timelineDay.day,
            date: timelineDay.date, // Include date to preserve day gaps
            contentBlocks: newContentBlocks,
        };
    }).filter(day => day.contentBlocks.length > 0);

    setGeneratedContent(newGeneratedContent);
    setStep('CAMPAIGN_PREVIEW');
};

  const handleBackToEditor = () => {
    if (generatedContent) {
      const updatedTimeline = generatedContent.map(day => ({
        id: `day-${day.day}`,
        day: day.day,
        date: day.date || new Date().toISOString(), // Fallback if date missing, though it shouldn't be
        contentBlocks: day.contentBlocks.map(block => ({
          id: block.id || generateId(),
          contentType: block.contentType as any, // Cast to ContentBlock['contentType']
          keyMessage: block.keyMessage || '',
          toneOfVoice: (block.toneOfVoice as any) || 'Professional',
          assetUrl: block.imageUrl, // Sync back imageUrl to assetUrl for consistency if needed, or keep separate
          imageUrl: block.imageUrl,
          scheduledTime: block.scheduledTime,
          adCopy: block.adCopy,
        }))
        }));
        setCampaignTimeline(updatedTimeline);
    }
    setStep('TIMELINE_EDITOR');
  };

  const renderStep = () => {
    switch (step) {
      case 'TIMELINE_EDITOR':
        if (!brandProfile) return null;
        return (
          <>
            <Sidebar>
                <BrandContextSidebar 
                  onAddAsset={handleAddAsset}
                />
            </Sidebar>
            <SidebarInset className="p-0 flex flex-col h-full min-w-0 overflow-x-hidden">
              <CampaignTimelineEditor
                brandId={brandId}
                brandProfile={brandProfile}
                onCampaignGenerated={handleCampaignGenerated}
                campaignTimeline={campaignTimeline}
                setCampaignTimeline={setCampaignTimeline}
                onCampaignLoaded={onCampaignLoaded}
                onNewCampaign={handleNewCampaign}
                view={view}
                setView={setView}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                selectedDay={selectedDay}
                loadedCampaignId={loadedCampaignId}
                onEditCampaign={handleEditCampaign}
                campaignName={campaignName}
                setCampaignName={setCampaignName}
                onDayCreate={handleDayCreate}
                onDaysCreate={handleDaysCreate}
                onDayRemove={handleDayRemove}
                onEnterDayView={handleEnterDayView}
                campaignUpdatedAt={campaignUpdatedAt}
                campaignUpdatedBy={campaignUpdatedBy}
              />
            </SidebarInset>
          </>
        );
      case 'CAMPAIGN_PREVIEW':
        if (!generatedContent || !brandProfile || !brandId) return null;
        return (
           <div className="container mx-auto px-4 py-8 md:px-6 md:py-12">
                <div className="mx-auto max-w-7xl">
              <GlassCard className="mb-8">
                <GlassCardHeader className="text-center">
                  <GlassCardTitle className="font-headline text-3xl md:text-4xl">
                        Initiative Content Editor
                  </GlassCardTitle>
                  <GlassCardDescription className="mx-auto max-w-2xl text-lg">
                        Review, edit, and generate visuals for your initiative &quot;{campaignName}&quot;.
                  </GlassCardDescription>
                </GlassCardHeader>
              </GlassCard>
                    <CampaignPreview
                    brandId={brandId}
                    initialContent={generatedContent}
                    brandProfile={brandProfile}
                    onBack={handleBackToEditor}
                    onCampaignSaved={onCampaignSaved}
                    setGeneratedContent={setGeneratedContent}
                    loadedCampaignId={loadedCampaignId}
                    campaignUpdatedAt={campaignUpdatedAt}
                    campaignName={campaignName}
                    campaignPrompt={campaignPrompt}
                    onPromptChange={setCampaignPrompt}
                    characterConsistency={characterConsistency}
                    />
              </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (step === 'CAMPAIGN_PREVIEW') {
    return (
      <PageTransition>
        {renderStep()}
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className='h-[calc(100vh-var(--header-height))] overflow-x-hidden' style={{ '--header-height': '4rem' } as React.CSSProperties}>
        <SidebarProvider>
          {renderStep()}
        </SidebarProvider>
      </div>
    </PageTransition>
  );
}
