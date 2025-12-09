



'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
import {
  GlassCard,
  GlassCardContent,
  GlassCardDescription,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardFooter,
} from '@/components/ui/glass-card';
import {
  loadCampaignsAction,
  loadCampaignAction,
  deleteCampaignAction,
  generateCampaignContentAction,
  getUserDisplayNamesAction,
} from '@/app/actions';
import {useToast} from '@/hooks/use-toast';
import {Loader2, Plus, Sparkles, Trash2, Upload, AlertTriangle, Image as ImageIcon, Video as VideoIcon, Calendar, Edit, PanelLeft, FilePlus, TextQuote, MoreVertical, ChevronLeft, ChevronRight, X} from 'lucide-react';
import ContentBlockEditor from './content-block-editor';
import type {
  CampaignTimeline,
  ContentBlock,
  GeneratedCampaignContent,
  BrandProfile,
  CampaignDay,
} from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {formatDistanceToNow} from 'date-fns';
import { CampaignCalendarView } from './campaign-calendar-view';
import { ScrollArea } from './ui/scroll-area';
import { SidebarTrigger } from './ui/sidebar';
import { Input } from './ui/input';
import { useAuth } from '@/hooks/use-auth';
import { isTodayOrFuture, generateId } from '@/lib/utils';
import { TimezoneSelector } from './timezone-selector';
import { useTimezone } from '@/contexts/TimezoneContext';
import { parseISODateInTimezone } from '@/lib/timezone-utils';
import { useJobQueue } from '@/contexts/job-queue-context';

interface CampaignTimelineEditorProps {
  brandId: string;
  brandProfile: BrandProfile;
  campaignTimeline: CampaignTimeline;
  setCampaignTimeline: React.Dispatch<React.SetStateAction<CampaignTimeline>>;
  onCampaignGenerated: (content: GeneratedCampaignContent) => void;
  onCampaignLoaded: (
    campaignTimeline: CampaignTimeline,
    generatedContent: GeneratedCampaignContent,
    campaignId: string,
    campaignName: string,
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
  ) => void;
  onNewCampaign: () => void;
  view: 'calendar' | 'day';
  setView: (view: 'calendar' | 'day') => void;
  selectedDate: Date | undefined;
  setSelectedDate: (date: Date | undefined) => void;
  selectedDay: CampaignDay | null;
  loadedCampaignId: string | null;
  onEditCampaign: () => void;
  campaignName: string;
  setCampaignName: (name: string) => void;
  onDayCreate: (date: Date) => void;
  onDaysCreate: (dates: Date[]) => void;
  onDayRemove: (date: Date) => void;
  onEnterDayView: (date: Date) => void;
  campaignUpdatedAt?: string | null;
  campaignUpdatedBy?: string | null;
}


