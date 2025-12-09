'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Loader2, Settings, BrainCircuit, ImageIcon, Clapperboard, Text, Database, TestTube, ExternalLink, Palette, Users, Save } from 'lucide-react';
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { PageTransition } from '@/components/ui/page-transition';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { generateAIBrandingAction, deleteBrandThemeAction, updateBrandThemeAction } from '@/app/actions/ai-branding';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useBrandTheme } from '@/contexts/brand-theme-context';
import { hslToHex } from '@/lib/utils';
import { getAIModelSettingsAction, updateAIModelSettingsAction } from '@/app/actions/ai-settings';
import { AVAILABLE_MODELS, type AIModelSettings } from '@/lib/ai-model-defaults';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ModelInfo {
    task: string;
    model: string;
    description: string;
    icon: React.ElementType;
}

// Use the centralized AVAILABLE_MODELS from ai-settings
const availableModels = AVAILABLE_MODELS;


export default function SettingsPage() {
  const { user, loading: authLoading, brandId } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { theme, refreshTheme } = useBrandTheme();
  
  const [generatingBranding, setGeneratingBranding] = useState(false);
    const [isSavingTheme, setIsSavingTheme] = useState(false);
    const [editableTheme, setEditableTheme] = useState<any>(null);
    const [aiSettings, setAiSettings] = useState<AIModelSettings | null>(null);
    const [isSavingAiSettings, setIsSavingAiSettings] = useState(false);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

    useEffect(() => {
        if (theme) {
            setEditableTheme(JSON.parse(JSON.stringify(theme)));
        }
    }, [theme]);

    useEffect(() => {
        if (brandId) {
            getAIModelSettingsAction(brandId).then(setAiSettings);
        }
    }, [brandId]);

  const handleGenerateAIBranding = async () => {
    console.log('[AI Branding] Button clicked, brandId:', brandId);
    if (!brandId) {
      console.error('[AI Branding] No brandId available');
      return;
    }
    
    setGeneratingBranding(true);
    try {
      console.log('[AI Branding] Calling generateAIBrandingAction...');
      const result = await generateAIBrandingAction(brandId);
      console.log('[AI Branding] Result:', result);
      
      if (result.error) {
        console.error('[AI Branding] Error:', result.error);
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      } else {
        console.log('[AI Branding] Success! Theme:', result.theme);
        toast({
          title: 'AI Branding Generated!',
          description: result.theme?.description || 'Your brand now has a unique AI-generated visual identity.',
        });
        console.log('[AI Branding] Refreshing theme...');
        await refreshTheme();
        console.log('[AI Branding] Theme refreshed!');
      }
    } catch (error: any) {
      console.error('[AI Branding] Exception:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate AI branding',
        variant: 'destructive',
      });
    } finally {
      setGeneratingBranding(false);
    }
  };

    const handleSaveTheme = async () => {
        if (!brandId || !editableTheme) return;
        setIsSavingTheme(true);
        try {
            const result = await updateBrandThemeAction(brandId, editableTheme);
            if (result.success) {
                toast({
                    title: 'Theme Updated',
                    description: 'Your brand colors have been updated successfully.',
                });
                await refreshTheme();
            } else {
                toast({
                    title: 'Error',
                    description: result.error || 'Failed to update theme',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to update theme',
                variant: 'destructive',
            });
        } finally {
            setIsSavingTheme(false);
        }
    };

    const handleSaveAiSettings = async () => {
        if (!brandId || !aiSettings) return;
        setIsSavingAiSettings(true);
        try {
            const result = await updateAIModelSettingsAction(brandId, aiSettings);
            if (result.success) {
                toast({
                    title: 'Settings Updated',
                    description: 'AI model configuration has been updated.',
                });
            } else {
                toast({
                    title: 'Error',
                    description: result.error || 'Failed to update settings',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to update settings',
                variant: 'destructive',
            });
        } finally {
            setIsSavingAiSettings(false);
        }
    };

    const handleColorChange = (category: 'colors' | 'gradients', key: string, value: string) => {
        if (!editableTheme) return;
        setEditableTheme((prev: any) => ({
            ...prev,
            [category]: {
                ...prev[category],
                [key]: value,
            },
        }));
    };

    const handleRestoreDefaultColors = async () => {
        if (!brandId) return;

        try {
            const result = await deleteBrandThemeAction(brandId);
            if (result.success) {
                toast({
                    title: 'Defaults Restored',
                    description: 'Your brand colors have been reset to default.',
                });
                await refreshTheme();
                window.location.reload(); // Force reload to ensure all styles reset
            } else {
                toast({
                    title: 'Error',
                    description: result.error || 'Failed to restore defaults',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to restore defaults',
                variant: 'destructive',
            });
        } finally {
            setShowRestoreConfirm(false);
        }
    };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
      <PageTransition className="container mx-auto px-4 py-8 md:px-6 md:py-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl font-bold font-headline flex items-center gap-3">
          <Settings className="w-8 h-8 md:w-10 md:h-10 text-primary" />
          <span>Settings</span>
        </h1>
      </header>

      <div className="max-w-4xl mx-auto space-y-6">
              <GlassCard>
                  <GlassCardHeader>
                      <GlassCardTitle className="flex items-center gap-2">
                    <BrainCircuit className="w-6 h-6" />
                    AI Model Configuration
                      </GlassCardTitle>
                      <GlassCardDescription>
                          Select the AI models to use for different tasks.
                      </GlassCardDescription>
                  </GlassCardHeader>
                  <GlassCardContent className="space-y-6">
                      {aiSettings ? (
                          <div className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                      <Label className="flex items-center gap-2">
                                          <Text className="w-4 h-4" />
                                          Text Generation Model
                                      </Label>
                                      <Select
                                          value={aiSettings.textModel}
                                          onValueChange={(value) => setAiSettings({ ...aiSettings, textModel: value })}
                                      >
                                          <SelectTrigger>
                                              <SelectValue placeholder="Select model" />
                                          </SelectTrigger>
                                          <SelectContent>
                                              {availableModels.text.map(model => (
                                                  <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
                                              ))}
                                          </SelectContent>
                                      </Select>
                                      <p className="text-xs text-muted-foreground">Used for chat and content generation.</p>
                                  </div>

                                  <div className="space-y-2">
                                      <Label className="flex items-center gap-2">
                                          <BrainCircuit className="w-4 h-4" />
                                          Agent Root Model
                                      </Label>
                                      <Select
                                          value={aiSettings.agentModel || aiSettings.textModel}
                                          onValueChange={(value) => setAiSettings({ ...aiSettings, agentModel: value })}
                                      >
                                          <SelectTrigger>
                                              <SelectValue placeholder="Select model" />
                                          </SelectTrigger>
                                          <SelectContent>
                                              {availableModels.text.map(model => (
                                                  <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
                                              ))}
                                          </SelectContent>
                                      </Select>
                                      <p className="text-xs text-muted-foreground">Primary model used by the AI Agent.</p>
                                  </div>

                                  <div className="col-span-1 md:col-span-2 mt-4">
                                      <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                          <Users className="w-4 h-4" />
                                          Team Tools Models
                                      </h4>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border">
                                          <div className="space-y-2">
                                              <Label className="text-xs">Team Assistant</Label>
                                              <Select
                                                  value={aiSettings.teamChatModel || aiSettings.textModel}
                                                  onValueChange={(value) => setAiSettings({ ...aiSettings, teamChatModel: value })}
                                              >
                                                  <SelectTrigger className="h-8 text-xs">
                                                      <SelectValue placeholder="Select model" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                      {availableModels.text.map(model => (
                                                          <SelectItem key={model.id} value={model.id} className="text-xs">{model.name}</SelectItem>
                                                      ))}
                                                  </SelectContent>
                                              </Select>
                                          </div>
                                          <div className="space-y-2">
                                              <Label className="text-xs">Event Creator</Label>
                                              <Select
                                                  value={aiSettings.eventCreatorModel || aiSettings.textModel}
                                                  onValueChange={(value) => setAiSettings({ ...aiSettings, eventCreatorModel: value })}
                                              >
                                                  <SelectTrigger className="h-8 text-xs">
                                                      <SelectValue placeholder="Select model" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                      {availableModels.text.map(model => (
                                                          <SelectItem key={model.id} value={model.id} className="text-xs">{model.name}</SelectItem>
                                                      ))}
                                                  </SelectContent>
                                              </Select>
                                          </div>
                                          <div className="space-y-2">
                                              <Label className="text-xs">Domain Suggestions</Label>
                                              <Select
                                                  value={aiSettings.domainSuggestionsModel || aiSettings.textModel}
                                                  onValueChange={(value) => setAiSettings({ ...aiSettings, domainSuggestionsModel: value })}
                                              >
                                                  <SelectTrigger className="h-8 text-xs">
                                                      <SelectValue placeholder="Select model" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                      {availableModels.text.map(model => (
                                                          <SelectItem key={model.id} value={model.id} className="text-xs">{model.name}</SelectItem>
                                                      ))}
                                                  </SelectContent>
                                              </Select>
                                          </div>
                                          <div className="space-y-2">
                                              <Label className="text-xs">Website Planning</Label>
                                              <Select
                                                  value={aiSettings.websitePlanningModel || aiSettings.textModel}
                                                  onValueChange={(value) => setAiSettings({ ...aiSettings, websitePlanningModel: value })}
                                              >
                                                  <SelectTrigger className="h-8 text-xs">
                                                      <SelectValue placeholder="Select model" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                      {availableModels.text.map(model => (
                                                          <SelectItem key={model.id} value={model.id} className="text-xs">{model.name}</SelectItem>
                                                      ))}
                                                  </SelectContent>
                                              </Select>
                                          </div>
                                          <div className="space-y-2">
                                              <Label className="text-xs">Team Strategy</Label>
                                              <Select
                                                  value={aiSettings.teamStrategyModel || aiSettings.textModel}
                                                  onValueChange={(value) => setAiSettings({ ...aiSettings, teamStrategyModel: value })}
                                              >
                                                  <SelectTrigger className="h-8 text-xs">
                                                      <SelectValue placeholder="Select model" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                      {availableModels.text.map(model => (
                                                          <SelectItem key={model.id} value={model.id} className="text-xs">{model.name}</SelectItem>
                                                      ))}
                                                  </SelectContent>
                                              </Select>
                                          </div>
                                          <div className="space-y-2">
                                              <Label className="text-xs">Logo Concepts</Label>
                                              <Select
                                                  value={aiSettings.logoConceptsModel || aiSettings.textModel}
                                                  onValueChange={(value) => setAiSettings({ ...aiSettings, logoConceptsModel: value })}
                                              >
                                                  <SelectTrigger className="h-8 text-xs">
                                                      <SelectValue placeholder="Select model" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                      {availableModels.text.map(model => (
                                                          <SelectItem key={model.id} value={model.id} className="text-xs">{model.name}</SelectItem>
                                                      ))}
                                                  </SelectContent>
                                              </Select>
                                          </div>
                                          <div className="space-y-2">
                                              <Label className="text-xs">Search</Label>
                                              <Select
                                                  value={aiSettings.searchModel || aiSettings.textModel}
                                                  onValueChange={(value) => setAiSettings({ ...aiSettings, searchModel: value })}
                                              >
                                                  <SelectTrigger className="h-8 text-xs">
                                                      <SelectValue placeholder="Select model" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                      {availableModels.text.map(model => (
                                                          <SelectItem key={model.id} value={model.id} className="text-xs">{model.name}</SelectItem>
                                                      ))}
                                                  </SelectContent>
                                              </Select>
                                          </div>
                                          <div className="space-y-2">
                                              <Label className="text-xs">YouTube Analysis</Label>
                                              <Select
                                                  value={aiSettings.youtubeAnalysisModel || aiSettings.textModel}
                                                  onValueChange={(value) => setAiSettings({ ...aiSettings, youtubeAnalysisModel: value })}
                                              >
                                                  <SelectTrigger className="h-8 text-xs">
                                                      <SelectValue placeholder="Select model" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                      {availableModels.text.map(model => (
                                                          <SelectItem key={model.id} value={model.id} className="text-xs">{model.name}</SelectItem>
                                                      ))}
                                                  </SelectContent>
                                              </Select>
                                          </div>
                                      </div>
                                  </div>

                                  <div className="space-y-2">
                                      <Label className="flex items-center gap-2">
                                          <ImageIcon className="w-4 h-4" />
                                          Image Generation Model
                                      </Label>
                                      <Select
                                          value={aiSettings.imageModel}
                                          onValueChange={(value) => setAiSettings({ ...aiSettings, imageModel: value })}
                                      >
                                          <SelectTrigger>
                                              <SelectValue placeholder="Select model" />
                                          </SelectTrigger>
                                          <SelectContent>
                                              {availableModels.image.map(model => (
                                                  <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
                                              ))}
                                          </SelectContent>
                                      </Select>
                                      <p className="text-xs text-muted-foreground">Used for creating new images.</p>
                                  </div>

                                  <div className="space-y-2">
                                      <Label className="flex items-center gap-2">
                                          <ImageIcon className="w-4 h-4" />
                                          Image Editing Model
                                      </Label>
                                      <Select
                                          value={aiSettings.imageEditModel}
                                          onValueChange={(value) => setAiSettings({ ...aiSettings, imageEditModel: value })}
                                      >
                                          <SelectTrigger>
                                              <SelectValue placeholder="Select model" />
                                          </SelectTrigger>
                                          <SelectContent>
                                              {availableModels.imageEdit.map(model => (
                                                  <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
                                              ))}
                                          </SelectContent>
                                      </Select>
                                      <p className="text-xs text-muted-foreground">Used for editing existing images.</p>
                                  </div>

                                  <div className="space-y-2">
                                      <Label className="flex items-center gap-2">
                                          <Clapperboard className="w-4 h-4" />
                                          Video Generation Model
                                      </Label>
                                      <Select
                                          value={aiSettings.videoModel}
                                          onValueChange={(value) => setAiSettings({ ...aiSettings, videoModel: value })}
                                      >
                                          <SelectTrigger>
                                              <SelectValue placeholder="Select model" />
                                          </SelectTrigger>
                                          <SelectContent>
                                              {availableModels.video.map(model => (
                                                  <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
                                              ))}
                                          </SelectContent>
                                      </Select>
                                      <p className="text-xs text-muted-foreground">Used for creating videos.</p>
                                  </div>
                              </div>
                              <Button onClick={handleSaveAiSettings} disabled={isSavingAiSettings}>
                                  {isSavingAiSettings ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                  Save Model Configuration
                              </Button>
                          </div>
                      ) : (
                          <div className="flex justify-center p-4">
                              <Loader2 className="w-6 h-6 animate-spin text-primary" />
                          </div>
                      )}
                  </GlassCardContent>
              </GlassCard>

              <GlassCard>
                  <GlassCardHeader>
                      <GlassCardTitle className="flex items-center gap-2">
                          <BrainCircuit className="w-6 h-6" />
                          Personal Memory
                      </GlassCardTitle>
                      <GlassCardDescription>
                          Manage your personal, persistent memory for your AI companion.
                      </GlassCardDescription>
                  </GlassCardHeader>
                  <GlassCardContent>
                      <Link href="/settings/memory">
                          <Button>Manage Memory</Button>
                      </Link>
                  </GlassCardContent>
              </GlassCard>

              <GlassCard>
                  <GlassCardHeader>
                      <GlassCardTitle className="flex items-center gap-2">
                          <Database className="w-6 h-6" />
                          Search Settings
                      </GlassCardTitle>
                      <GlassCardDescription>
                          Configure your media search method and manage indexing preferences.
                      </GlassCardDescription>
                  </GlassCardHeader>
                  <GlassCardContent>
                      <div className="flex items-start gap-4 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border">
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                              <Database className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                              <h3 className="font-semibold text-foreground mb-2">Smart Search Configuration</h3>
                              <p className="text-sm text-muted-foreground mb-4">
                                  Choose between AI-powered Vertex AI Search for semantic understanding or Firebase search for basic text matching. Configure auto-indexing and manage your search data stores.
                              </p>
                              <Link href="/settings/search">
                                  <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                                      <Database className="h-4 w-4 mr-2" />
                                      Manage Search Settings
                                  </Button>
                              </Link>
                          </div>
                      </div>
                  </GlassCardContent>
              </GlassCard>

              <GlassCard>
                  <GlassCardHeader>
                      <GlassCardTitle className="flex items-center gap-2">
                    <Palette className="w-6 h-6" />
                    AI Visual Branding
                      </GlassCardTitle>
                      <GlassCardDescription>
                    Generate a unique, colorful visual identity for your team using AI based on your Team Intelligence.
                      </GlassCardDescription>
                  </GlassCardHeader>
                  <GlassCardContent className="space-y-6">
                <div className="flex items-start gap-4 p-4 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                        <Palette className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-foreground mb-2">Dynamic Brand Theme</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            AI analyzes your team's mission, vision, and personality to create a vibrant, unique color scheme and visual identity that makes every page stand out.
                        </p>
                              <div className="flex items-center gap-4">
                                  <Button
                                      onClick={handleGenerateAIBranding}
                                      disabled={generatingBranding}
                                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                                  >
                                      {generatingBranding ? (
                                          <>
                                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                              Generating...
                                          </>
                                      ) : (
                                          <>
                                              <Palette className="h-4 w-4 mr-2" />
                                              Generate AI Branding
                                          </>
                                      )}
                                  </Button>
                                  {theme && (
                                      <AlertDialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
                                          <AlertDialogTrigger asChild>
                                              <Button
                                                  variant="outline"
                                              >
                                                  Restore Default Colors
                                              </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                              <AlertDialogHeader>
                                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                      This will remove your custom AI branding and restore the default colors. This action cannot be undone.
                                                  </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                  <AlertDialogAction onClick={handleRestoreDefaultColors}>
                                                      Restore Defaults
                                                  </AlertDialogAction>
                                              </AlertDialogFooter>
                                          </AlertDialogContent>
                                      </AlertDialog>
                                  )}
                              </div>
                    </div>
                </div>

                {theme && (
                    <div className="space-y-4">
                        {/* Show Team Intelligence influence section */}
                        {theme.sourceColors !== undefined && (
                            <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-2 mb-3">
                                    <BrainCircuit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    <h3 className="font-semibold text-foreground">Team Intelligence Influence</h3>
                                    <span className="text-xs text-muted-foreground ml-auto">Source: Brand Soul</span>
                                </div>
                                {theme.sourceColors.length > 0 ? (
                                    <>
                                        <p className="text-xs text-muted-foreground mb-3">
                                            These colors from your visual assets and brand materials influenced the AI-generated theme below ↓
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {theme.sourceColors.map((color: any, index: number) => {
                                                // Handle both string and object formats
                                                const colorValue = typeof color === 'object' && color.hex ? color.hex : color;
                                                return (
                                                    <div key={index} className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded-lg border p-2 shadow-sm">
                                                        <div 
                                                            className="h-8 w-8 rounded border-2 border-gray-200 dark:border-gray-700"
                                                            style={{ background: colorValue }}
                                                            title={colorValue}
                                                        />
                                                        <span className="text-xs font-mono text-muted-foreground">{colorValue}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-xs text-muted-foreground">
                                        No existing brand colors were found in your Team Intelligence. The AI created a fresh, bold theme based on your mission, vision, and personality ✨
                                    </p>
                                )}
                            </div>
                        )}
                        
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Palette className="h-4 w-4" />
                                <h3 className="font-semibold text-foreground">AI-Generated Brand Colors</h3>
                            </div>
                            <div className="grid grid-cols-5 gap-3 mb-4">
                                <div className="space-y-1.5">
                                    <div 
                                        className="h-16 rounded-lg border shadow-sm"
                                        style={{ background: theme.colors.primary }}
                                    />
                                    <p className="text-xs font-medium text-center">Primary</p>
                                </div>
                                <div className="space-y-1.5">
                                    <div 
                                        className="h-16 rounded-lg border shadow-sm"
                                        style={{ background: theme.colors.secondary }}
                                    />
                                    <p className="text-xs font-medium text-center">Secondary</p>
                                </div>
                                <div className="space-y-1.5">
                                    <div 
                                        className="h-16 rounded-lg border shadow-sm"
                                        style={{ background: theme.colors.accent }}
                                    />
                                    <p className="text-xs font-medium text-center">Accent</p>
                                </div>
                                <div className="space-y-1.5">
                                    <div 
                                        className="h-16 rounded-lg border shadow-sm"
                                        style={{ background: theme.colors.background }}
                                    />
                                    <p className="text-xs font-medium text-center">Background</p>
                                </div>
                                <div className="space-y-1.5">
                                    <div 
                                        className="h-16 rounded-lg border shadow-sm"
                                        style={{ background: theme.colors.card }}
                                    />
                                    <p className="text-xs font-medium text-center">Card</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold text-foreground mb-3">Gradients</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <div 
                                        className="h-20 rounded-lg border shadow-sm"
                                        style={{ background: theme.gradients.hero }}
                                    />
                                    <p className="text-xs font-medium text-center">Hero Gradient</p>
                                </div>
                                <div className="space-y-1.5">
                                    <div 
                                        className="h-20 rounded-lg border shadow-sm"
                                        style={{ background: theme.gradients.feature }}
                                    />
                                    <p className="text-xs font-medium text-center">Feature Gradient</p>
                                </div>
                            </div>
                        </div>

                        {theme.description && (
                            <div className="p-3 rounded-lg bg-muted/50 border">
                                <p className="text-sm text-muted-foreground italic">"{theme.description}"</p>
                            </div>
                        )}

                              {/* Manual Color Editor */}
                              {editableTheme && (
                                  <div className="mt-6 pt-6 border-t">
                                      <div className="flex items-center justify-between mb-4">
                                          <h3 className="font-semibold text-foreground flex items-center gap-2">
                                              <Palette className="h-4 w-4" />
                                              Manual Color Editor
                                          </h3>
                                          <Button
                                              onClick={handleSaveTheme}
                                              disabled={isSavingTheme}
                                              size="sm"
                                          >
                                              {isSavingTheme ? (
                                                  <>
                                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                      Saving...
                                                  </>
                                              ) : (
                                                  'Save Changes'
                                              )}
                                          </Button>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                          <div className="space-y-4">
                                              <h4 className="text-sm font-medium text-muted-foreground">Colors</h4>
                                              <div className="grid grid-cols-2 gap-4">
                                                  <div className="space-y-2">
                                                      <Label htmlFor="primary">Primary</Label>
                                                      <div className="flex gap-2">
                                                          <Input
                                                              id="primary"
                                                              type="color"
                                                              value={editableTheme.colors.primary.startsWith('hsl') ? hslToHex(editableTheme.colors.primary) : editableTheme.colors.primary}
                                                              onChange={(e) => handleColorChange('colors', 'primary', e.target.value)}
                                                              className="w-12 h-10 p-1"
                                                          />
                                                          <Input
                                                              value={editableTheme.colors.primary}
                                                              onChange={(e) => handleColorChange('colors', 'primary', e.target.value)}
                                                              className="font-mono text-xs"
                                                          />
                                                      </div>
                                                  </div>
                                                  <div className="space-y-2">
                                                      <Label htmlFor="primaryForeground">Primary Text</Label>
                                                      <div className="flex gap-2">
                                                          <Input
                                                              id="primaryForeground"
                                                              type="color"
                                                              value={editableTheme.colors.primaryForeground?.startsWith('hsl') ? hslToHex(editableTheme.colors.primaryForeground) : editableTheme.colors.primaryForeground || '#ffffff'}
                                                              onChange={(e) => handleColorChange('colors', 'primaryForeground', e.target.value)}
                                                              className="w-12 h-10 p-1"
                                                          />
                                                          <Input
                                                              value={editableTheme.colors.primaryForeground || ''}
                                                              onChange={(e) => handleColorChange('colors', 'primaryForeground', e.target.value)}
                                                              className="font-mono text-xs"
                                                          />
                                                      </div>
                                                  </div>
                                                  <div className="space-y-2">
                                                      <Label htmlFor="secondary">Secondary</Label>
                                                      <div className="flex gap-2">
                                                          <Input
                                                              id="secondary"
                                                              type="color"
                                                              value={editableTheme.colors.secondary.startsWith('hsl') ? hslToHex(editableTheme.colors.secondary) : editableTheme.colors.secondary}
                                                              onChange={(e) => handleColorChange('colors', 'secondary', e.target.value)}
                                                              className="w-12 h-10 p-1"
                                                          />
                                                          <Input
                                                              value={editableTheme.colors.secondary}
                                                              onChange={(e) => handleColorChange('colors', 'secondary', e.target.value)}
                                                              className="font-mono text-xs"
                                                          />
                                                      </div>
                                                  </div>
                                                  <div className="space-y-2">
                                                      <Label htmlFor="accent">Accent</Label>
                                                      <div className="flex gap-2">
                                                          <Input
                                                              id="accent"
                                                              type="color"
                                                              value={editableTheme.colors.accent.startsWith('hsl') ? hslToHex(editableTheme.colors.accent) : editableTheme.colors.accent}
                                                              onChange={(e) => handleColorChange('colors', 'accent', e.target.value)}
                                                              className="w-12 h-10 p-1"
                                                          />
                                                          <Input
                                                              value={editableTheme.colors.accent}
                                                              onChange={(e) => handleColorChange('colors', 'accent', e.target.value)}
                                                              className="font-mono text-xs"
                                                          />
                                                      </div>
                                                  </div>
                                                  <div className="space-y-2">
                                                      <Label htmlFor="background">Background</Label>
                                                      <div className="flex gap-2">
                                                          <Input
                                                              id="background"
                                                              type="color"
                                                              value={editableTheme.colors.background.startsWith('hsl') ? hslToHex(editableTheme.colors.background) : editableTheme.colors.background}
                                                              onChange={(e) => handleColorChange('colors', 'background', e.target.value)}
                                                              className="w-12 h-10 p-1"
                                                          />
                                                          <Input
                                                              value={editableTheme.colors.background}
                                                              onChange={(e) => handleColorChange('colors', 'background', e.target.value)}
                                                              className="font-mono text-xs"
                                                          />
                                                      </div>
                                                  </div>
                                                  <div className="space-y-2">
                                                      <Label htmlFor="foreground">Text</Label>
                                                      <div className="flex gap-2">
                                                          <Input
                                                              id="foreground"
                                                              type="color"
                                                              value={editableTheme.colors.foreground.startsWith('hsl') ? hslToHex(editableTheme.colors.foreground) : editableTheme.colors.foreground}
                                                              onChange={(e) => handleColorChange('colors', 'foreground', e.target.value)}
                                                              className="w-12 h-10 p-1"
                                                          />
                                                          <Input
                                                              value={editableTheme.colors.foreground}
                                                              onChange={(e) => handleColorChange('colors', 'foreground', e.target.value)}
                                                              className="font-mono text-xs"
                                                          />
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                          <div className="space-y-4">
                                              <h4 className="text-sm font-medium text-muted-foreground">Gradients</h4>
                                              <div className="space-y-4">
                                                  <div className="space-y-2">
                                                      <Label htmlFor="heroGradient">Hero Gradient</Label>
                                                      <Input
                                                          id="heroGradient"
                                                          value={editableTheme.gradients.hero}
                                                          onChange={(e) => handleColorChange('gradients', 'hero', e.target.value)}
                                                          className="font-mono text-xs"
                                                      />
                                                      <div className="h-8 rounded border shadow-sm" style={{ background: editableTheme.gradients.hero }} />
                                                  </div>
                                                  <div className="space-y-2">
                                                      <Label htmlFor="heroForeground">Hero Text</Label>
                                                      <div className="flex gap-2">
                                                          <Input
                                                              id="heroForeground"
                                                              type="color"
                                                              value={editableTheme.colors.heroForeground?.startsWith('hsl') ? hslToHex(editableTheme.colors.heroForeground) : editableTheme.colors.heroForeground || '#ffffff'}
                                                              onChange={(e) => handleColorChange('colors', 'heroForeground', e.target.value)}
                                                              className="w-12 h-10 p-1"
                                                          />
                                                          <Input
                                                              value={editableTheme.colors.heroForeground || ''}
                                                              onChange={(e) => handleColorChange('colors', 'heroForeground', e.target.value)}
                                                              className="font-mono text-xs"
                                                          />
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-4">
                                          <strong>Note:</strong> You can enter colors in HSL format (e.g., <code>hsl(200, 100%, 50%)</code>) or Hex format (e.g., <code>#0066cc</code>). The color picker only supports Hex, but the text input supports both.
                                      </p>
                                  </div>
                              )}
                    </div>
                )}

                {!theme && !generatingBranding && (
                    <div className="p-4 rounded-lg bg-muted/30 border-2 border-dashed text-center">
                        <Palette className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">No AI branding generated yet. Click the button above to create your unique brand identity!</p>
                    </div>
                )}
                  </GlassCardContent>
              </GlassCard>

              <GlassCard>
                  <GlassCardHeader>
                      <GlassCardTitle className="flex items-center gap-2">
                    <Database className="w-6 h-6" />
                    Developer Tools & Services
                      </GlassCardTitle>
                      <GlassCardDescription>
                    Access developer tools including RAG (Retrieval-Augmented Generation) testing, backend service monitoring, and API demonstrations.
                      </GlassCardDescription>
                  </GlassCardHeader>
                  <GlassCardContent className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <TestTube className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-foreground">RAG API Test</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                            Test the RAG API endpoints for document indexing and querying. Use this for API integration testing.
                        </p>
                        <Link href="/api/rag-test" target="_blank">
                            <Button variant="outline" size="sm" className="flex items-center gap-2">
                                <ExternalLink className="h-4 w-4" />
                                Open API Test
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Database className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-foreground">Brand Knowledge Base</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                            Your AI-powered brand intelligence hub. Upload documents and get instant answers about your brand.
                        </p>
                        <Link href="/knowledge-base">
                            <Button size="sm" className="flex items-center gap-2">
                                <Database className="h-4 w-4" />
                                Open Knowledge Base
                            </Button>
                        </Link>
                    </div>
                </div>

                  </GlassCardContent>
              </GlassCard>
      </div>
      </PageTransition>
  );
}
