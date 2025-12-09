import React, { useState } from 'react';
import { EditedImage } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Palette, Sparkles, ImageIcon, Users } from 'lucide-react';

interface ImageGenerationPageProps {
  image: EditedImage;
  onSave: (updatedImage: EditedImage, options?: {
    aspectRatio?: string;
    numberOfImages?: number;
    personGeneration?: string;
  }) => void;
  onCancel: () => void;
}

export const ImageGenerationPage: React.FC<ImageGenerationPageProps> = ({
  image,
  onSave,
  onCancel,
}) => {
  const [title, setTitle] = useState(image.title);
  const [prompt, setPrompt] = useState(image.prompt);

  // New Imagen 4.0 parameters
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [numberOfImages, setNumberOfImages] = useState<number>(1);
  const [personGeneration, setPersonGeneration] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const handleSave = () => {
    onSave(
      { ...image, title, prompt },
      {
        aspectRatio,
        numberOfImages,
        personGeneration: personGeneration ? 'allow_all' : undefined,
      }
    );
  };

  const canGenerate = prompt.trim().length > 0 && title.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-background/80 z-50 flex items-start sm:items-center justify-center animate-fade-in backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl my-2 sm:my-8">
        <Card className="bg-background/90 text-foreground shadow-2xl border border-border/50 backdrop-blur-xl">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
            <h1 className="text-lg font-semibold text-foreground flex items-center gap-2 font-headline">
              <Palette className="w-5 h-5 text-primary" />
              Generate AI Image with Imagen 4.0
            </h1>
          </div>

          {/* Content */}
          <div className="px-4 py-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-foreground font-medium text-sm">Title</Label>
                <Input
                  id="title"
                  placeholder="My awesome image"
                  className="bg-muted/30 border-border/50 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <Label htmlFor="prompt" className="text-foreground font-medium text-sm">
                  Describe Your Image
                </Label>
                <Textarea
                  id="prompt"
                  placeholder="A serene mountain landscape at sunset with vibrant orange and purple clouds reflected in a crystal-clear lake..."
                  className="bg-muted/30 border-border/50 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary/20 min-h-[120px] resize-none"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Be specific for best results. Include style, colors, mood details.
                </p>
              </div>

              {/* Advanced Settings Toggle */}
              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/50">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <Label htmlFor="advanced-toggle" className="text-sm font-medium cursor-pointer">
                    Advanced Settings
                  </Label>
                </div>
                <Switch
                  id="advanced-toggle"
                  checked={showAdvanced}
                  onCheckedChange={setShowAdvanced}
                />
              </div>

              {/* Advanced Settings */}
              {showAdvanced && (
                <div className="space-y-4 p-4 bg-muted/10 rounded-lg border border-border/30">
                  {/* Aspect Ratio */}
                  <div className="space-y-2">
                    <Label htmlFor="aspect-ratio" className="text-sm font-medium flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-blue-400" />
                      Aspect Ratio
                    </Label>
                    <Select value={aspectRatio} onValueChange={setAspectRatio}>
                      <SelectTrigger className="bg-muted/30 border-border/50">
                        <SelectValue placeholder="Select aspect ratio" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1:1">1:1 (Square)</SelectItem>
                        <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                        <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                        <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                        <SelectItem value="3:4">3:4 (Portrait)</SelectItem>
                        <SelectItem value="3:2">3:2 (Photo)</SelectItem>
                        <SelectItem value="2:3">2:3 (Portrait Photo)</SelectItem>
                        <SelectItem value="21:9">21:9 (Ultrawide)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Choose the shape and orientation of your image
                    </p>
                  </div>

                  {/* Number of Images */}
                  <div className="space-y-2">
                    <Label htmlFor="num-images" className="text-sm font-medium">
                      Number of Images: {numberOfImages}
                    </Label>
                    <Slider
                      id="num-images"
                      min={1}
                      max={4}
                      step={1}
                      value={[numberOfImages]}
                      onValueChange={(value) => setNumberOfImages(value[0])}
                      className="py-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      Generate multiple variations at once (1-4 images)
                    </p>
                  </div>

                  {/* Person Generation */}
                  <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/30">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-400" />
                      <div>
                        <Label htmlFor="person-gen" className="text-sm font-medium cursor-pointer">
                          Allow People in Images
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Enable generation of human figures
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="person-gen"
                      checked={personGeneration}
                      onCheckedChange={setPersonGeneration}
                    />
                  </div>
                </div>
              )}

              {/* Inspiration examples */}
              <div className="bg-muted/20 rounded-lg p-3 border border-border/50">
                <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Try these examples
                </h3>
                <div className="space-y-2 text-xs">
                  <button
                    onClick={() => setPrompt("A futuristic city skyline at night with neon lights reflecting on wet streets, cyberpunk style")}
                    className="w-full text-left p-2 bg-muted/50 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    Futuristic cyberpunk city at night
                  </button>
                  <button
                    onClick={() => setPrompt("A cozy coffee shop interior with warm lighting, wooden furniture, and people working on laptops")}
                    className="w-full text-left p-2 bg-muted/50 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    Cozy coffee shop with warm lighting
                  </button>
                  <button
                    onClick={() => setPrompt("A magical forest with glowing mushrooms and ethereal light filtering through ancient trees")}
                    className="w-full text-left p-2 bg-muted/50 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    Magical forest with glowing mushrooms
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer with action buttons */}
          <div className="px-4 py-3 border-t border-border/50 bg-muted/20 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              className="bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!canGenerate}
              className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Palette className="mr-2 h-4 w-4" />
              Generate {numberOfImages > 1 ? `${numberOfImages} Images` : 'Image'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
