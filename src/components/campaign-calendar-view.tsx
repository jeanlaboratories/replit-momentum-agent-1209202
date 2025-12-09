'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { CampaignTimeline } from "@/lib/types";
import { Badge } from "./ui/badge";
import { useTimezone } from "@/contexts/TimezoneContext";
import { 
  formatDateInTimezone, 
  parseISODateInTimezone, 
  todayInTimezone,
  isBeforeTodayInTimezone,
  isTodayInTimezone
} from "@/lib/timezone-utils";
import { Calendar as CalendarIcon, Loader2, Plus, Trash2, Image as ImageIcon } from "lucide-react";

interface CampaignCalendarViewProps {
    campaignTimeline: CampaignTimeline;
    selectedDate: Date | undefined;
    onDateSelect: (date: Date | undefined) => void;
    onDayCreate: (date: Date) => void;
    onDaysCreate: (dates: Date[]) => void;
    onDayRemove: (date: Date) => void;
    onEnterDayView: (date: Date) => void;
}

interface DayMetadata {
    isToday: boolean;
    isSelected: boolean;
    isCampaignDay: boolean;
    isPastCampaignDay: boolean;
    sequenceNumber: number | null;
    postCount: number;
    dayId: string | null;
    imageUrl?: string;
}

// This will be replaced by timezone-aware utilities - keeping for now to avoid breaking changes during migration

