
import React, {useState, useRef} from 'react';
import {Video} from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Upload, X, Video as VideoIcon, Sparkles, Image as ImageIcon, User, Film, Zap, Images } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditVideoPageProps {
  video: Video;
  onSave: (updatedVideo: Video, inputs?: {
    imageUrl?: string;
    characterReferenceUrl?: string;
    startFrameUrl?: string;
    endFrameUrl?: string;
    resolution?: '720p' | '1080p';
    durationSeconds?: 4 | 6 | 8;
    personGeneration?: string;
    videoUrl?: string;
    referenceImages?: string[];
    useFastModel?: boolean;
  }) => void;
  onCancel: () => void;
}

export const EditVideoPage: React.FC<EditVideoPageProps> = ({
  video,
  onSave,
  onCancel,
}) => {
  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description);

  // File states
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedCharRef, setSelectedCharRef] = useState<string | null>(null);
  const [selectedStartFrame, setSelectedStartFrame] = useState<string | null>(null);
  const [selectedEndFrame, setSelectedEndFrame] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedRefImages, setSelectedRefImages] = useState<string[]>([]);

  // New Veo 3.1 parameters
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [durationSeconds, setDurationSeconds] = useState<4 | 6 | 8>(4);
  const [personGeneration, setPersonGeneration] = useState<boolean>(false);
  const [useFastModel, setUseFastModel] = useState<boolean>(false);

  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const charRefInputRef = useRef<HTMLInputElement>(null);
  const startFrameInputRef = useRef<HTMLInputElement>(null);
  const endFrameInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const refImagesInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, setFile: (val: string | null) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMultipleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const maxFiles = 3 - selectedRefImages.length;
      const filesToProcess = files.slice(0, maxFiles);

      Promise.all(
        filesToProcess.map(file => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        })
      ).then(newImages => {
        setSelectedRefImages(prev => [...prev, ...newImages]);
      });
    }
  };

  const removeRefImage = (index: number) => {
    setSelectedRefImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const inputs = {
      imageUrl: selectedImage || undefined,
      characterReferenceUrl: selectedCharRef || undefined,
      startFrameUrl: selectedStartFrame || undefined,
      endFrameUrl: selectedEndFrame || undefined,
      resolution: resolution,
      durationSeconds: durationSeconds,
      personGeneration: personGeneration ? 'allow_all' : undefined,
      videoUrl: selectedVideo || undefined,
      referenceImages: selectedRefImages.length > 0 ? selectedRefImages : undefined,
      useFastModel: useFastModel,
    };
    onSave({ ...video, title, description }, inputs);
  };

  const renderImageUpload = (
    label: string,
    icon: React.ReactNode,
    image: string | null,
    setImage: (val: string | null) => void,
    inputRef: React.RefObject<HTMLInputElement>,
    description?: string
  ) => (
    <div className="group relative">
      <div
        onClick={() => !image && inputRef.current?.click()}
        className={cn(
          "relative h-32 w-full rounded-xl border-2 border-dashed transition-all duration-200 overflow-hidden",
          image ? "border-transparent" : "border-gray-700 hover:border-purple-500/50 hover:bg-gray-800/50 cursor-pointer"
        )}
      >
        {image ? (
          <>
            <img src={image} alt="Preview" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setImage(null);
                }}
                className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-sm transition-transform hover:scale-110"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 group-hover:text-purple-400">
            <div className="mb-2 p-2 rounded-full bg-gray-800/50 group-hover:bg-purple-500/10 transition-colors">
              {icon}
            </div>
            <span className="text-xs font-medium">{label}</span>
          </div>
        )}
        <input
          type="file"
          ref={inputRef}
          className="hidden"
          accept="image/*"
          onChange={(e) => handleFileSelect(e, setImage)}
        />
      </div>
      {description && <p className="mt-1.5 text-[10px] text-gray-500 text-center">{description}</p>}
    </div>
  );

  const isFormValid = () => {
    return title.trim().length > 0 && description.trim().length > 0;
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-5xl bg-background/90 border-border/50 text-foreground shadow-2xl max-h-[90vh] flex flex-col overflow-hidden backdrop-blur-xl">

        {/* Header */}
        <div className="p-6 border-b border-border/50 flex-shrink-0 bg-muted/20 backdrop-blur-xl z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <VideoIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground font-headline">
                Generate Video with Veo 3.1
              </h1>
              <p className="text-sm text-muted-foreground">Create cinematic videos using advanced AI controls</p>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* Left Column: Creative Details */}
            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-4">
                        <div className="space-y-2">
                  <Label htmlFor="title" className="text-foreground">Project Title</Label>
                            <Input
                                id="title"
                    className="bg-muted/30 border-border/50 text-foreground focus:border-primary focus:ring-primary/20 h-11 placeholder:text-muted-foreground"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Cyberpunk City Chase"
                            />
                        </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-foreground">
                    Prompt & Direction
                  </Label>
                            <Textarea
                                id="description"
                    rows={8}
                    className="bg-muted/30 border-border/50 text-foreground focus:border-primary focus:ring-primary/20 resize-none leading-relaxed placeholder:text-muted-foreground"
                    placeholder="Describe your scene in detail. Include camera movements, lighting, style, and action..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                  <p className="text-xs text-muted-foreground text-right">
                    {description.length} characters
                  </p>
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Advanced Settings
                </h3>

                {/* Resolution and Duration */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="resolution" className="text-foreground text-xs">Resolution</Label>
                    <Select value={resolution} onValueChange={(val) => setResolution(val as '720p' | '1080p')}>
                      <SelectTrigger className="bg-muted/30 border-border/50 text-foreground h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="720p">720p</SelectItem>
                        <SelectItem value="1080p">1080p (8s only)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration" className="text-foreground text-xs">Duration</Label>
                    <Select value={String(durationSeconds)} onValueChange={(val) => setDurationSeconds(Number(val) as 4 | 6 | 8)}>
                      <SelectTrigger className="bg-muted/30 border-border/50 text-foreground h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">4 seconds</SelectItem>
                        <SelectItem value="6">6 seconds</SelectItem>
                        <SelectItem value="8">8 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Switches */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      <Label htmlFor="personGeneration" className="text-foreground text-sm cursor-pointer">
                        Allow People in Video
                      </Label>
                    </div>
                    <Switch
                      id="personGeneration"
                      checked={personGeneration}
                      onCheckedChange={setPersonGeneration}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-400" />
                      <Label htmlFor="fastModel" className="text-foreground text-sm cursor-pointer">
                        Fast Model (Veo 3.1 Fast)
                      </Label>
                    </div>
                    <Switch
                      id="fastModel"
                      checked={useFastModel}
                      onCheckedChange={setUseFastModel}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-gradient-to-br from-primary/10 to-purple-600/10 border border-primary/20 p-4">
                <div className="flex gap-3">
                  <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-foreground">Pro Tip</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Combine inputs for precise control! Use a <strong>Character Reference</strong> with a text prompt to place your character in any scenario, or animate a specific <strong>Source Image</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Magic Inputs */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Magic Inputs
                </h3>
                <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                  Optional
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Source Image */}
                <div className="col-span-1 bg-muted/30 rounded-xl p-4 border border-border/50 hover:border-border transition-colors">
                  <h4 className="text-sm font-medium text-blue-400 mb-3 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" /> Source Image
                  </h4>
                  {renderImageUpload(
                    "Upload Image",
                    <ImageIcon className="h-5 w-5" />,
                    selectedImage,
                    setSelectedImage,
                    imageInputRef,
                    "Animates this static image"
                  )}
                </div>

                {/* Character Reference */}
                <div className="col-span-1 bg-muted/30 rounded-xl p-4 border border-border/50 hover:border-border transition-colors">
                  <h4 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" /> Character Ref
                  </h4>
                  {renderImageUpload(
                    "Upload Character",
                    <User className="h-5 w-5" />,
                    selectedCharRef,
                    setSelectedCharRef,
                    charRefInputRef,
                    "Maintains character consistency"
                  )}
                </div>

                {/* Frames */}
                <div className="col-span-2 bg-muted/30 rounded-xl p-4 border border-border/50 hover:border-border transition-colors">
                  <h4 className="text-sm font-medium text-orange-400 mb-3 flex items-center gap-2">
                    <Film className="h-4 w-4" /> Transition Frames
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {renderImageUpload(
                      "Start Frame",
                      <Film className="h-5 w-5" />,
                      selectedStartFrame,
                      setSelectedStartFrame,
                      startFrameInputRef,
                      "Video starts here"
                    )}
                    {renderImageUpload(
                      "End Frame",
                      <Film className="h-5 w-5" />,
                      selectedEndFrame,
                      setSelectedEndFrame,
                      endFrameInputRef,
                      "Video ends here"
                    )}
                  </div>
                </div>

                {/* Video Extension */}
                <div className="col-span-2 bg-muted/30 rounded-xl p-4 border border-border/50 hover:border-border transition-colors">
                  <h4 className="text-sm font-medium text-purple-400 mb-3 flex items-center gap-2">
                    <VideoIcon className="h-4 w-4" /> Video Extension
                  </h4>
                  <div
                    onClick={() => !selectedVideo && videoInputRef.current?.click()}
                    className={cn(
                      "relative h-32 w-full rounded-xl border-2 border-dashed transition-all duration-200 overflow-hidden",
                      selectedVideo ? "border-transparent" : "border-gray-700 hover:border-purple-500/50 hover:bg-gray-800/50 cursor-pointer"
                    )}
                  >
                    {selectedVideo ? (
                      <>
                        <video src={selectedVideo} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVideo(null);
                            }}
                            className="bg-red-500/80 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-sm transition-transform hover:scale-110"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 hover:text-purple-400">
                        <div className="mb-2 p-2 rounded-full bg-gray-800/50 hover:bg-purple-500/10 transition-colors">
                          <VideoIcon className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-medium">Upload Video to Extend</span>
                      </div>
                    )}
                    <input
                      type="file"
                      ref={videoInputRef}
                      className="hidden"
                      accept="video/*"
                      onChange={(e) => handleFileSelect(e, setSelectedVideo)}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-gray-500 text-center">Extends video by up to 7 seconds</p>
                </div>

                {/* Reference Images */}
                <div className="col-span-2 bg-muted/30 rounded-xl p-4 border border-border/50 hover:border-border transition-colors">
                  <h4 className="text-sm font-medium text-cyan-400 mb-3 flex items-center gap-2">
                    <Images className="h-4 w-4" /> Reference Images (up to 3)
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      {selectedRefImages.map((img, idx) => (
                        <div key={idx} className="relative group">
                          <img src={img} alt={`Reference ${idx + 1}`} className="h-24 w-full object-cover rounded-lg" />
                          <button
                            onClick={() => removeRefImage(idx)}
                            className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {selectedRefImages.length < 3 && (
                        <div
                          onClick={() => refImagesInputRef.current?.click()}
                          className="h-24 rounded-lg border-2 border-dashed border-gray-700 hover:border-cyan-500/50 hover:bg-gray-800/50 cursor-pointer transition-all flex flex-col items-center justify-center text-gray-500 hover:text-cyan-400"
                        >
                          <Upload className="h-4 w-4 mb-1" />
                          <span className="text-[10px]">Add Image</span>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      ref={refImagesInputRef}
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={handleMultipleFileSelect}
                    />
                    <p className="text-[10px] text-gray-500 text-center">Guide video content with asset images</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border/50 bg-muted/20 backdrop-blur-xl flex justify-between items-center flex-shrink-0">
          <Button 
            variant="ghost"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Cancel
          </Button>
          <div className="flex items-center gap-4">
            <div className="text-xs text-muted-foreground hidden sm:block">
              Estimated time: <span className="text-foreground">2-4 mins</span>
            </div>
                <Button 
                    onClick={handleSave}
              disabled={!isFormValid()}
              className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white px-8 py-2 h-11 rounded-lg shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
              <Sparkles className="h-4 w-4 mr-2" />
                    Generate Video
                </Button>
          </div>
        </div>

      </Card>
    </div>
  );
};
