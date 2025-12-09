'use client';

import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { UnifiedMedia } from '@/lib/types/media-library';
import { BrandMember } from '@/lib/types';
import { MediaItem } from './media-grid';
import { Loader2 } from 'lucide-react';

interface VirtualMediaGridProps {
  media: UnifiedMedia[];
  selectedIds: Set<string>;
  onSelectMedia: (id: string) => void;
  onMediaClick: (media: UnifiedMedia) => void;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isFetchingNextPage?: boolean;
  brandMembers?: BrandMember[];
}

export function VirtualMediaGrid({
  media,
  selectedIds,
  onSelectMedia,
  onMediaClick,
  isLoading,
  hasMore,
  onLoadMore,
  isFetchingNextPage,
  brandMembers,
}: VirtualMediaGridProps) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  
  // Responsive columns calculation
  const [columns, setColumns] = React.useState(4);
  const [rowHeight, setRowHeight] = React.useState(200);
  
  React.useEffect(() => {
    const updateLayout = () => {
      if (!parentRef.current) return;
      const width = parentRef.current.offsetWidth;

      // Determine columns based on width
      let newColumns = 4;
      if (width < 640) newColumns = 2;
      else if (width < 768) newColumns = 3;
      else if (width < 1024) newColumns = 4;
      else if (width < 1280) newColumns = 5;
      else newColumns = 6;

      setColumns(newColumns);

      // Calculate row height: (width - (gaps)) / columns
      // gap-4 is 1rem = 16px
      // We subtract padding (p-4 = 16px * 2 = 32px) if the container has padding, 
      // but here the grid container has padding, not the parent.
      // Actually, the parent has no padding, but the inner div has p-4.
      // Let's assume the width available for items is width - padding.
      // The inner div has p-4, so 32px horizontal padding total.
      const gap = 16;
      const padding = 32;
      const availableWidth = width - padding - (gap * (newColumns - 1));
      const itemWidth = availableWidth / newColumns;

      // Items are aspect-square, so height = width
      // Add gap to row height for the virtualizer spacing
      setRowHeight(itemWidth + gap);
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, [isLoading, media.length > 0]);

  const rows = Math.ceil(media.length / columns);

  const rowVirtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  // Infinite scroll trigger
  React.useEffect(() => {
    const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse();
    if (!lastItem) return;

    if (
      lastItem.index >= rows - 1 &&
      hasMore &&
      !isFetchingNextPage &&
      !isLoading
    ) {
      onLoadMore?.();
    }
  }, [
    hasMore,
    isFetchingNextPage,
    isLoading,
    onLoadMore,
    rowVirtualizer.getVirtualItems(),
    rows,
  ]);

  if (isLoading && media.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (media.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-muted-foreground">No media found matching your filters.</p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-full w-full overflow-auto p-4"
      style={{ contain: 'strict' }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const rowItems = media.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.index}
              className="grid gap-4"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {rowItems.map((item) => (
                <MediaItem
                  key={item.id}
                  item={item}
                  isSelected={selectedIds.has(item.id)}
                  onSelect={() => onSelectMedia(item.id)}
                  onClick={() => onMediaClick(item)}
                  brandMembers={brandMembers}
                />
              ))}
            </div>
          );
        })}
      </div>
      
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
