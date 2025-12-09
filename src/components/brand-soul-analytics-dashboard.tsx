'use client';

import React, { useEffect, useState } from 'react';
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Camera, Palette, Shield, BarChart3, Calendar, Sparkles } from 'lucide-react';
import { getExplainabilityAnalyticsAction } from '@/app/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

interface BrandSoulAnalyticsDashboardProps {
  brandId: string;
}

interface AnalyticsData {
  totalGenerations: number;
  averageConfidence: number;
  confidenceTrend: { date: string; avgConfidence: number }[];
  topPhotographicControls: { control: string; count: number }[];
  topBrandElements: { element: string; count: number }[];
  topAvoidedElements: { element: string; count: number }[];
  sourceBreakdown: { campaign: number; chatbot: number; gallery: number };
  recentGenerations: any[];
}

export function BrandSoulAnalyticsDashboard({ brandId }: BrandSoulAnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<string>('30');

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      const result = await getExplainabilityAnalyticsAction(brandId, parseInt(timeRange));
      if (result.analytics) {
        setAnalytics(result.analytics);
      }
      setLoading(false);
    }
    loadAnalytics();
  }, [brandId, timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!analytics || analytics.totalGenerations === 0) {
    return (
      <GlassCard className="border-dashed">
        <GlassCardContent className="flex flex-col items-center justify-center py-12">
          <Sparkles className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Data Yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Generate images with Team Intelligence to see analytics and insights about how your team knowledge shapes AI-generated content.
          </p>
        </GlassCardContent>
      </GlassCard>
    );
  }

  const confidenceColor = 
    analytics.averageConfidence >= 80 ? 'text-green-600' :
    analytics.averageConfidence >= 60 ? 'text-yellow-600' :
    'text-orange-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Team Intelligence Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Insights into how your Team Intelligence influences AI-generated images
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard>
          <GlassCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <GlassCardTitle className="text-sm font-medium">Total Generations</GlassCardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </GlassCardHeader>
          <GlassCardContent>
            <div className="text-2xl font-bold">{analytics.totalGenerations}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Images created with Team Intelligence
            </p>
          </GlassCardContent>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <GlassCardTitle className="text-sm font-medium">Average Confidence</GlassCardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </GlassCardHeader>
          <GlassCardContent>
            <div className={`text-2xl font-bold ${confidenceColor}`}>
              {Math.round(analytics.averageConfidence)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Team Intelligence influence strength
            </p>
          </GlassCardContent>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <GlassCardTitle className="text-sm font-medium">Top Source</GlassCardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </GlassCardHeader>
          <GlassCardContent>
            <div className="text-2xl font-bold capitalize">
              {analytics.sourceBreakdown.campaign >= analytics.sourceBreakdown.chatbot ? 'Campaign' : 'Chatbot'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.max(analytics.sourceBreakdown.campaign, analytics.sourceBreakdown.chatbot)} generations
            </p>
          </GlassCardContent>
        </GlassCard>
      </div>

      {/* Source Breakdown */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Generation Sources
          </GlassCardTitle>
          <GlassCardDescription>Where Team Intelligence is being applied</GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Campaign Creator</span>
              <span className="text-sm text-muted-foreground">{analytics.sourceBreakdown.campaign}</span>
            </div>
            <Progress 
              value={(analytics.sourceBreakdown.campaign / analytics.totalGenerations) * 100} 
              className="h-2"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">AI Chatbot</span>
              <span className="text-sm text-muted-foreground">{analytics.sourceBreakdown.chatbot}</span>
            </div>
            <Progress 
              value={(analytics.sourceBreakdown.chatbot / analytics.totalGenerations) * 100} 
              className="h-2"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Image Gallery</span>
              <span className="text-sm text-muted-foreground">{analytics.sourceBreakdown.gallery}</span>
            </div>
            <Progress 
              value={(analytics.sourceBreakdown.gallery / analytics.totalGenerations) * 100} 
              className="h-2"
            />
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Top Photographic Controls */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-purple-500" />
            Top Photographic Controls
          </GlassCardTitle>
          <GlassCardDescription>Most frequently applied photography preferences</GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent>
          {analytics.topPhotographicControls.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {analytics.topPhotographicControls.map((control, idx) => (
                <Badge key={idx} variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                  {control.control} ({control.count})
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No photographic controls applied yet</p>
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Top Brand Elements */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-blue-500" />
            Top Brand Elements
          </GlassCardTitle>
          <GlassCardDescription>Most frequently applied brand identity elements</GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent>
          {analytics.topBrandElements.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {analytics.topBrandElements.map((element, idx) => (
                <Badge key={idx} variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  {element.element} ({element.count})
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No brand elements applied yet</p>
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Top Avoided Elements */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-500" />
            Top Quality Controls
          </GlassCardTitle>
          <GlassCardDescription>Most frequently avoided off-brand elements</GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent>
          {analytics.topAvoidedElements.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {analytics.topAvoidedElements.map((element, idx) => (
                <Badge key={idx} variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  {element.element} ({element.count})
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No avoided elements tracked yet</p>
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Confidence Trend */}
      {analytics.confidenceTrend.length > 1 && (
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Confidence Trend
            </GlassCardTitle>
            <GlassCardDescription>Average Brand Soul confidence over time</GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="space-y-2">
              {analytics.confidenceTrend.slice(-7).map((trend, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground w-24">
                    {new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex-1">
                    <Progress value={trend.avgConfidence} className="h-2" />
                  </div>
                  <span className={`text-xs font-medium w-12 text-right ${
                    trend.avgConfidence >= 80 ? 'text-green-600' :
                    trend.avgConfidence >= 60 ? 'text-yellow-600' :
                    'text-orange-600'
                  }`}>
                    {Math.round(trend.avgConfidence)}%
                  </span>
                </div>
              ))}
            </div>
          </GlassCardContent>
        </GlassCard>
      )}
    </div>
  );
}
