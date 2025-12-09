'use client';

import { EngagementMetric } from '@/lib/types';

interface MetricsStripProps {
  metrics: EngagementMetric[];
}

export function MetricsStrip({ metrics }: MetricsStripProps) {
  if (!metrics || metrics.length === 0) {
    return null;
  }

  return (
    <div className="border-b">
      <div className="flex items-center gap-6 px-4 py-3 overflow-x-auto">
        {metrics.map((metric, index) => (
          <div key={index} className="flex flex-col items-center min-w-fit">
            <div className="text-xl font-bold">{metric.value}</div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {metric.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