type SavedCampaign = { 
  id: string; 
  name: string; 
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export default function CampaignTimelineEditor({
  brandId,
  brandProfile,
  campaignTimeline,
  setCampaignTimeline,
  onCampaignGenerated,
  onCampaignLoaded,
  onNewCampaign,
  view,
  setView,
  selectedDate,
  setSelectedDate,
  selectedDay,
  loadedCampaignId,
  onEditCampaign,
  campaignName,
  setCampaignName,
  onDayCreate,
  onDaysCreate,
  onDayRemove,
  onEnterDayView,
  campaignUpdatedAt,
  campaignUpdatedBy,
}: CampaignTimelineEditorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const {toast} = useToast();
  const { timezone } = useTimezone();
  const { addJob, startJob, setProgress, completeJob, failJob } = useJobQueue();
  const [isLoadCampaignOpen, setIsLoadCampaignOpen] = useState(false);
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [savedCampaigns, setSavedCampaigns] = useState<SavedCampaign[]>([]);
  const [isCampaignLoading, setIsCampaignLoading] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<SavedCampaign | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userDisplayNames, setUserDisplayNames] = useState<{ [userId: string]: string }>({});
  const contentEndRef = useRef<HTMLDivElement>(null);

  // Fetch display name for campaignUpdatedBy user
  useEffect(() => {
    const fetchUpdatedByName = async () => {
      if (campaignUpdatedBy && !userDisplayNames[campaignUpdatedBy]) {
        const displayNames = await getUserDisplayNamesAction([campaignUpdatedBy]);
        setUserDisplayNames(prev => ({ ...prev, ...displayNames }));
      }
    };
    
    fetchUpdatedByName();
  }, [campaignUpdatedBy]);

  // Navigation helpers
  const getCurrentDayIndex = () => {
    if (!selectedDay) return -1;
    return campaignTimeline.findIndex(d => d.id === selectedDay.id);
  };

  const navigateToDay = (dayIndex: number) => {
    if (dayIndex < 0 || dayIndex >= campaignTimeline.length) return;

    const targetDay = campaignTimeline[dayIndex];

    // Use timezone-aware date parsing to match how page.tsx finds days
    // This ensures the date is interpreted correctly in the user's timezone
    const targetDate = parseISODateInTimezone(targetDay.date, timezone);

    setSelectedDate(targetDate);
  };

  const navigateToPreviousDay = () => {
    const currentIndex = getCurrentDayIndex();
    // Navigate to the previous day in the timeline (regardless of past/future)
    if (currentIndex > 0) {
      navigateToDay(currentIndex - 1);
    }
  };

  const navigateToNextDay = () => {
    const currentIndex = getCurrentDayIndex();
    // Navigate to the next day in the timeline (regardless of past/future)
    if (currentIndex < campaignTimeline.length - 1) {
      navigateToDay(currentIndex + 1);
    }
  };

  // Date selection handler for single-day selection
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
  };

  // Remove day function
  const removeDay = () => {
    if (!selectedDay || !selectedDate) return;
    
    // Only allow removing days without content blocks
    if (selectedDay.contentBlocks.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Cannot Remove Day',
        description: 'You can only remove days that have no content blocks.',
      });
      return;
    }

    const currentIndex = getCurrentDayIndex();
    
    // Before filtering, save the date of the target day we'll navigate to
    let targetDate: Date | undefined;
    
    if (campaignTimeline.length === 1) {
      // Only one day - return to calendar
      targetDate = undefined;
    } else if (currentIndex > 0) {
      // Navigate to previous day using its persisted date
      const prevDay = campaignTimeline[currentIndex - 1];
      targetDate = new Date(prevDay.date);
    } else if (currentIndex === 0 && campaignTimeline.length > 1) {
      // Removing first day - navigate to next day using its persisted date
      const nextDay = campaignTimeline[1];
      targetDate = new Date(nextDay.date);
    }
    
    // Remove the day and renumber remaining days to be consecutive
    // Preserve the date field during renumbering so date gaps are maintained
    const updatedTimeline = campaignTimeline
      .filter(d => d.id !== selectedDay.id)
      .map((day, index) => ({
        ...day,
        day: index + 1, // Renumber to be consecutive (1, 2, 3...)
        id: `day-${index + 1}`, // Update ID to match new day number
        date: day.date, // Preserve the original date - this maintains date gaps!
      }));
    
    setCampaignTimeline(updatedTimeline);
    
    // Navigate after removal
    if (!targetDate) {
      setView('calendar');
      setSelectedDate(undefined);
    } else {
      setSelectedDate(targetDate);
    }
    
    toast({
      title: 'Day Removed',
      description: 'The empty day has been removed and remaining days have been renumbered.',
    });
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle navigation in day view
      if (view !== 'day') return;
      
      // Don't trigger if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateToPreviousDay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateToNextDay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, selectedDay, campaignTimeline]);

  // Auto-scroll to bottom when new content block is added
  useEffect(() => {
    if (selectedDay?.contentBlocks.length) {
      contentEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedDay?.contentBlocks.length]);

  const handleGenerateCampaign = async () => {
    const nonEmptyDays = campaignTimeline.filter(day => day.contentBlocks.length > 0);
    if (nonEmptyDays.length === 0) {
      toast({
        variant: "destructive",
        title: "Empty Event",
        description: "Please add at least one content block to a day before generating.",
      });
      return;
    }
   if (!brandProfile?.summary) {
      toast({
        variant: 'destructive',
        title: 'Missing Team Summary',
        description: 'A team summary is required to generate content. Please visit the Team Profile page and ensure a summary has been generated.'
      });
      return;
    }

    setIsLoading(true);
    const result = await generateCampaignContentAction(
      brandId,
      brandProfile.summary,
      nonEmptyDays
    );
    setIsLoading(false);

    if (result.error || !result.generatedContent) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.message,
      });
    } else {
      onCampaignGenerated(result.generatedContent);
      toast({
        title: 'Success',
        description: 'Event content generated successfully!',
      });
    }
  };

  const handleOpenLoadDialog = async () => {
    if (!brandId) return;
    setIsLoading(true);
    const result = await loadCampaignsAction(brandId);
    setIsLoading(false);
    if (result.error || !result.campaigns) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.message,
      });
    } else {
      setSavedCampaigns(result.campaigns);
      
      // Extract all unique user IDs from campaigns
      const userIds = new Set<string>();
      result.campaigns.forEach(campaign => {
        if (campaign.createdBy) userIds.add(campaign.createdBy);
        if (campaign.updatedBy) userIds.add(campaign.updatedBy);
      });
      
      // Fetch display names for all users
      if (userIds.size > 0) {
        const displayNames = await getUserDisplayNamesAction(Array.from(userIds));
        setUserDisplayNames(displayNames);
      }
      
      setIsLoadCampaignOpen(true);
    }
  };

  const handleLoadCampaign = async (campaignId: string) => {
    setIsCampaignLoading(true);
    const result = await loadCampaignAction(campaignId);
    setIsCampaignLoading(false);

    if (result.error || !result.campaignContent || !result.campaignName) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.message,
      });
    } else {
        // Calculate default start date for loaded campaigns (only used if date is not persisted)
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        
        const loadedTimeline: CampaignTimeline = result.campaignContent.map((day) => {
            // Use persisted date if it exists, otherwise calculate from day number
            let dayDate: Date;
            if (day.date) {
                // Use the persisted date to maintain day gaps
                dayDate = new Date(day.date);
            } else {
                // Fallback for old campaigns without date field (backward compatibility)
                dayDate = new Date(startDate);
                dayDate.setDate(dayDate.getDate() + (day.day - 1));
            }
            
            return {
                id: `day-${day.day}`,
                day: day.day,
                date: dayDate.toISOString(),
                contentBlocks: (day.contentBlocks || []).map(block => ({
                    id: block.id || generateId(), // FIXED: Preserve original content block ID
                    contentType: block.contentType as ContentBlock['contentType'],
                    keyMessage: block.keyMessage || '',
                    toneOfVoice: (block.toneOfVoice as ContentBlock['toneOfVoice']) || 'Professional',
                    assetUrl: (block as any).assetUrl,
                    imageUrl: block.imageUrl, // Fix: Use imageUrl from the loaded data
                    scheduledTime: block.scheduledTime,
                    adCopy: block.adCopy,
                }))
            };
        });

      onCampaignLoaded(loadedTimeline, result.campaignContent, campaignId, result.campaignName, {
        updatedAt: result.updatedAt,
        updatedBy: result.updatedBy,
        createdAt: result.createdAt,
        createdBy: result.createdBy,
        originalPrompt: result.originalPrompt,
        characterConsistency: result.characterConsistency,
      });
      toast({
        title: 'Event Loaded',
        description: 'Your saved event has been loaded from Firebase.',
      });
      setIsLoadCampaignOpen(false);
    }
  };
  
  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;

    // Create job for deletion tracking
    const jobId = addJob({
      type: 'event-deletion',
      title: `Deleting: ${campaignToDelete.name}`,
      description: 'Removing event and associated data',
    });

    setIsDeleting(true);
    startJob(jobId);
    setProgress(jobId, 30);

    const result = await deleteCampaignAction(campaignToDelete.id);

    setProgress(jobId, 80);
    setIsDeleting(false);

    if (!result.success) {
      failJob(jobId, result.message || 'Failed to delete event');
      toast({
        variant: 'destructive',
        title: 'Error Deleting Event',
        description: result.message,
      });
    } else {
      setProgress(jobId, 100);
      completeJob(jobId);
      toast({
        title: 'Event Deleted',
        description: result.message,
      });
      setSavedCampaigns(prev => prev.filter(c => c.id !== campaignToDelete.id));
    }
    setCampaignToDelete(null);
  };
  
  const DayEditor = () => {
    if (!selectedDay || !selectedDate) return null;
    
    // Use selectedDate as the base for all date calculations
    const dayDate = new Date(selectedDate);
    
    const currentIndex = getCurrentDayIndex();
    
    // Check if there's a previous/next day that is today or in the future
    const findPreviousFutureDay = () => {
      for (let i = currentIndex - 1; i >= 0; i--) {
        const day = campaignTimeline[i];
        const dayDate = new Date(day.date);
        // Normalize to local midnight for consistent comparison
        dayDate.setHours(0, 0, 0, 0);
        
        if (isTodayOrFuture(dayDate)) {
          return day;
        }
      }
      return null;
    };
    
    const findNextFutureDay = () => {
      for (let i = currentIndex + 1; i < campaignTimeline.length; i++) {
        const day = campaignTimeline[i];
        const dayDate = new Date(day.date);
        // Normalize to local midnight for consistent comparison
        dayDate.setHours(0, 0, 0, 0);
        
        if (isTodayOrFuture(dayDate)) {
          return day;
        }
      }
      return null;
    };
    
    const hasPrevious = findPreviousFutureDay() !== null;
    const hasNext = findNextFutureDay() !== null;
    
    const getPreviousDay = () => findPreviousFutureDay();
    const getNextDay = () => findNextFutureDay();
    
    const formatShortDate = (day: CampaignDay) => {
      // Use the actual date field from the campaign day
      const date = new Date(day.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
      <GlassCard className='h-full flex flex-col border-0 shadow-none rounded-none bg-transparent' gradient={false}>
        <GlassCardHeader className='pb-4 bg-background/60 backdrop-blur-md border-b sticky top-0 z-20'>
                <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
                      {/* Previous Day Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={navigateToPreviousDay}
                        disabled={!hasPrevious}
                        className="flex-shrink-0 hidden sm:flex items-center gap-2 hover:bg-accent transition-colors"
                        title={hasPrevious ? `Go to Day ${getPreviousDay()?.day} (Arrow Left)` : 'No previous day'}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        {hasPrevious && (
                  <span className="text-xs font-medium">
                            Day {getPreviousDay()?.day}
                    <span className="ml-1.5 text-muted-foreground font-normal">{formatShortDate(getPreviousDay()!)}</span>
                          </span>
                        )}
                      </Button>
                      
                      {/* Mobile Previous Button */}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={navigateToPreviousDay}
                        disabled={!hasPrevious}
                        className="flex-shrink-0 sm:hidden"
                        title={hasPrevious ? `Go to Day ${getPreviousDay()?.day}` : 'No previous day'}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      {/* Current Day Title */}
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <GlassCardTitle className="font-headline text-xl sm:text-2xl font-bold tracking-tight text-foreground">Editing Day {selectedDay.day}</GlassCardTitle>
                <GlassCardDescription className="truncate text-sm sm:text-base font-medium text-muted-foreground">{dayDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</GlassCardDescription>
                      </div>
                      
                      {/* Next Day Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={navigateToNextDay}
                        disabled={!hasNext}
                        className="flex-shrink-0 hidden sm:flex items-center gap-2 hover:bg-accent transition-colors"
                        title={hasNext ? `Go to Day ${getNextDay()?.day} (Arrow Right)` : 'No next day'}
                      >
                        {hasNext && (
                  <span className="text-xs font-medium">
                            Day {getNextDay()?.day}
                    <span className="ml-1.5 text-muted-foreground font-normal">{formatShortDate(getNextDay()!)}</span>
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      
                      {/* Mobile Next Button */}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={navigateToNextDay}
                        disabled={!hasNext}
                        className="flex-shrink-0 sm:hidden"
                        title={hasNext ? `Go to Day ${getNextDay()?.day}` : 'No next day'}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Remove Day Button - Only show if day has no content blocks */}
                    {selectedDay.contentBlocks.length === 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={removeDay}
                        className="flex-shrink-0"
                        title="Remove this empty day"
                      >
                        <Trash2 className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Remove Day</span>
                      </Button>
                    )}
                </div>
        </GlassCardHeader>
        <GlassCardContent className="flex-grow overflow-hidden p-0 bg-muted/30">
                <ScrollArea className="h-full">
            <div className="grid gap-6 p-6 grid-cols-1 xl:grid-cols-2">
                        {selectedDay.contentBlocks.length === 0 && (
                            <div className="text-muted-foreground text-center py-8 col-span-full">
                                No content blocks for this day yet.
                            </div>
                        )}
                        {selectedDay.contentBlocks.map(block => (
                        <ContentBlockEditor
                            key={block.id}
                            day={selectedDay}
                            block={block}
                            setCampaignTimeline={setCampaignTimeline}
                        />
                        ))}
                    </div>
            <div ref={contentEndRef} />
                </ScrollArea>
                
          {/* Floating Action Button for Adding Content Block */}
          <div className="absolute bottom-6 left-6 z-30">
            <Button
              onClick={() => {
                const newContentBlock: ContentBlock = {
                  id: generateId(),
                  contentType: 'Social Media Post',
                  keyMessage: '',
                  toneOfVoice: 'Professional',
                };
                setCampaignTimeline(prev => prev.map(d => {
                  if (d.id === selectedDay.id) {
                    return { ...d, contentBlocks: [...d.contentBlocks, newContentBlock] }
                  }
                  return d;
                }))
              }}
              size="lg"
              className="rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-primary hover:bg-primary/90 text-primary-foreground h-14 w-14 p-0"
              title="Add Content Block"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  };

  const handlePrimaryAction = () => {
    if (loadedCampaignId || campaignTimeline.length > 0) {
      onEditCampaign();
    } else {
      handleGenerateCampaign();
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent min-w-0 overflow-x-hidden">
         <header className="flex-shrink-0 flex flex-wrap items-center justify-between p-2 sm:p-4 border-b bg-background min-w-0 gap-2">
            {/* Event name and info - full width on mobile, auto on larger screens */}
            <div className='flex items-center gap-2 flex-shrink-0 w-full sm:w-auto min-w-0'>
                <SidebarTrigger className="flex-shrink-0" />
                <div className="relative flex-1 sm:flex-initial sm:w-64 md:w-80 lg:w-96 xl:w-[420px] min-w-0">
                  <TextQuote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input 
                      id="campaignName"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="My Awesome Event"
                      className="pl-10 font-medium text-sm sm:text-base w-full"
                  />
                </div>
                {campaignUpdatedBy && campaignUpdatedAt && (
                    <div className="text-xs text-muted-foreground hidden xl:block whitespace-nowrap flex-shrink-0">
                        Last saved by{' '}
                        <Link 
                          href={`/brand-profile/personal?userId=${campaignUpdatedBy}`}
                          className="text-primary hover:underline"
                        >
                          {userDisplayNames[campaignUpdatedBy] || 'Loading...'}
                        </Link>
                        {' '}at {new Date(campaignUpdatedAt).toLocaleString()}
                    </div>
                )}
            </div>
            
            {/* View controls - wrap to new line on mobile if needed */}
            <div className='flex items-center gap-1.5 sm:gap-2 flex-shrink-0'>
                <Button 
                  variant={view === 'calendar' ? 'secondary' : 'ghost'} 
                  size="sm"
                  onClick={() => setView('calendar')}
                  className="h-9"
                >
                  <Calendar className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Calendar</span>
                </Button>
                <Button 
                  variant={view === 'day' ? 'secondary' : 'ghost'} 
                  size="sm"
                  onClick={() => setView('day')} 
                  disabled={!selectedDay}
                  className="h-9"
                >
                  <Edit className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Day</span>
                </Button>
                <div className="hidden xl:block flex-shrink-0">
                  <TimezoneSelector />
                </div>
            </div>
            
            {/* Action buttons - always on right side */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                 <Button
                    onClick={() => setIsNewCampaignOpen(true)}
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    className="hidden md:flex h-9"
                    >
                    <FilePlus className="mr-2 h-4 w-4" />
                    New
                </Button>
                 <Button
                  onClick={handleOpenLoadDialog}
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  className="hidden md:flex h-9"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Load
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={isLoading}
                      className="md:hidden h-9 w-9 p-0"
                      aria-label="More options"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsNewCampaignOpen(true)}>
                      <FilePlus className="mr-2 h-4 w-4" />
                      New Event
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleOpenLoadDialog}>
                      <Upload className="mr-2 h-4 w-4" />
                      Load Event
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                    size="sm"
                    onClick={handlePrimaryAction}
                    disabled={isLoading || (campaignTimeline.length === 0 && !loadedCampaignId)}
                >
                    {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (loadedCampaignId || campaignTimeline.length > 0) ? (
                      <>
                        <Edit className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">View/Edit</span>
                        <span className="sm:hidden">Edit</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">Generate</span>
                        <span className="sm:hidden">Gen</span>
                      </>
                    )}
                </Button>
             </div>
        </header>



        <main className="flex-grow overflow-hidden flex min-w-0 flex-col">
            <div className="overflow-hidden min-w-0 flex-grow">
              {view === 'calendar' ? (
                  <CampaignCalendarView 
                      campaignTimeline={campaignTimeline} 
                      selectedDate={selectedDate} 
                      onDateSelect={handleDateSelect}
                      onDayCreate={onDayCreate}
              onDaysCreate={onDaysCreate}
              onDayRemove={onDayRemove}
              onEnterDayView={onEnterDayView}
                  />
              ) : (
                  <DayEditor />
              )}
            </div>
        </main>

      <Dialog open={isLoadCampaignOpen} onOpenChange={setIsLoadCampaignOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Load Saved Event</DialogTitle>
            <DialogDescription>
              Select a previously saved event to load it into the editor.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Edited</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {savedCampaigns.map(campaign => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">
                      {campaign.name}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">
                          {formatDistanceToNow(new Date(campaign.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                        {campaign.createdBy && (
                          <Link 
                            href={`/brand-profile/personal?userId=${campaign.createdBy}`}
                            className="text-xs text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            by {userDisplayNames[campaign.createdBy] || 'Loading...'}
                          </Link>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {campaign.updatedAt ? (
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">
                            {formatDistanceToNow(new Date(campaign.updatedAt), {
                              addSuffix: true,
                            })}
                          </span>
                          {campaign.updatedBy && (
                            <Link 
                              href={`/brand-profile/personal?userId=${campaign.updatedBy}`}
                              className="text-xs text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              by {userDisplayNames[campaign.updatedBy] || 'Loading...'}
                            </Link>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No edits</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLoadCampaign(campaign.id)}
                        disabled={isCampaignLoading || isDeleting}
                      >
                        {isCampaignLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          'Load'
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setCampaignToDelete(campaign)}
                        disabled={isCampaignLoading || isDeleting}
                      >
                         <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!campaignToDelete} onOpenChange={(open) => !open && setCampaignToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>
                <AlertTriangle className="inline-block mr-2 text-destructive" />
                Are you sure?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the campaign &quot;{campaignToDelete?.name}&quot; and all of its associated data and media from the servers.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteCampaign} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Yes, delete campaign
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isNewCampaignOpen} onOpenChange={setIsNewCampaignOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>
                    <AlertTriangle className="inline-block mr-2 text-destructive" />
                    Start a New Campaign?
                </AlertDialogTitle>
                <AlertDialogDescription>
                    This will clear the current calendar and any unsaved changes will be lost. Are you sure you want to continue?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => { onNewCampaign(); setIsNewCampaignOpen(false); }}>
                    Yes, Start New Campaign
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
