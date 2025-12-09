/**
 * Companion Page Layout
 * 
 * This is a special layout for the /companion route that:
 * 1. Bypasses the main app layout (no Header, no min-h-screen wrapper)
 * 2. Provides a clean, full-screen container
 * 3. Prevents any body scrolling
 * 
 * CRITICAL: This layout is ESSENTIAL to prevent scroll bugs when generating media.
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Team Companion - MOMENTUM',
  description: 'Your AI intelligence & execution partner',
};

export default function CompanionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
    </>
  );
}