export function CampaignCalendarView({ 
    campaignTimeline, 
    selectedDate, 
    onDateSelect,
    onDayCreate,
    onDaysCreate,
    onDayRemove,
    onEnterDayView
}: CampaignCalendarViewProps) {
    // Use timezone context
    const { timezone } = useTimezone();
    
    // Click detection refs for distinguishing single vs double-click
    const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastClickDateRef = useRef<string | null>(null);
    
    // Drag selection state
    const [dragStart, setDragStart] = useState<Date | null>(null);
    const [dragEnd, setDragEnd] = useState<Date | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // State to track pending campaign generation
    const [pendingCampaign, setPendingCampaign] = useState<{
        startDate: string;
        duration: number;
        timestamp: number;
    } | null>(null);
    
    // Check for pending campaign on mount and periodically
    // Uses localStorage for persistence across page refreshes during long generation
    useEffect(() => {
        const checkPendingCampaign = () => {
            if (typeof window !== 'undefined') {
                // Check localStorage first (persists across refresh), then sessionStorage (legacy)
                const pending = localStorage.getItem('pendingCampaign') || sessionStorage.getItem('pendingCampaign');
                if (pending) {
                    try {
                        const data = JSON.parse(pending);

                        // Check if pending campaign is stale (older than 15 minutes for large campaigns)
                        const STALE_TIMEOUT = 900000; // 15 minutes in milliseconds
                        const now = Date.now();
                        const age = now - data.timestamp;

                        if (age > STALE_TIMEOUT) {
                            // Clear stale pending campaign
                            console.warn('Clearing stale pending campaign:', { age, timeout: STALE_TIMEOUT });
                            localStorage.removeItem('pendingCampaign');
                            sessionStorage.removeItem('pendingCampaign');
                            setPendingCampaign(null);
                        } else {
                            setPendingCampaign(data);
                        }
                    } catch (e) {
                        console.error('Failed to parse pending campaign data:', e);
                        localStorage.removeItem('pendingCampaign');
                        sessionStorage.removeItem('pendingCampaign');
                        setPendingCampaign(null);
                    }
                } else {
                    // Clear pending state if storage is cleared
                    setPendingCampaign(null);
                }
            }
        };

        // Check immediately
        checkPendingCampaign();

        // Check every 500ms to catch changes
        const interval = setInterval(checkPendingCampaign, 500);

        return () => clearInterval(interval);
    }, []);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input/textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (!selectedDate) return;

            const newDate = new Date(selectedDate);
            let changed = false;

            switch (e.key) {
                case 'ArrowLeft':
                    newDate.setDate(newDate.getDate() - 1);
                    changed = true;
                    break;
                case 'ArrowRight':
                    newDate.setDate(newDate.getDate() + 1);
                    changed = true;
                    break;
                case 'ArrowUp':
                    newDate.setDate(newDate.getDate() - 7);
                    changed = true;
                    break;
                case 'ArrowDown':
                    newDate.setDate(newDate.getDate() + 7);
                    changed = true;
                    break;
                case 'Enter':
                    onEnterDayView(selectedDate);
                    break;
                case ' ':
                    // Space bar to add event
                    onDayCreate(selectedDate);
                    e.preventDefault(); // Prevent scrolling
                    break;
            }

            if (changed) {
                onDateSelect(newDate);
                e.preventDefault(); // Prevent scrolling
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedDate, onDateSelect, onEnterDayView, onDayCreate]);

    // Check if a date is within the pending campaign range (timezone-aware)
    const isPendingCampaignDay = (date: Date): boolean => {
        if (!pendingCampaign) return false;
        
        const startDate = parseISODateInTimezone(pendingCampaign.startDate, timezone);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + pendingCampaign.duration - 1);
        
        const dateStr = formatDateInTimezone(date, timezone);
        const startStr = formatDateInTimezone(startDate, timezone);
        const endStr = formatDateInTimezone(endDate, timezone);
        
        return dateStr >= startStr && dateStr <= endStr;
    };

    // Check if a date is within the current drag selection range
    const isDragSelected = (date: Date): boolean => {
        if (!dragStart || !dragEnd) return false;
        const dateStr = formatDateInTimezone(date, timezone);
        const startStr = formatDateInTimezone(dragStart < dragEnd ? dragStart : dragEnd, timezone);
        const endStr = formatDateInTimezone(dragStart < dragEnd ? dragEnd : dragStart, timezone);
        return dateStr >= startStr && dateStr <= endStr;
    };

    // Create a memoized metadata map for all dates (timezone-aware)
    const dayMetadataMap = useMemo(() => {
        const map = new Map<string, DayMetadata>();
        const today = todayInTimezone(timezone);
        const todayStr = formatDateInTimezone(today, timezone);
        const selectedDateStr = selectedDate 
            ? formatDateInTimezone(selectedDate, timezone)
            : null;
        
        // Find the earliest day with a date to use as campaign base (for legacy data support)
        let campaignBaseDate: Date | null = null;
        let baseDayNumber = 1;
        
        for (const day of campaignTimeline) {
            if (day.date) {
                const dayDate = parseISODateInTimezone(day.date, timezone);
                if (!campaignBaseDate || day.day < baseDayNumber) {
                    campaignBaseDate = dayDate;
                    baseDayNumber = day.day;
                }
            }
        }
        
        // Fallback: use selectedDate or today if no dates found in campaign
        if (!campaignBaseDate) {
            campaignBaseDate = selectedDate || today;
            baseDayNumber = 1;
        }
        
        campaignTimeline.forEach(day => {
            let dayDate: Date;
            
            if (day.date) {
                // Use explicit date if available - parse in selected timezone
                dayDate = parseISODateInTimezone(day.date, timezone);
            } else {
                // Legacy fallback: calculate relative to campaign base
                dayDate = new Date(campaignBaseDate!);
                const offsetDays = day.day - baseDayNumber;
                dayDate.setDate(dayDate.getDate() + offsetDays);
                console.warn(`Campaign day ${day.day} missing date field, using calculated date ${dayDate.toISOString()}`);
            }
            
            const dayDateStr = formatDateInTimezone(dayDate, timezone);
            
            map.set(dayDateStr, {
                isToday: dayDateStr === todayStr,
                isSelected: dayDateStr === selectedDateStr,
                isCampaignDay: true,
                isPastCampaignDay: isBeforeTodayInTimezone(dayDate, timezone),
                sequenceNumber: day.day,
                postCount: day.contentBlocks.length,
                dayId: day.id,
                imageUrl: day.contentBlocks.find(block => (block.imageUrl && block.imageUrl.length > 0) || (block.assetUrl && block.assetUrl.length > 0))?.imageUrl || day.contentBlocks.find(block => (block.imageUrl && block.imageUrl.length > 0) || (block.assetUrl && block.assetUrl.length > 0))?.assetUrl,
            });
        });
        
        return map;
    }, [campaignTimeline, selectedDate, timezone]);

    return (
        <Card className="h-full w-full border-0 shadow-none bg-white rounded-none min-w-0">
            <CardContent className="p-0 h-full w-full min-h-0 min-w-0 flex flex-col max-h-[calc(100vh-8rem)] sm:max-h-[calc(100vh-12rem)] overflow-hidden bg-white">
                {/* Banner - shows campaign day count or generation status */}
                <div className="flex items-center justify-between gap-2 py-2 sm:py-3 px-3 sm:px-4 border-b border-gray-200 bg-gray-50 shrink-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        {pendingCampaign ? (
                            <>
                                <Loader2 className="h-4 w-4 text-blue-600 animate-spin flex-shrink-0" />
                                <span className="text-xs sm:text-sm font-medium text-blue-700">
                                    Generating AI event ({pendingCampaign.duration} day{pendingCampaign.duration === 1 ? '' : 's'})...
                                </span>
                                <span className="text-xs text-blue-600 hidden md:inline">
                                    Creating content with AI-powered text and images
                                </span>
                            </>
                        ) : (
                            <>
                                <CalendarIcon className="h-4 w-4 text-teal-600 flex-shrink-0" />
                                <Badge variant="secondary" className="bg-teal-50 text-teal-700 hover:bg-teal-100 font-medium text-xs sm:text-sm">
                                    {campaignTimeline.length} event day{campaignTimeline.length === 1 ? '' : 's'}
                                </Badge>
                            </>
                        )}
                    </div>
                </div>
                
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={onDateSelect}
                    disabled={(date) => isBeforeTodayInTimezone(date, timezone)}
                    numberOfMonths={1}
                    className="p-0 h-full w-full min-w-0"
                    classNames={{
                        root: 'h-full w-full min-w-0 flex flex-col overflow-hidden bg-white',
                        months: 'flex flex-col flex-grow overflow-hidden min-h-0 min-w-0 w-full',
                        month: "flex flex-col h-full w-full min-w-0 overflow-hidden min-h-0",
                        caption: "flex justify-center py-2 sm:py-4 relative items-center shrink-0 min-h-[2.5rem] sm:min-h-[3rem] w-full bg-white",
                        caption_label: "text-base sm:text-xl font-normal text-gray-900",
                        nav: "space-x-1 flex items-center",
                        nav_button_previous: "absolute left-2 sm:left-4 hover:bg-gray-100 rounded-full p-1.5 sm:p-2 transition-colors touch-manipulation",
                        nav_button_next: "absolute right-2 sm:right-4 hover:bg-gray-100 rounded-full p-1.5 sm:p-2 transition-colors touch-manipulation",
                        table: "flex-grow w-full max-w-full min-w-0 grid grid-rows-[auto_1fr] overflow-hidden min-h-0 bg-white",
                        head_row: "grid grid-cols-7 border-b border-gray-200 bg-white shrink-0 min-h-[2rem] sm:min-h-[2.5rem] w-full min-w-0",
                        head_cell: "text-center text-gray-600 text-[10px] sm:text-xs font-medium py-1 sm:py-2 flex items-center justify-center min-w-0 overflow-hidden uppercase tracking-wide",
                        tbody: "grid grid-rows-[repeat(6,minmax(0,1fr))] flex-grow overflow-hidden min-h-0 min-w-0 w-full bg-white",
                        row: "grid grid-cols-7 min-h-0 min-w-0 w-full [&:not(:last-child)]:border-b border-gray-200",
                        cell: "relative border-r border-gray-200 last:border-r-0 p-0 cursor-pointer transition-colors min-h-0 h-full min-w-0 touch-manipulation active:bg-gray-50",
                        day: "w-full h-full p-0.5 sm:p-2 md:p-3 font-normal flex flex-col items-start justify-start text-[10px] sm:text-xs md:text-sm leading-tight min-w-0",
                        day_selected: "",
                        day_today: "",
                        day_outside: "text-gray-400",
                        day_disabled: "text-gray-300 cursor-not-allowed opacity-50",
                    }}
                    components={{
                        DayContent: (props) => {
                            const { date, displayMonth } = props;
                            const dateStr = formatDateInTimezone(date, timezone);
                            const metadata = dayMetadataMap.get(dateStr);
                            
                            const isToday = isTodayInTimezone(date, timezone);
                            const isCampaignDay = metadata?.isCampaignDay || false;
                            const isPastCampaignDay = metadata?.isPastCampaignDay || false;
                            const isSelected = metadata?.isSelected || false;
                            const isPending = isPendingCampaignDay(date);
                            const isDragged = isDragSelected(date);
                            const imageUrl = metadata?.imageUrl;
                            
                            // Determine background color based on campaign day status and selection state
                            let bgColor = '';
                            if (isPending) {
                                bgColor = 'bg-blue-50'; // Light blue for pending generation
                            } else if (isDragged) {
                                bgColor = 'bg-teal-100/50 border-2 border-teal-500'; // Highlight during drag
                            } else if (isCampaignDay) {
                                if (isPastCampaignDay) {
                                    bgColor = 'bg-gray-100'; // Muted gray for past campaign days
                                } else if (isSelected) {
                                    bgColor = 'bg-teal-100'; // Stronger teal for selected campaign days
                                } else {
                                    bgColor = 'bg-teal-50'; // Light teal for future campaign days
                                }
                            }
                            
                            const handleClick = (e: React.MouseEvent) => {
                                // Logic moved to handleMouseUp to ensure it fires
                                e.stopPropagation();
                            };

                            const handleMouseDown = (e: React.MouseEvent) => {
                                if (e.button !== 0) return; // Only left click
                                setDragStart(date);
                                setDragEnd(date);
                                setIsDragging(true);
                                // Removed e.preventDefault() to allow click events
                            };

                            const handleMouseEnter = () => {
                                if (isDragging && dragStart) {
                                    setDragEnd(date);
                                }
                            };

                            const handleMouseUp = () => {
                                if (isDragging && dragStart && dragEnd) {
                                    const isSameDay = formatDateInTimezone(dragStart, timezone) === formatDateInTimezone(dragEnd, timezone);
                                    if (isSameDay) {
                                        // Single click (drag started and ended on same day)
                                        onDateSelect(dragEnd);

                                        const dateStr = formatDateInTimezone(dragEnd, timezone);
                                        const DOUBLE_CLICK_DELAY = 250; // ms

                                        if (lastClickDateRef.current === dateStr && clickTimeoutRef.current) {
                                            // Double-click detected!
                                            clearTimeout(clickTimeoutRef.current);
                                            clickTimeoutRef.current = null;
                                            lastClickDateRef.current = null;
                                            onEnterDayView(dragEnd);
                                        } else {
                                            // First click
                                            if (clickTimeoutRef.current) {
                                                clearTimeout(clickTimeoutRef.current);
                                            }
                                            lastClickDateRef.current = dateStr;
                                            clickTimeoutRef.current = setTimeout(() => {
                                                // Single-click action: create day
                                                onDayCreate(dragEnd);
                                                clickTimeoutRef.current = null;
                                                lastClickDateRef.current = null;
                                            }, DOUBLE_CLICK_DELAY);
                                        }
                                    } else {
                                        // Range selection - bulk create
                                        const start = dragStart < dragEnd ? dragStart : dragEnd;
                                        const end = dragStart < dragEnd ? dragEnd : dragStart;

                                        const datesToCreate: Date[] = [];
                                        const current = new Date(start);
                                        const endStr = formatDateInTimezone(end, timezone);

                                        while (formatDateInTimezone(current, timezone) <= endStr) {
                                            const currentStr = formatDateInTimezone(current, timezone);
                                            const metadata = dayMetadataMap.get(currentStr);
                                            if (!metadata?.isCampaignDay) {
                                                datesToCreate.push(new Date(current));
                                            }
                                            current.setDate(current.getDate() + 1);
                                        }

                                        if (datesToCreate.length > 0) {
                                            onDaysCreate(datesToCreate);
                                        }
                                        onDateSelect(end);
                                    }
                                }
                                setIsDragging(false);
                                setDragStart(null);
                                setDragEnd(null);
                            };

                            const handleQuickAdd = (e: React.MouseEvent) => {
                                e.stopPropagation();
                                onDayCreate?.(date);
                            };

                            const handleQuickRemove = (e: React.MouseEvent) => {
                                e.stopPropagation();
                                onDayRemove?.(date);
                            };

                            return (
                                <div 
                                    role="gridcell"
                                    aria-selected={isSelected}
                                    className={`group w-full h-full flex flex-col justify-between relative ${bgColor} transition-all cursor-pointer hover:bg-gray-50 border-r border-b border-gray-200`}
                                    onClick={handleClick}
                                    onMouseDown={handleMouseDown}
                                    onMouseEnter={handleMouseEnter}
                                    onMouseUp={handleMouseUp}
                                    style={{
                                        minHeight: '4rem',
                                        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                    }} 
                                >
                                    {imageUrl ? (
                                        <div className="absolute inset-0 bg-white/60" />
                                    ) : isCampaignDay && !isPending && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                            <ImageIcon className="w-8 h-8 text-teal-600" />
                                        </div>
                                    )}
                                    
                                    {/* Day number - optimized for mobile */}
                                    <div className="relative z-10 flex items-start justify-start flex-shrink-0 p-1 sm:p-2">
                                        {isToday ? (
                                            <div className="bg-blue-600 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 flex items-center justify-center font-semibold text-[0.65rem] sm:text-xs md:text-sm">
                                                {date.getDate()}
                                            </div>
                                        ) : (
                                                <span className={`font-medium sm:font-normal text-[0.65rem] sm:text-xs md:text-sm leading-none ${isPastCampaignDay ? 'text-gray-400' : 'text-gray-900'} ${date.getMonth() !== displayMonth.getMonth() ? 'opacity-50' : ''}`}>
                                                {date.getDate()}
                                            </span>
                                        )}

                                        {/* Quick Add Button - Visible on hover */}
                                        {!isCampaignDay && !isPastCampaignDay && !isPending && (
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleQuickAdd(e);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.stopPropagation();
                                                        handleQuickAdd(e as any);
                                                    }
                                                }}
                                                className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-teal-100 rounded-full text-teal-600 cursor-pointer"
                                                title="Add event to this day"
                                                aria-label="Add event to this day"
                                            >
                                                <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                                            </div>
                                        )}

                                        {/* Fast Delete Button - Visible on hover for empty campaign days */}
                                        {isCampaignDay && metadata?.postCount === 0 && !isPastCampaignDay && !isPending && (
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleQuickRemove(e);
                                                }}
                                                onMouseDown={(e) => {
                                                    e.stopPropagation(); // Prevent drag start
                                                }}
                                                onMouseUp={(e) => {
                                                    e.stopPropagation(); // Prevent parent onMouseUp
                                                    handleQuickRemove(e as any);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.stopPropagation();
                                                        handleQuickRemove(e as any);
                                                    }
                                                }}
                                                className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-100 rounded-full text-red-600 cursor-pointer relative z-20"
                                                title="Remove empty day"
                                                aria-label="Remove empty day"
                                            >
                                                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Show spinner for pending campaign days */}
                                    {isPending ? (
                                        <div className="absolute inset-0 flex items-center justify-center bg-blue-50/50">
                                            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-blue-500 animate-spin" />
                                        </div>
                                    ) : (
                                        <>
                                            {/* Bottom section - Day number chip and post count - mobile optimized */}
                                                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-end justify-between mt-auto gap-0.5 sm:gap-1 w-full flex-shrink-0 p-1 sm:p-2">
                                                {/* Day sequence chip - bottom left */}
                                                {isCampaignDay && metadata?.sequenceNumber && (
                                                    <div className={`px-1 py-0.5 sm:px-1.5 sm:py-1 rounded text-[0.55rem] sm:text-[0.625rem] md:text-xs font-semibold sm:font-medium leading-none whitespace-nowrap ${
                                                        isPastCampaignDay 
                                                            ? 'bg-gray-200 text-gray-600' 
                                                            : 'bg-teal-500 text-white'
                                                    }`}>
                                                        Day {metadata.sequenceNumber}
                                                    </div>
                                                )}
                                                
                                                {/* Post count badge - bottom right - mobile optimized */}
                                                {metadata?.postCount !== undefined && metadata.postCount > 0 && (
                                                    <div className="bg-blue-500 text-white px-1 py-0.5 sm:px-1.5 sm:py-1 rounded text-[0.55rem] sm:text-[0.625rem] md:text-xs font-semibold sm:font-medium leading-none whitespace-nowrap shadow-sm">
                                                        {metadata.postCount}
                                                        <span className="hidden sm:inline ml-0.5">
                                                            {metadata.postCount === 1 ? 'post' : 'posts'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        },
                    }}
                />
            </CardContent>
        </Card>
    );
}
