import React from 'react';
import { cn } from '@/lib/utils';

interface MasonryGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  columns?: {
    default: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: number;
}

export function MasonryGrid({
  children,
  className,
  columns = { default: 1, sm: 2, md: 3, lg: 3, xl: 4 },
  gap = 4,
  ...props
}: MasonryGridProps) {
  return (
    <div
      className={cn(
        "w-full",
        // Default columns
        `columns-${columns.default}`,
        // Responsive columns
        columns.sm && `sm:columns-${columns.sm}`,
        columns.md && `md:columns-${columns.md}`,
        columns.lg && `lg:columns-${columns.lg}`,
        columns.xl && `xl:columns-${columns.xl}`,
        // Gap (using space-y for vertical gap in columns, horizontal is handled by column-gap)
        `gap-${gap}`,
        "space-y-4", // Fallback for direct children spacing
        className
      )}
      {...props}
    >
      {/* 
        We need to ensure children have 'break-inside-avoid' to prevent them from being split across columns.
        We can't enforce this on children directly here easily without cloning, 
        so we rely on the consumer to wrap items or we wrap them here if they are an array.
      */}
      {React.Children.map(children, (child, index) => {
        const key = (React.isValidElement(child) && child.key) ? child.key : index;
        return (
          <div key={key} className={`break-inside-avoid mb-${gap}`}>
            {child}
          </div>
        );
      })}
    </div>
  );
}
