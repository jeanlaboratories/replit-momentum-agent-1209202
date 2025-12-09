'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { 
  Loader2, 
  Search, 
  Database, 
  Cloud, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Trash2, 
  Plus, 
  TrendingUp,
  Activity,
  BarChart3
} from 'lucide-react';
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { PageTransition } from '@/components/ui/page-transition';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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

import {
  SearchSettings,
  SearchMethod,
  DataStoreStatus,
  IndexingStatus,
  SearchStatsResponse
} from '@/types/search-settings';

import {
  getSearchSettings,
  updateSearchSettings,
  deleteDataStore,
  createDataStore,
  reindexMedia,
  getIndexingStatus,
  getSearchStats
} from '@/lib/api/search-settings';
import { trackGenerationJob } from '@/hooks/use-generation-tracking';

export default function SearchSettingsPage() {
  const { user, loading: authLoading, brandId } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<SearchSettings | null>(null);
  const [indexingStatus, setIndexingStatus] = useState<IndexingStatus | null>(null);
  const [searchStats, setSearchStats] = useState<SearchStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadData = useCallback(async () => {
    if (!brandId || authLoading) return;

    try {
      setLoading(true);
      
      const [settingsData, statusData, statsData] = await Promise.all([
        getSearchSettings(brandId),
        getIndexingStatus(brandId),
        getSearchStats(brandId)
      ]);
      
      setSettings(settingsData);
      setIndexingStatus(statusData);
      setSearchStats(statsData);
    } catch (error: any) {
      toast({
        title: 'Error loading search settings',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [brandId, authLoading, toast]);

  const handleSearchMethodChange = async (newMethod: SearchMethod) => {
    if (!brandId || !settings) return;

    try {
      setActionLoading('method-change');
      
      const updatedSettings = await updateSearchSettings(brandId, {
        search_method: newMethod
      });
      
      setSettings(updatedSettings);
      toast({
        title: 'Search method updated',
        description: `Now using ${newMethod === SearchMethod.VERTEX_AI ? 'Vertex AI Search' : 'Firebase Search'}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error updating search method',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAutoIndexToggle = async (enabled: boolean) => {
    if (!brandId || !settings) return;

    try {
      setActionLoading('auto-index');
      
      const updatedSettings = await updateSearchSettings(brandId, {
        auto_index: enabled
      });
      
      setSettings(updatedSettings);
      toast({
        title: 'Auto-index setting updated',
        description: `Auto-indexing ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error updating auto-index setting',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteDataStore = async () => {
    if (!brandId) return;

    try {
      setActionLoading('delete-datastore');
      
      await deleteDataStore({
        brand_id: brandId,
        confirm_deletion: true
      });
      
      toast({
        title: 'Data store deleted',
        description: 'Vertex AI data store has been deleted and switched to Firebase search',
      });
      
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error deleting data store',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateDataStore = async (forceRecreate: boolean = false) => {
    if (!brandId) return;

    try {
      setActionLoading('create-datastore');
      
      await createDataStore({
        brand_id: brandId,
        force_recreate: forceRecreate
      });
      
      toast({
        title: 'Data store created',
        description: 'Vertex AI data store has been created successfully',
      });
      
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error creating data store',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReindexMedia = async (force: boolean = false) => {
    if (!brandId) return;

    try {
      setActionLoading('reindex');
      
      const result = await reindexMedia(brandId, force);
      
      // Track the job for notifications
      if (result.jobId) {
        trackGenerationJob(result.jobId);
      }
      
      toast({
        title: 'Reindexing started',
        description: 'Media reindexing is now running. You can monitor progress in the job queue.',
      });
      
      setAutoRefresh(true);
      await loadData();
    } catch (error: any) {
      toast({
        title: 'Error starting reindex',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Auto-refresh indexing status when indexing is in progress
  useEffect(() => {
    if (!autoRefresh || !indexingStatus?.is_indexing) {
      setAutoRefresh(false);
      return;
    }

    const interval = setInterval(() => {
      getIndexingStatus(brandId!).then(setIndexingStatus);
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRefresh, indexingStatus?.is_indexing, brandId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && !authLoading) {
      loadData();
    }
  }, [user, authLoading, loadData]);

  if (authLoading || loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !settings) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Unable to load search settings</h2>
          <p className="text-muted-foreground">Please try refreshing the page.</p>
        </div>
      </div>
    );
  }

  return (
    <PageTransition className="container mx-auto px-4 py-8 md:px-6 md:py-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl font-bold font-headline flex items-center gap-3">
          <Search className="w-8 h-8 md:w-10 md:h-10 text-primary" />
          <span>Search Settings</span>
        </h1>
        <Button
          variant="outline"
          onClick={loadData}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh
        </Button>
      </header>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Current Search Method */}
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-2">
              <Search className="w-6 h-6" />
              Search Method
            </GlassCardTitle>
            <GlassCardDescription>
              Choose between Vertex AI Search for advanced semantic search or Firebase for basic text matching.
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Cloud className="w-8 h-8 text-primary" />
                <div>
                  <h3 className="font-semibold">Vertex AI Search</h3>
                  <p className="text-sm text-muted-foreground">
                    AI-powered semantic search with advanced document indexing
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {settings.vertex_ai_enabled ? (
                  <Badge variant="default" className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Available
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Unavailable
                  </Badge>
                )}
                <Switch
                  checked={settings.search_method === SearchMethod.VERTEX_AI}
                  onCheckedChange={(checked) => 
                    handleSearchMethodChange(checked ? SearchMethod.VERTEX_AI : SearchMethod.FIREBASE)
                  }
                  disabled={actionLoading === 'method-change'}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Database className="w-8 h-8 text-primary" />
                <div>
                  <h3 className="font-semibold">Firebase Search</h3>
                  <p className="text-sm text-muted-foreground">
                    Basic text matching and filtering (always available as fallback)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="default" className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Available
                </Badge>
                <Switch
                  checked={settings.search_method === SearchMethod.FIREBASE}
                  onCheckedChange={(checked) => 
                    handleSearchMethodChange(checked ? SearchMethod.FIREBASE : SearchMethod.VERTEX_AI)
                  }
                  disabled={actionLoading === 'method-change'}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5" />
                <Label htmlFor="auto-index">Auto-index new media</Label>
              </div>
              <Switch
                id="auto-index"
                checked={settings.auto_index}
                onCheckedChange={handleAutoIndexToggle}
                disabled={actionLoading === 'auto-index'}
              />
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Data Store Management */}
        {settings && (settings.vertex_ai_enabled || settings.search_method === SearchMethod.VERTEX_AI) && (
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <Database className="w-6 h-6" />
                Vertex AI Data Store
              </GlassCardTitle>
              <GlassCardDescription>
                Manage your Vertex AI Search data store for advanced semantic search capabilities.
              </GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent className="space-y-4">
              {settings.data_store_info ? (
                <div className="space-y-4">
                  {/* Data Store Header with Name */}
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                        <Database className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{settings.data_store_info.display_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Data Store ID: <code className="bg-muted px-2 py-1 rounded text-xs">{settings.data_store_info.id}</code>
                        </p>
                      </div>
                    </div>
                    {settings.data_store_info.name && (
                      <div className="mt-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded border">
                        <Label className="text-xs font-medium text-muted-foreground">Full Resource Path</Label>
                        <p className="text-xs font-mono text-muted-foreground mt-1 break-all">{settings.data_store_info.name}</p>
                      </div>
                    )}
                  </div>

                  {/* Data Store Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                      <div className="font-semibold flex items-center gap-2 mt-1">
                        <Badge variant={settings.data_store_info.status === DataStoreStatus.ACTIVE ? 'default' : 'secondary'}>
                          {settings.data_store_info.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <Label className="text-sm font-medium text-muted-foreground">Documents Indexed</Label>
                      <p className="font-semibold text-2xl mt-1">{settings.data_store_info.document_count.toLocaleString()}</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                      <p className="font-semibold mt-1">
                        {settings.data_store_info.created_at 
                          ? new Date(settings.data_store_info.created_at).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Unknown'
                        }
                      </p>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="border-t pt-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={() => handleReindexMedia(false)}
                        disabled={actionLoading === 'reindex' || indexingStatus?.is_indexing}
                        className="flex-1 sm:flex-none"
                      >
                        {actionLoading === 'reindex' ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Reindex Media
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            disabled={actionLoading === 'delete-datastore'}
                            className="flex-1 sm:flex-none"
                          >
                            {actionLoading === 'delete-datastore' ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <Trash2 className="w-4 h-4 mr-2" />
                            )}
                            Delete Data Store
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-destructive" />
                              Delete Vertex AI Data Store
                            </AlertDialogTitle>
                            <AlertDialogDescription className="space-y-2">
                              <span className="block">
                                You are about to permanently delete the data store:
                              </span>
                              <span className="block p-3 bg-muted rounded border">
                                <span className="font-medium block">{settings.data_store_info.display_name}</span>
                                <span className="text-xs text-muted-foreground block mt-1">ID: {settings.data_store_info.id}</span>
                              </span>
                              <span className="text-sm block">
                                This will delete <strong>{settings.data_store_info.document_count.toLocaleString()} indexed documents</strong> and 
                                search will automatically switch to Firebase fallback. This action cannot be undone.
                              </span>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={handleDeleteDataStore}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Data Store
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Database className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Data Store Found</h3>
                  <p className="text-muted-foreground mb-4">
                    Create a Vertex AI data store to enable advanced semantic search.
                  </p>
                  <Button
                    onClick={() => handleCreateDataStore(false)}
                    disabled={actionLoading === 'create-datastore'}
                  >
                    {actionLoading === 'create-datastore' ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Create Data Store
                  </Button>
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        )}

        {/* Indexing Status */}
        {indexingStatus?.is_indexing && (
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle className="flex items-center gap-2">
                <Activity className="w-6 h-6" />
                Indexing in Progress
              </GlassCardTitle>
              <GlassCardDescription>
                Media content is being processed and indexed.
              </GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{indexingStatus.progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${indexingStatus.progress}%` }}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Items Processed</Label>
                  <p className="font-semibold">
                    {indexingStatus.items_processed.toLocaleString()} / {indexingStatus.total_items.toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Current Operation</Label>
                  <p className="font-semibold">{indexingStatus.current_operation || 'Processing...'}</p>
                </div>
              </div>
              
              {indexingStatus.estimated_completion && (
                <div className="text-sm">
                  <Label className="text-muted-foreground">Estimated Completion</Label>
                  <p className="font-semibold">
                    {new Date(indexingStatus.estimated_completion).toLocaleTimeString()}
                  </p>
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        )}

        {/* Search Statistics */}
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center gap-2">
              <BarChart3 className="w-6 h-6" />
              Search Statistics
            </GlassCardTitle>
            <GlassCardDescription>
              Usage metrics and performance data for your search functionality.
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg text-center">
                <TrendingUp className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold">{searchStats?.total_searches.toLocaleString() || 0}</p>
                <Label className="text-sm text-muted-foreground">Total Searches</Label>
              </div>
              
              <div className="p-4 border rounded-lg text-center">
                <Cloud className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{searchStats?.vertex_ai_searches.toLocaleString() || 0}</p>
                <Label className="text-sm text-muted-foreground">Vertex AI Searches</Label>
              </div>
              
              <div className="p-4 border rounded-lg text-center">
                <Database className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{searchStats?.firebase_searches.toLocaleString() || 0}</p>
                <Label className="text-sm text-muted-foreground">Firebase Searches</Label>
              </div>
              
              <div className="p-4 border rounded-lg text-center">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-2xl font-bold">{searchStats?.success_rate.toFixed(1) || 0}%</p>
                <Label className="text-sm text-muted-foreground">Success Rate</Label>
              </div>
            </div>

            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Firebase Document Count</Label>
                  <p className="text-lg font-semibold">{settings.firebase_document_count.toLocaleString()}</p>
                </div>
                {settings.last_sync && (
                  <div className="text-right">
                    <Label className="text-sm font-medium text-muted-foreground">Last Synced</Label>
                    <p className="text-sm">{new Date(settings.last_sync).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>
      </div>
    </PageTransition>
  );
}