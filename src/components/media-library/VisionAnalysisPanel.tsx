'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Eye, Sparkles, Tag, Target } from 'lucide-react';
import type { UnifiedMedia } from '@/lib/types/media-library';

interface VisionAnalysisPanelProps {
  media: UnifiedMedia;
}

interface VisionData {
  visionDescription?: string;
  visionKeywords?: string[];
  visionCategories?: string[];
  enhancedSearchText?: string;
}

export function VisionAnalysisPanel({ media }: VisionAnalysisPanelProps) {
  const visionData = media as UnifiedMedia & VisionData;
  
  // Debug: Log what the component is receiving
  React.useEffect(() => {
    console.log('[VisionAnalysisPanel] Received media:', {
      id: media.id,
      hasVisionDescription: !!visionData.visionDescription,
      visionDescription: visionData.visionDescription,
      hasVisionKeywords: !!visionData.visionKeywords?.length,
      visionKeywords: visionData.visionKeywords,
      hasVisionCategories: !!visionData.visionCategories?.length,
      visionCategories: visionData.visionCategories,
      visionDescriptionType: typeof visionData.visionDescription,
      visionKeywordsType: typeof visionData.visionKeywords,
      allKeys: Object.keys(media),
    });
  }, [media.id, visionData.visionDescription, visionData.visionKeywords, visionData.visionCategories]);
  
  // Check if vision analysis has been performed
  // Use direct property access instead of visionData to avoid any type assertion issues
  const visionDescription = (media as any).visionDescription;
  const visionKeywords = (media as any).visionKeywords;
  const visionCategories = (media as any).visionCategories;
  
  const hasVisionDescription = Boolean(visionDescription);
  const hasVisionKeywords = Boolean(visionKeywords && Array.isArray(visionKeywords) && visionKeywords.length > 0);
  const hasVisionCategories = Boolean(visionCategories && Array.isArray(visionCategories) && visionCategories.length > 0);
  
  const hasVisionData = hasVisionDescription || hasVisionKeywords || hasVisionCategories;
  
  // Debug: Log the check result
  React.useEffect(() => {
    console.log('[VisionAnalysisPanel] hasVisionData check:', {
      hasVisionData,
      hasVisionDescription,
      hasVisionKeywords,
      hasVisionCategories,
      visionDescription: visionDescription?.substring(0, 50) + '...',
      visionKeywordsCount: visionKeywords?.length,
      visionCategoriesCount: visionCategories?.length,
      visionDescriptionType: typeof visionDescription,
      visionKeywordsType: typeof visionKeywords,
      visionKeywordsIsArray: Array.isArray(visionKeywords),
    });
  }, [hasVisionData, hasVisionDescription, hasVisionKeywords, hasVisionCategories, visionDescription, visionKeywords, visionCategories]);

  if (!hasVisionData) {
    return (
      <div className="p-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20">
        <div className="flex items-center justify-center space-x-2 text-muted-foreground">
          <Eye className="h-4 w-4" />
          <span className="text-sm">No AI vision analysis available</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-center">
          Run AI Vision Analysis to enhance search capabilities
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="font-medium text-sm">AI Vision Analysis</span>
      </div>

      {visionDescription && (
        <div className="space-y-2">
          <div className="flex items-center space-x-1">
            <Eye className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Description
            </span>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            {visionDescription}
          </p>
        </div>
      )}

      {visionKeywords && Array.isArray(visionKeywords) && visionKeywords.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center space-x-1">
              <Tag className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Keywords ({visionKeywords.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {visionKeywords.map((keyword, index) => (
                <Badge 
                  key={index} 
                  variant="secondary" 
                  className="text-xs px-2 py-0.5 bg-primary/10 text-primary hover:bg-primary/20"
                >
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

      {visionCategories && Array.isArray(visionCategories) && visionCategories.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center space-x-1">
              <Target className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Categories
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {visionCategories.map((category, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="text-xs px-2 py-0.5 border-primary/30 text-primary/80"
                >
                  {category}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}
      
      <div className="pt-2 border-t border-muted/50">
        <p className="text-xs text-muted-foreground">
          ✨ This analysis enhances search accuracy by understanding visual content
        </p>
      </div>
    </div>
  );
}