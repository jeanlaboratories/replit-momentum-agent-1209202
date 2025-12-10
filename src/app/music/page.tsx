'use client';

import React, { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  generateMusicAction,
  getMusicAction,
  deleteMusicAction,
  getUserDisplayNamesAction,
} from '@/app/actions';
import { getAIModelSettingsAction } from '@/app/actions/ai-settings';
import { getBrandMembersAction } from '@/app/actions/team-management';
import { ErrorModal } from '@/components/ErrorModal';
import { Music } from '@/lib/types';
import { BrandMember } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { 
  Music2, 
  Loader2, 
  Trash2, 
  AlertTriangle, 
  Play, 
  Pause, 
  Volume2, 
  Download,
  Sparkles,
  Search,
  X,
  ArrowLeft,
  ChevronDown,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useJobQueue } from '@/contexts/job-queue-context';
import { ProgressToast, ProgressToastStatus } from '@/components/ui/progress-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PageTransition } from '@/components/ui/page-transition';

type Page = 'gallery' | 'generate' | 'error';
export const maxDuration = 300; // 5 minutes

function MusicPageContent() {
  const { user, loading: authLoading, brandId } = useAuth();
  const { toast } = useToast();
  const { addJob, startJob, setProgress, completeJob, failJob } = useJobQueue();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [page, setPage] = useState<Page>('gallery');
  const [music, setMusic] = useState<Music[]>([]);
  const [musicToDelete, setMusicToDelete] = useState<Music | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [userDisplayNames, setUserDisplayNames] = useState<{ [userId: string]: string }>({});
  const [brandMembers, setBrandMembers] = useState<BrandMember[]>([]);
  const [filters, setFilters] = useState<{ userId?: string; dateRange?: { start: string; end: string } }>({});
  const [generationProgress, setGenerationProgress] = useState<{
    open: boolean;
    status: ProgressToastStatus;
    title: string;
    description?: string;
  }>({
    open: false,
    status: 'loading',
    title: '',
    description: ''
  });

  // Generation form state
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [sampleCount, setSampleCount] = useState(1);
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [musicModel, setMusicModel] = useState<string>('lyria-002');
  const [examplesOpen, setExamplesOpen] = useState(true);

  // Audio playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredMusic, setFilteredMusic] = useState<Music[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const loadMusic = useCallback(async () => {
    if (!brandId) return;
    setInitialLoading(true);
    try {
      const [fetchedMusic, membersData] = await Promise.all([
        getMusicAction(brandId, filters),
        getBrandMembersAction(brandId)
      ]);

      setMusic(fetchedMusic);
      if (membersData.members) {
        setBrandMembers(membersData.members);
      }
        
      // Extract all unique user IDs from music
      const userIds = new Set<string>();
      fetchedMusic.forEach(track => {
        if (track.createdBy) userIds.add(track.createdBy);
      });
        
      // Fetch display names for all users
      if (userIds.size > 0) {
        const displayNames = await getUserDisplayNamesAction(Array.from(userIds));
        setUserDisplayNames(displayNames);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setInitialLoading(false);
    }
  }, [brandId, filters]);

  useEffect(() => {
    if (user && brandId) {
      loadMusic();
      // Load AI model settings to get configured music model
      getAIModelSettingsAction(brandId).then(settings => {
        setMusicModel(settings.musicModel || 'lyria-002');
      }).catch(err => {
        console.error('Failed to load AI model settings:', err);
        // Use default if loading fails
        setMusicModel('lyria-002');
      });
    }
  }, [loadMusic, user, brandId]);

  // Filter music based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMusic(music);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = music.filter(track => 
      track.prompt.toLowerCase().includes(query) ||
      (track.negative_prompt && track.negative_prompt.toLowerCase().includes(query))
    );
    setFilteredMusic(filtered);
  }, [searchQuery, music]);

  const handleGenerate = async () => {
    if (!brandId || !prompt.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a prompt to generate music',
      });
      return;
    }

    if (seed !== undefined && sampleCount > 1) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Seed and sample count cannot be used together',
      });
      return;
    }

    // Capture form values before clearing them
    const currentPrompt = prompt;
    const currentNegativePrompt = negativePrompt;
    const currentSampleCount = sampleCount;
    const currentSeed = seed;
    const currentMusicModel = musicModel;

    // Close modal immediately after validation
    setIsGenerateDialogOpen(false);
    setPrompt('');
    setNegativePrompt('');
    setSampleCount(1);
    setSeed(undefined);

    // Show starting toast
    toast({
      title: 'Generating Music',
      description: 'Your music generation has started. Check the Job Queue for progress.',
    });

    // Start generation in background - Job Queue will track progress
    try {
      const result = await generateMusicAction(
        brandId,
        currentPrompt,
        currentNegativePrompt || undefined,
        currentSampleCount,
        currentSeed,
        currentMusicModel
      );

      if (result.success && result.music) {
        // FORCE Job Queue to show completion immediately
        if (result.jobId) {
          completeJob(result.jobId, {
            resultUrl: result.music[0]?.url,
            progress: 100,
          });
        }
        
        // Refresh music gallery to show new tracks
        await loadMusic();
        
        // Job completion notification is handled by useGenerationTracking
      }
    } catch (error: any) {
      // Error handling is done by generateMusicAction and useGenerationTracking
      // No need to show additional error toast here
      console.error('Background music generation failed:', error);
    }
  };

  const handleDelete = async () => {
    if (!musicToDelete || !brandId) return;

    setIsDeleting(true);
    try {
      const result = await deleteMusicAction(brandId, musicToDelete.id);
      if (result.success) {
        await loadMusic();
        toast({
          title: 'Deleted',
          description: 'Music track deleted successfully',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'Failed to delete music',
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to delete music',
      });
    } finally {
      setIsDeleting(false);
      setMusicToDelete(null);
    }
  };

  const togglePlay = (track: Music) => {
    if (playingId === track.id) {
      // Pause current track
      const audio = audioElements.get(track.id);
      if (audio) {
        audio.pause();
      }
      setPlayingId(null);
    } else {
      // Stop any currently playing track
      if (playingId) {
        const currentAudio = audioElements.get(playingId);
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
      }

      // Play new track
      const audio = new Audio(track.url);
      audio.addEventListener('ended', () => {
        setPlayingId(null);
      });
      audio.play();
      setAudioElements(prev => new Map(prev).set(track.id, audio));
      setPlayingId(track.id);
    }
  };

  const handleDownload = (track: Music) => {
    const link = document.createElement('a');
    link.href = track.url;
    link.download = `${track.prompt.substring(0, 50).replace(/[^a-z0-9]/gi, '_')}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authLoading || !user) {
    return null;
  }

  const displayMusic = filteredMusic.length > 0 ? filteredMusic : music;

  return (
    <PageTransition className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Music2 className="h-8 w-8 text-primary" />
              Music Gallery
            </h1>
            <p className="text-muted-foreground">
              Generate and manage AI music with Lyria 2
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsGenerateDialogOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Music
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search music by prompt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {searchQuery && (
          <Badge variant="secondary">
            {filteredMusic.length} result{filteredMusic.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Music Grid */}
      {initialLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : displayMusic.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Music2 className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No music yet</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery ? 'No music found matching your search.' : 'Start generating beautiful music with AI.'}
          </p>
          {!searchQuery && (
            <Button onClick={() => setIsGenerateDialogOpen(true)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Your First Track
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayMusic.map((track) => (
            <div
              key={track.id}
              className="group relative bg-card border rounded-lg p-4 hover:shadow-lg transition-all duration-200"
            >
              {/* Audio Player */}
              <div className="aspect-square bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-16 w-16 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background shadow-lg z-10"
                  onClick={() => togglePlay(track)}
                >
                  {playingId === track.id ? (
                    <Pause className="h-8 w-8" />
                  ) : (
                    <Play className="h-8 w-8 ml-1" />
                  )}
                </Button>
                {playingId === track.id && (
                  <div className="absolute bottom-2 left-2 right-2">
                    <div className="h-1 bg-background/20 rounded-full overflow-hidden">
                      <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Track Info */}
              <div className="space-y-2">
                <h3 className="font-semibold line-clamp-2 text-sm">
                  {track.prompt}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Music2 className="h-3 w-3" />
                  <span>{track.duration}s • {track.sampleRate / 1000}kHz</span>
                </div>
                {track.createdBy && userDisplayNames[track.createdBy] && (
                  <p className="text-xs text-muted-foreground">
                    by {userDisplayNames[track.createdBy]}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDownload(track)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setMusicToDelete(track)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generate Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Generate Music with Lyria 2
            </DialogTitle>
            <DialogDescription>
              Create high-fidelity 30-second audio tracks from text prompts
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* One-Click Examples - Collapsible */}
            <Collapsible open={examplesOpen} onOpenChange={setExamplesOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between p-0 h-auto font-semibold text-foreground hover:bg-transparent"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>One-Click Examples</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${examplesOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg p-4 border border-purple-500/20 mt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-left justify-start h-auto py-2.5 px-3 bg-background/80 hover:bg-background hover:border-purple-500/50 hover:shadow-sm transition-all group"
                      onClick={() => {
                        setPrompt("Smooth, atmospheric jazz. Moderate tempo, rich harmonies. Featuring mellow brass");
                        setNegativePrompt("");
                      }}
                    >
                      <span className="text-xs font-medium text-foreground group-hover:text-purple-600 transition-colors">🎷 Smooth Jazz</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-left justify-start h-auto py-2.5 px-3 bg-background/80 hover:bg-background hover:border-purple-500/50 hover:shadow-sm transition-all group"
                      onClick={() => {
                        setPrompt("Dramatic orchestral symphony with powerful strings and epic brass sections");
                        setNegativePrompt("");
                      }}
                    >
                      <span className="text-xs font-medium text-foreground group-hover:text-purple-600 transition-colors">🎻 Epic Symphony</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-left justify-start h-auto py-2.5 px-3 bg-background/80 hover:bg-background hover:border-purple-500/50 hover:shadow-sm transition-all group"
                      onClick={() => {
                        setPrompt("Upbeat electronic dance music with synthesizers and driving bass");
                        setNegativePrompt("slow, quiet");
                      }}
                    >
                      <span className="text-xs font-medium text-foreground group-hover:text-purple-600 transition-colors">🎹 Electronic Dance</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-left justify-start h-auto py-2.5 px-3 bg-background/80 hover:bg-background hover:border-purple-500/50 hover:shadow-sm transition-all group"
                      onClick={() => {
                        setPrompt("Acoustic guitar melody with a fast tempo and fingerpicking");
                        setNegativePrompt("");
                      }}
                    >
                      <span className="text-xs font-medium text-foreground group-hover:text-purple-600 transition-colors">🎸 Acoustic Guitar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-left justify-start h-auto py-2.5 px-3 bg-background/80 hover:bg-background hover:border-purple-500/50 hover:shadow-sm transition-all group"
                      onClick={() => {
                        setPrompt("Calm ambient soundscape with ethereal pads and gentle textures");
                        setNegativePrompt("loud, aggressive");
                      }}
                    >
                      <span className="text-xs font-medium text-foreground group-hover:text-purple-600 transition-colors">🌊 Ambient Soundscape</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-left justify-start h-auto py-2.5 px-3 bg-background/80 hover:bg-background hover:border-purple-500/50 hover:shadow-sm transition-all group"
                      onClick={() => {
                        setPrompt("Energetic rock anthem with electric guitars and powerful drums");
                        setNegativePrompt("soft, gentle");
                      }}
                    >
                      <span className="text-xs font-medium text-foreground group-hover:text-purple-600 transition-colors">🎸 Rock Anthem</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-left justify-start h-auto py-2.5 px-3 bg-background/80 hover:bg-background hover:border-purple-500/50 hover:shadow-sm transition-all group"
                      onClick={() => {
                        setPrompt("Cinematic film score with emotional strings and subtle piano");
                        setNegativePrompt("");
                      }}
                    >
                      <span className="text-xs font-medium text-foreground group-hover:text-purple-600 transition-colors">🎬 Cinematic Score</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-left justify-start h-auto py-2.5 px-3 bg-background/80 hover:bg-background hover:border-purple-500/50 hover:shadow-sm transition-all group"
                      onClick={() => {
                        setPrompt("Lofi hip hop beat with smooth jazz samples and vinyl crackle");
                        setNegativePrompt("fast, aggressive");
                      }}
                    >
                      <span className="text-xs font-medium text-foreground group-hover:text-purple-600 transition-colors">🎧 Lofi Hip Hop</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-left justify-start h-auto py-2.5 px-3 bg-background/80 hover:bg-background hover:border-purple-500/50 hover:shadow-sm transition-all group"
                      onClick={() => {
                        setPrompt("Classical piano piece with delicate melodies and rich harmonies");
                        setNegativePrompt("");
                      }}
                    >
                      <span className="text-xs font-medium text-foreground group-hover:text-purple-600 transition-colors">🎹 Classical Piano</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-left justify-start h-auto py-2.5 px-3 bg-background/80 hover:bg-background hover:border-purple-500/50 hover:shadow-sm transition-all group"
                      onClick={() => {
                        setPrompt("Tropical house music with steel drums and upbeat rhythms");
                        setNegativePrompt("dark, moody");
                      }}
                    >
                      <span className="text-xs font-medium text-foreground group-hover:text-purple-600 transition-colors">🏝️ Tropical House</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-left justify-start h-auto py-2.5 px-3 bg-background/80 hover:bg-background hover:border-purple-500/50 hover:shadow-sm transition-all group"
                      onClick={() => {
                        setPrompt("Blues guitar with soulful vocals and harmonica");
                        setNegativePrompt("");
                      }}
                    >
                      <span className="text-xs font-medium text-foreground group-hover:text-purple-600 transition-colors">🎵 Blues Guitar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-left justify-start h-auto py-2.5 px-3 bg-background/80 hover:bg-background hover:border-purple-500/50 hover:shadow-sm transition-all group"
                      onClick={() => {
                        setPrompt("Meditative zen music with Tibetan singing bowls and nature sounds");
                        setNegativePrompt("loud, fast");
                      }}
                    >
                      <span className="text-xs font-medium text-foreground group-hover:text-purple-600 transition-colors">🧘 Zen Meditation</span>
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt *</Label>
              <Textarea
                id="prompt"
                placeholder="e.g., Smooth, atmospheric jazz. Moderate tempo, rich harmonies. Featuring mellow brass"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Describe the music you want to generate (style, mood, tempo, instruments)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="negative-prompt">Negative Prompt (Optional)</Label>
              <Input
                id="negative-prompt"
                placeholder="e.g., fast, loud, aggressive"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Describe what to exclude from the generated audio
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sample-count">Sample Count</Label>
                <Select
                  value={seed !== undefined ? 'seed' : sampleCount.toString()}
                  onValueChange={(value) => {
                    if (value === 'seed') {
                      setSeed(111);
                      setSampleCount(1);
                    } else {
                      setSeed(undefined);
                      setSampleCount(parseInt(value));
                    }
                  }}
                >
                  <SelectTrigger id="sample-count">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 sample</SelectItem>
                    <SelectItem value="2">2 samples</SelectItem>
                    <SelectItem value="3">3 samples</SelectItem>
                    <SelectItem value="4">4 samples</SelectItem>
                    <SelectItem value="seed">Use seed (deterministic)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Number of variations to generate
                </p>
              </div>

              {seed !== undefined && (
                <div className="space-y-2">
                  <Label htmlFor="seed">Seed</Label>
                  <Input
                    id="seed"
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(parseInt(e.target.value) || undefined)}
                    placeholder="e.g., 111"
                  />
                  <p className="text-xs text-muted-foreground">
                    For reproducible results
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsGenerateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim()}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Music
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!musicToDelete} onOpenChange={(open) => !open && setMusicToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Music Track</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this music track? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Modal */}
      {errorMessages.length > 0 && (
        <ErrorModal
          errors={errorMessages}
          onClose={() => setErrorMessages([])}
        />
      )}
    </PageTransition>
  );
}

export default function MusicPage() {
  return (
    <Suspense fallback={
      <div className="container py-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <MusicPageContent />
    </Suspense>
  );
}

