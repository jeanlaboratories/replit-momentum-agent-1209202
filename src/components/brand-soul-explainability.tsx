'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, ChevronDown, ChevronUp, Palette, Camera, Shield, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandSoulExplainabilityProps {
  explainability: {
    summary: string;
    confidence: number;
    appliedControls: string[];
    brandElements: string[];
    avoidedElements: string[];
  };
  className?: string;
}

export function BrandSoulExplainability({ explainability, className }: BrandSoulExplainabilityProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const confidenceColor = 
    explainability.confidence >= 0.8 ? 'text-emerald-500' :
    explainability.confidence >= 0.6 ? 'text-yellow-500' :
    'text-orange-500';

  const confidencePercent = Math.round(explainability.confidence * 100);

  return (
    <Card className={cn('bg-gradient-to-br from-purple-500/5 to-blue-500/5 border-purple-500/20', className)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 mt-0.5">
              <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-2 rounded-lg">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-semibold text-foreground">Team Intelligence Influence</h4>
                <Badge 
                  variant="outline" 
                  className={cn('text-xs font-medium border-0', confidenceColor)}
                >
                  {confidencePercent}% confidence
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {explainability.summary}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 flex-shrink-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <span className="sr-only">{isExpanded ? 'Collapse' : 'Expand'} details</span>
          </Button>
        </div>

        {isExpanded && (
          <div className="space-y-3 pt-3 border-t border-purple-500/10">
            {explainability.appliedControls.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <Camera className="h-3.5 w-3.5 text-purple-500" />
                  <span>Photographic Controls Applied</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {explainability.appliedControls.map((control, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-xs bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20"
                    >
                      {control}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {explainability.brandElements.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <Palette className="h-3.5 w-3.5 text-blue-500" />
                  <span>Brand Elements Integrated</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {explainability.brandElements.map((element, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                    >
                      {element}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {explainability.avoidedElements.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <Shield className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Quality Controls (Avoided)</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {explainability.avoidedElements.map((element, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                    >
                      {element}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-purple-500/10">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Target className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-purple-500" />
                <p className="leading-relaxed">
                  Team Intelligence analyzed your team materials to learn your visual preferences. 
                  These controls ensure every AI-generated image aligns with your team identity.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
