'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { RefreshCw, Brain, Loader2, MessageSquare, Lightbulb, Palette, Target, Zap, AlertTriangle, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { notification } from '@/hooks/use-notification';
import ExtractedImagesSection from './ExtractedImagesSection';

type BrandSoul = {
  id: string;
  brandId: string;
  version: number;
  status: string;
  voice?: {
    tone?: string[];
    style?: string[];
    values?: string[];
    personality?: string[];
  };
  facts?: Array<{ category: string; fact: string; confidence: number }>;
  messages?: Array<{ message: string; context: string; importance: number }>;
  visual?: {
    colors?: string[];
    imagery?: string[];
    designPrinciples?: string[];
  };
  confidence: number;
  lastUpdated: string;
  needsResynthesis?: boolean;
  resynthesisReason?: string;
};

export default function BrandSoulTab() {
  const { brandId } = useAuth();
  const [brandSoul, setBrandSoul] = useState<BrandSoul | null>(null);
  const [loading, setLoading] = useState(true);
  const [synthesizing, setSynthesizing] = useState(false);
  const [hasInsights, setHasInsights] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['voice', 'facts', 'messages', 'visual']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const checkForInsights = async () => {
    if (!brandId) return;

    setInsightsLoading(true);
    try {
      const response = await fetch(`/api/brand-soul/insights?brandId=${brandId}`);
      const data = await response.json();
      setHasInsights(data.success && data.insights && data.insights.length > 0);
    } catch (error) {
      console.error('Failed to check insights:', error);
      setHasInsights(false);
    } finally {
      setInsightsLoading(false);
    }
  };

  const loadBrandSoul = async () => {
    if (!brandId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/brand-soul/get?brandId=${brandId}`);
      const data = await response.json();
      if (data.success && data.brandSoul) {
        setBrandSoul(data.brandSoul);
      } else {
        setBrandSoul(null);
      }
    } catch (error) {
      console.error('Failed to load brand soul:', error);
      setBrandSoul(null);
    } finally {
      setLoading(false);
    }
  };

  const triggerSynthesis = async (forceRebuild: boolean = false) => {
    if (!brandId) return;

    if (!hasInsights) {
      notification.warning({
        title: 'Cannot Synthesize',
        description: 'Extract insights from artifacts first.',
      });
      return;
    }

    setSynthesizing(true);
    const synthNotification = notification.loading({
      title: forceRebuild ? 'Rebuilding...' : 'Synthesizing...',
      description: 'Creating unified team intelligence',
    });

    try {
      const response = await fetch(
        `/api/brand-soul/synthesize?brandId=${brandId}${forceRebuild ? '&forceRebuild=true' : ''}`,
        { method: 'POST' }
      );
      const data = await response.json();

      if (data.success) {
        synthNotification.update({
          type: 'success',
          title: 'Synthesis Complete',
          description: 'Team intelligence updated',
          duration: 3000,
        });
        setTimeout(() => {
          loadBrandSoul();
          checkForInsights();
        }, 1000);
      } else {
        synthNotification.update({
          type: 'error',
          title: 'Synthesis Failed',
          description: data.message || 'Please check your artifacts.',
          duration: 4000,
        });
        setTimeout(() => {
          loadBrandSoul();
          checkForInsights();
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to trigger synthesis:', error);
      synthNotification.update({
        type: 'error',
        title: 'Error',
        description: 'Failed to synthesize',
        duration: 4000,
      });
      setTimeout(() => {
        loadBrandSoul();
        checkForInsights();
      }, 1000);
    } finally {
      setSynthesizing(false);
    }
  };

  useEffect(() => {
    loadBrandSoul();
    checkForInsights();

    const handleBrandSoulChanged = () => {
      loadBrandSoul();
      checkForInsights();
    };

    window.addEventListener('brand-soul-changed', handleBrandSoulChanged);

    return () => {
      window.removeEventListener('brand-soul-changed', handleBrandSoulChanged);
    };
  }, [brandId]);

  if (!brandId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500 text-sm">Please log in to view Team Intelligence.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Visual Assets Section */}
        <ExtractedImagesSection />

        {/* Needs Resynthesis Banner */}
        {brandSoul?.needsResynthesis && (
          <div className="flex items-center gap-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800">Intelligence needs update</p>
              <p className="text-xs text-amber-600 truncate">
                {brandSoul.resynthesisReason || 'Insights have been modified'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerSynthesis(true)}
              disabled={synthesizing}
              className="h-7 px-2.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              {synthesizing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 mr-1" />
                  Update
                </>
              )}
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
              <Brain className="w-4 h-4 text-teal-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">Team Intelligence</h3>
              {brandSoul && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500">v{brandSoul.version}</span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-teal-50 text-teal-700 rounded">
                    {Math.round(brandSoul.confidence)}% confidence
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {brandSoul && !brandSoul.needsResynthesis && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => triggerSynthesis(true)}
                    disabled={synthesizing || !hasInsights}
                    className="h-7 px-2.5 text-xs"
                  >
                    {synthesizing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Regenerate</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadBrandSoul}
                  disabled={loading}
                  className="h-7 w-7 p-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : !brandSoul ? (
          <Card className="border-dashed">
            <CardContent className="py-8">
              <div className="text-center">
                <Brain className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-600 mb-1">No Team Intelligence yet</p>
                <p className="text-xs text-gray-400 mb-4">
                  {!hasInsights
                    ? 'Upload and process artifacts first'
                    : 'Synthesize insights to create intelligence'}
                </p>
                <Button
                  size="sm"
                  onClick={() => triggerSynthesis()}
                  disabled={synthesizing || !hasInsights}
                  className="h-8"
                >
                  {synthesizing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Synthesizing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 mr-1.5" />
                      Synthesize
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Voice Section */}
            {brandSoul.voice && (brandSoul.voice.tone?.length || brandSoul.voice.values?.length) && (
              <Collapsible open={expandedSections.has('voice')} onOpenChange={() => toggleSection('voice')}>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-900">Team Voice</span>
                        {brandSoul.voice.tone && (
                          <span className="text-xs text-gray-400">{brandSoul.voice.tone.length + (brandSoul.voice.values?.length || 0)} elements</span>
                        )}
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.has('voice') ? 'rotate-180' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 py-3 space-y-3">
                      {brandSoul.voice.tone && brandSoul.voice.tone.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1.5">Tone</p>
                          <div className="flex flex-wrap gap-1.5">
                            {brandSoul.voice.tone.map((t, i) => (
                              <Badge key={i} variant="secondary" className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100">{t}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {brandSoul.voice.values && brandSoul.voice.values.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1.5">Core Values</p>
                          <div className="flex flex-wrap gap-1.5">
                            {brandSoul.voice.values.map((v, i) => (
                              <Badge key={i} variant="secondary" className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100">{v}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}

            {/* Facts Section */}
            {brandSoul.facts && brandSoul.facts.length > 0 && (
              <Collapsible open={expandedSections.has('facts')} onOpenChange={() => toggleSection('facts')}>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium text-gray-900">Key Facts</span>
                        <span className="text-xs text-gray-400">{brandSoul.facts.length} facts</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.has('facts') ? 'rotate-180' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 py-2">
                      <div className="space-y-2">
                        {brandSoul.facts.slice(0, 8).map((fact, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded-md">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700">{fact.fact}</p>
                              {fact.category && (
                                <p className="text-[10px] text-gray-400 mt-0.5">{fact.category}</p>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {Math.round(fact.confidence)}%
                            </span>
                          </div>
                        ))}
                        {brandSoul.facts.length > 8 && (
                          <p className="text-xs text-gray-400 text-center py-1">+{brandSoul.facts.length - 8} more</p>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}

            {/* Messages Section */}
            {brandSoul.messages && brandSoul.messages.length > 0 && (
              <Collapsible open={expandedSections.has('messages')} onOpenChange={() => toggleSection('messages')}>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium text-gray-900">Core Messages</span>
                        <span className="text-xs text-gray-400">{brandSoul.messages.length} messages</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.has('messages') ? 'rotate-180' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 py-2">
                      <div className="space-y-2">
                        {brandSoul.messages.slice(0, 5).map((msg, i) => (
                          <div key={i} className="p-2 bg-gray-50 rounded-md">
                            <p className="text-sm text-gray-700 font-medium">{msg.message}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{msg.context}</p>
                          </div>
                        ))}
                        {brandSoul.messages.length > 5 && (
                          <p className="text-xs text-gray-400 text-center py-1">+{brandSoul.messages.length - 5} more</p>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}

            {/* Visual Section */}
            {brandSoul.visual && (brandSoul.visual.colors?.length || brandSoul.visual.designPrinciples?.length) && (
              <Collapsible open={expandedSections.has('visual')} onOpenChange={() => toggleSection('visual')}>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-pink-600" />
                        <span className="text-sm font-medium text-gray-900">Visual Identity</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedSections.has('visual') ? 'rotate-180' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-3 py-3 space-y-3">
                      {brandSoul.visual.colors && brandSoul.visual.colors.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1.5">Colors</p>
                          <div className="flex flex-wrap gap-1.5">
                            {brandSoul.visual.colors.map((color, i) => (
                              <Badge key={i} variant="secondary" className="text-xs bg-pink-50 text-pink-700 hover:bg-pink-100">{color}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {brandSoul.visual.designPrinciples && brandSoul.visual.designPrinciples.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1.5">Design Principles</p>
                          <div className="flex flex-wrap gap-1.5">
                            {brandSoul.visual.designPrinciples.map((principle, i) => (
                              <Badge key={i} variant="secondary" className="text-xs bg-pink-50 text-pink-700 hover:bg-pink-100">{principle}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}

            {/* Last Updated */}
            {brandSoul.lastUpdated && (
              <p className="text-[10px] text-gray-400 text-right">
                Last updated: {new Date(brandSoul.lastUpdated).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
