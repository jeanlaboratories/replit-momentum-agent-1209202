'use client';

/**
 * Generation Tracking Provider
 *
 * This component initializes the generation tracking hook which polls for
 * active generation jobs and restores notifications after page refresh.
 */

import { useGenerationTracking } from '@/hooks/use-generation-tracking';

export function GenerationTrackingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize generation tracking - this starts polling for active jobs
  useGenerationTracking();

  return <>{children}</>;
}
