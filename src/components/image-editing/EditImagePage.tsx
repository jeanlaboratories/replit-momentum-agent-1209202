
import React, { useState, useRef } from 'react';
import { EditedImage } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, X, Wand2, Image as ImageIcon, Layers } from 'lucide-react';
import NextImage from 'next/image';
import { cn } from '@/lib/utils';

interface EditImagePageProps {
  image: EditedImage;
  initialMaskUrl?: string; // For restoring mask image from persisted state
  onSave: (updatedImage: EditedImage, options?: {
    maskUrl?: string;
  }) => void;
  onCancel: () => void;
}

export const EditImagePage: React.FC<EditImagePageProps> = ({
  image,
  initialMaskUrl,
  onSave,
  onCancel,
}) => {
  const [title, setTitle] = useState(image.title);
  const [prompt, setPrompt] = useState(image.prompt);
  const [sourceImageUrl, setSourceImageUrl] = useState(image.sourceImageUrl);
  const [additionalImageUrls, setAdditionalImageUrls] = useState<string[]>(image.additionalImageUrls || []);
  const [maskUrl, setMaskUrl] = useState<string>(initialMaskUrl || '');
  // Determine initial tab based on persisted data
  const getInitialTab = (): 'edit' | 'fusion' | 'mask' => {
    if (initialMaskUrl) return 'mask';
    if (image.additionalImageUrls && image.additionalImageUrls.length > 0) return 'fusion';
    return 'edit';
  };
  const [activeTab, setActiveTab] = useState<'edit' | 'fusion' | 'mask'>(getInitialTab());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const additionalFileInputRef = useRef<HTMLInputElement>(null);
  const maskInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    onSave(
      { ...image, title, prompt, sourceImageUrl, additionalImageUrls },
      {
        maskUrl: maskUrl || undefined
      }
    );
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSourceImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleAdditionalFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            setAdditionalImageUrls(prev => [...prev, reader.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
    // Reset input
    if (additionalFileInputRef.current) {
      additionalFileInputRef.current.value = '';
    }
  };

  const handleClearImage = () => {
    setSourceImageUrl('');
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  }

  const handleRemoveAdditionalImage = (index: number) => {
    setAdditionalImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleMaskFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMaskUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearMask = () => {
    setMaskUrl('');
    if (maskInputRef.current) {
      maskInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto flex flex-col p-0 gap-0 bg-background/80 backdrop-blur-xl border-border/50 shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-2xl font-headline text-foreground">
            <Wand2 className="h-6 w-6 text-primary" />
            AI Image Studio
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Transform your images with AI. Choose a mode below to get started.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-foreground">Project Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Cyberpunk Cityscape"
                className="text-lg font-medium bg-muted/30 border-border/50 text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'edit' | 'fusion' | 'mask')} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6 bg-muted/50">
                <TabsTrigger value="edit" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
                  <ImageIcon className="h-4 w-4" />
                  Edit & Transform
                </TabsTrigger>
                <TabsTrigger value="fusion" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
                  <Layers className="h-4 w-4" />
                  Image Fusion
                </TabsTrigger>
                <TabsTrigger value="mask" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
                  <Wand2 className="h-4 w-4" />
                  Mask Editing
                </TabsTrigger>
              </TabsList>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Main Source
                    </Label>
                    <div
                      className={cn(
                        "relative aspect-video rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center overflow-hidden group",
                        sourceImageUrl
                          ? "border-primary/20 bg-muted/10"
                          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20 cursor-pointer"
                      )}
                      onClick={() => !sourceImageUrl && fileInputRef.current?.click()}
                    >
                      {sourceImageUrl ? (
                        <>
                          <NextImage src={sourceImageUrl} alt="Source" fill className="object-contain p-2" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                              Change
                            </Button>
                            <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); handleClearImage(); }}>
                              Remove
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-6">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 text-primary">
                            <Upload className="h-6 w-6" />
                          </div>
                          <p className="font-medium text-foreground">Click to upload</p>
                          <p className="text-sm text-muted-foreground mt-1">or drag and drop</p>
                        </div>
                      )}
                      <Input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileChange}
                        accept="image/*"
                      />
                    </div>
                  </div>

                  <TabsContent value="fusion" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Fusion Sources
                      </Label>
                      <div className="grid grid-cols-3 gap-3">
                        {additionalImageUrls.map((url, index) => (
                          <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                            <NextImage src={url} alt={`Fusion ${index}`} fill className="object-cover" />
                            <button
                              onClick={() => handleRemoveAdditionalImage(index)}
                              className="absolute top-1 right-1 bg-black/60 hover:bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20 flex flex-col items-center justify-center transition-all"
                          onClick={() => additionalFileInputRef.current?.click()}
                        >
                          <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                          <span className="text-xs text-muted-foreground">Add</span>
                        </button>
                      </div>
                      <Input
                        type="file"
                        ref={additionalFileInputRef}
                        className="hidden"
                        onChange={handleAdditionalFileChange}
                        accept="image/*"
                        multiple
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="mask" className="mt-0 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Mask Image
                      </Label>
                      <div
                        className={cn(
                          "relative aspect-video rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center overflow-hidden group",
                          maskUrl
                            ? "border-amber-500/20 bg-amber-500/5"
                            : "border-muted-foreground/25 hover:border-amber-500/50 hover:bg-muted/20 cursor-pointer"
                        )}
                        onClick={() => !maskUrl && maskInputRef.current?.click()}
                      >
                        {maskUrl ? (
                          <>
                            <NextImage src={maskUrl} alt="Mask" fill className="object-contain p-2" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); maskInputRef.current?.click(); }}>
                                Change
                              </Button>
                              <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); handleClearMask(); }}>
                                Remove
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="text-center p-6">
                            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-3 text-amber-500">
                              <Upload className="h-6 w-6" />
                            </div>
                            <p className="font-medium text-foreground">Upload mask image</p>
                            <p className="text-sm text-muted-foreground mt-1">Black areas will be replaced</p>
                          </div>
                        )}
                        <Input
                          type="file"
                          ref={maskInputRef}
                          className="hidden"
                          onChange={handleMaskFileChange}
                          accept="image/*"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Upload a mask where black areas indicate regions to replace. White areas will be preserved.
                      </p>
                    </div>
                  </TabsContent>
                </div>

                <div className="space-y-4 flex flex-col">
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="prompt" className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Prompt
                    </Label>
                    <Textarea
                      id="prompt"
                      className="min-h-[200px] resize-none text-lg leading-relaxed bg-muted/30 focus:bg-background transition-colors p-4 border-border/50 text-foreground placeholder:text-muted-foreground"
                      placeholder={
                        activeTab === 'edit'
                          ? "Describe how you want to change the image... (e.g., 'Make it look like a watercolor painting', 'Add a futuristic neon glow')"
                          : activeTab === 'fusion'
                          ? "Describe how these images should be fused together..."
                          : "Describe what to add in the masked regions... (e.g., 'Replace with a sunset sky', 'Add a sports car')"
                      }
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                    />
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {['Cyberpunk style', 'Watercolor painting', 'Pencil sketch', 'Oil painting', 'Cinematic lighting'].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => setPrompt(prev => prev ? `${prev}, ${suggestion}` : suggestion)}
                          className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors whitespace-nowrap border border-primary/20"
                        >
                          + {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Tabs>
          </div>
        </div>

        <DialogFooter className="p-6 pt-4 border-t border-border/50 bg-muted/20">
          <Button variant="ghost" onClick={onCancel} className="hover:bg-muted/50 text-muted-foreground hover:text-foreground">
            Cancel
          </Button>
          <Button onClick={handleSave} size="lg" className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg hover:shadow-primary/25 transition-all duration-300 text-white">
            <Wand2 className="mr-2 h-5 w-5" />
            Generate Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};