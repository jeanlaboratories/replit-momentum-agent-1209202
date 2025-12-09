import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Folder, Image, Video, Tag, Calendar, User, Sparkles, Upload, Edit, Plus, LayoutGrid, Film, ChevronDown, Eye, EyeOff } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { MediaCollection, MediaSearchFilters, MediaType, MediaSource } from '@/lib/types/media-library';
import type { BrandMember } from '@/lib/types';

interface MediaLibrarySidebarProps {
  collections: MediaCollection[];
  activeFilters: MediaSearchFilters;
  onFilterChange: (filters: MediaSearchFilters) => void;
  onCreateCollection: () => void;
  stats?: {
    total: number;
    images: number;
    videos: number;
    brandSoul: number;
    aiGenerated: number;
    uploads: number;
  };
  users?: BrandMember[];
}

export function MediaLibrarySidebar({
  collections,
  activeFilters,
  onFilterChange,
  onCreateCollection,
  stats,
  users = [],
}: MediaLibrarySidebarProps) {
  const router = useRouter();

  const handleTypeFilter = (type?: MediaType) => {
    onFilterChange({ ...activeFilters, type });
  };

  const handleSourceFilter = (source?: MediaSource) => {
    if (activeFilters.source === source) {
      // Toggle off if already active
      const { source: _, ...rest } = activeFilters;
      onFilterChange(rest);
    } else {
      onFilterChange({ ...activeFilters, source });
    }
  };

  const handleCollectionFilter = (collectionId: string) => {
    const currentCollections = activeFilters.collections || [];
    const isActive = currentCollections.includes(collectionId);
    
    onFilterChange({
      ...activeFilters,
      collections: isActive
        ? currentCollections.filter(id => id !== collectionId)
        : [...currentCollections, collectionId],
    });
  };

  const handleUserFilter = (userId?: string) => {
    if (activeFilters.createdBy === userId) {
      const { createdBy: _, ...rest } = activeFilters;
      onFilterChange(rest);
    } else {
      onFilterChange({ ...activeFilters, createdBy: userId });
    }
  };

  const handleVisibilityFilter = (isPublished?: boolean) => {
    if (activeFilters.isPublished === isPublished) {
      const { isPublished: _, ...rest } = activeFilters;
      onFilterChange(rest);
    } else {
      onFilterChange({ ...activeFilters, isPublished });
    }
  };

  const handleDateFilter = (range?: { start: string; end: string }) => {
    // Check if range matches current filter to toggle off
    const currentStart = activeFilters.dateRange?.start;
    const currentEnd = activeFilters.dateRange?.end;

    if (range && currentStart === range.start && currentEnd === range.end) {
      const { dateRange: _, ...rest } = activeFilters;
      onFilterChange(rest);
    } else {
      onFilterChange({ ...activeFilters, dateRange: range });
    }
  };

  const isTypeActive = (type?: MediaType) => {
    return activeFilters.type === type;
  };

  const isSourceActive = (source?: MediaSource) => {
    return activeFilters.source === source;
  };

  const isCollectionActive = (collectionId: string) => {
    return activeFilters.collections?.includes(collectionId) || false;
  };

  const isUserActive = (userId: string) => {
    return activeFilters.createdBy === userId;
  };

  const isDateRangeActive = (start?: string, end?: string) => {
    if (!start && !end) return !activeFilters.dateRange;
    return activeFilters.dateRange?.start === start && activeFilters.dateRange?.end === end;
  };

  const isVisibilityActive = (isPublished?: boolean) => {
    return activeFilters.isPublished === isPublished;
  };

  // Date presets
  const today = new Date();
  const last7Days = new Date(today);
  last7Days.setDate(today.getDate() - 7);
  const last30Days = new Date(today);
  last30Days.setDate(today.getDate() - 30);

  return (
    <Sidebar>
      <SidebarContent>
        {/* Library Quick Filters */}
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Library
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleTypeFilter(undefined)}
                      isActive={!activeFilters.type}
                    >
                      <Folder className="h-4 w-4" />
                      <span>All Media</span>
                      {stats?.total !== undefined && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {stats.total.toLocaleString()}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleTypeFilter('image')}
                      isActive={isTypeActive('image')}
                    >
                      <Image className="h-4 w-4" />
                      <span>Images</span>
                      {stats?.images !== undefined && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {stats.images.toLocaleString()}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleTypeFilter('video')}
                      isActive={isTypeActive('video')}
                    >
                      <Video className="h-4 w-4" />
                      <span>Videos</span>
                      {stats?.videos !== undefined && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {stats.videos.toLocaleString()}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Visibility Filters */}
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Visibility
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleVisibilityFilter(undefined)}
                      isActive={isVisibilityActive(undefined)}
                    >
                      <Eye className="h-4 w-4" />
                      <span>All</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleVisibilityFilter(true)}
                      isActive={isVisibilityActive(true)}
                    >
                      <Eye className="h-4 w-4" />
                      <span>Published</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleVisibilityFilter(false)}
                      isActive={isVisibilityActive(false)}
                    >
                      <EyeOff className="h-4 w-4" />
                      <span>Private</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Collections */}
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Collections
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {collections.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No collections yet
                    </div>
                  ) : (
                    collections.map((collection) => (
                      <SidebarMenuItem key={collection.id}>
                        <SidebarMenuButton
                          onClick={() => handleCollectionFilter(collection.id)}
                          isActive={isCollectionActive(collection.id)}
                        >
                          <Folder className="h-4 w-4" />
                          <span>{collection.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {collection.mediaCount}
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))
                  )}

                  <SidebarMenuItem>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={onCreateCollection}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Collection
                    </Button>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Source Filters */}
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Source
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleSourceFilter('ai-generated')}
                      isActive={isSourceActive('ai-generated')}
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>AI Generated</span>
                      {stats?.aiGenerated !== undefined && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {stats.aiGenerated.toLocaleString()}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleSourceFilter('brand-soul')}
                      isActive={isSourceActive('brand-soul')}
                    >
                      <Tag className="h-4 w-4" />
                      <span>Brand Soul</span>
                      {stats?.brandSoul !== undefined && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {stats.brandSoul.toLocaleString()}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleSourceFilter('upload')}
                      isActive={isSourceActive('upload')}
                    >
                      <Upload className="h-4 w-4" />
                      <span>Uploads</span>
                      {stats?.uploads !== undefined && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {stats.uploads.toLocaleString()}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleSourceFilter('edited')}
                      isActive={isSourceActive('edited')}
                    >
                      <Edit className="h-4 w-4" />
                      <span>Edited</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Date Filters */}
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Date
                <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleDateFilter(undefined)}
                      isActive={isDateRangeActive(undefined, undefined)}
                    >
                      <Calendar className="h-4 w-4" />
                      <span>All Time</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleDateFilter({ start: last7Days.toISOString(), end: today.toISOString() })}
                      isActive={isDateRangeActive(last7Days.toISOString(), today.toISOString())}
                    >
                      <Calendar className="h-4 w-4" />
                      <span>Last 7 Days</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleDateFilter({ start: last30Days.toISOString(), end: today.toISOString() })}
                      isActive={isDateRangeActive(last30Days.toISOString(), today.toISOString())}
                    >
                      <Calendar className="h-4 w-4" />
                      <span>Last 30 Days</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Team Filters */}
        {users.length > 0 && (
          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger>
                  Team
                  <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {users.map((user) => (
                      <SidebarMenuItem key={user.userId}>
                        <SidebarMenuButton
                          onClick={() => handleUserFilter(user.userId)}
                          isActive={isUserActive(user.userId)}
                        >
                          <User className="h-4 w-4" />
                          <span>{user.userDisplayName || user.userEmail}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* Apps / Galleries */}
        <SidebarGroup>
          <SidebarGroupLabel>Apps</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => router.push('/images')}>
                  <LayoutGrid className="h-4 w-4" />
                  <span>Image Gallery</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => router.push('/videos')}>
                  <Film className="h-4 w-4" />
                  <span>Video Gallery</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
