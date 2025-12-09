
'use client';

import { useState, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ContentBlock, EditedImage, Video, CampaignTimeline, CampaignDay } from '@/lib/types';
import { Trash2, Film, ImageIcon as ImageIconLucide, X, Check, Clock, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import NextImage from 'next/image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { getImagesAction, getVideosAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { useAuth } from '@/hooks/use-auth';

interface ContentBlockEditorProps {
  day: CampaignDay;
  block: ContentBlock;
  setCampaignTimeline: React.Dispatch<React.SetStateAction<CampaignTimeline>>;
}

const ContentBlockEditor = memo(function ContentBlockEditor({
  day,
  block,
  setCampaignTimeline,
}: ContentBlockEditorProps) {
  const [isMediaSelectorOpen, setIsMediaSelectorOpen] = useState(false);
  const [availableMedia, setAvailableMedia] = useState<{images: EditedImage[], videos: Video[]}>({images: [], videos: []});
  const [mediaLoading, setMediaLoading] = useState(false);
  const { toast } = useToast();
  const { brandId } = useAuth();

  const onUpdate = useCallback((updatedBlock: Partial<ContentBlock>) => {
    setCampaignTimeline(prevTimeline => 
        prevTimeline.map(d => {
            if (d.id === day.id) {
                const newBlocks = d.contentBlocks.map(b => {
                    if (b.id === block.id) {
                        return {...b, ...updatedBlock};
                    }
                    return b;
                });
                return {...d, contentBlocks: newBlocks};
            }
            return d;
        })
    );
  }, [setCampaignTimeline, day.id, block.id]);
  
  const onRemove = useCallback(() => {
     setCampaignTimeline(prevTimeline => 
        prevTimeline.map(d => {
            if (d.id === day.id) {
                return {...d, contentBlocks: d.contentBlocks.filter(b => b.id !== block.id)};
            }
            return d;
        })
    );
  }, [setCampaignTimeline, day.id, block.id]);

  const openMediaSelector = async () => {
    if (!brandId) return;
    setMediaLoading(true);
    setIsMediaSelectorOpen(true);
    try {
        const [images, videos] = await Promise.all([getImagesAction(brandId), getVideosAction(brandId)]);
        setAvailableMedia({ images, videos });
    } catch(e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load media galleries.'})
    } finally {
        setMediaLoading(false);
    }
  }


  const handleSelectMedia = (url: string) => {
    onUpdate({ assetUrl: url, imageUrl: url });
    setIsMediaSelectorOpen(false);
  };

  const handleRemoveMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate({ assetUrl: undefined, imageUrl: undefined });
  };

  const currentMediaUrl = block.imageUrl || block.assetUrl;

  return (
    <Card className="group relative bg-background/60 backdrop-blur-md border-white/20 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden rounded-xl">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 z-20"
        onClick={onRemove}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
        <span className="sr-only">Remove Block</span>
      </Button>
      <CardContent className="p-4">
        <div className={cn("grid gap-4", currentMediaUrl ? 'grid-cols-1 xl:grid-cols-[1.2fr_1.5fr]' : 'grid-cols-1')}>
          <div className='space-y-2'>
            {currentMediaUrl && (
              <div className="relative rounded-lg overflow-hidden group/media max-w-full shadow-sm border border-white/20">
                <div className="flex flex-col">
                  {currentMediaUrl.includes('video') ? (
                    <video src={currentMediaUrl} controls={false} className="w-full h-auto object-contain bg-black" />
                  ) : (
                      <NextImage src={currentMediaUrl} alt="Selected media" width={800} height={800} sizes="(max-width: 768px) 100vw, (max-width: 1280px) 100vw, 40vw" className="w-full h-auto object-contain" />
                  )}
                  <div className="p-2 flex justify-end items-center border-t bg-muted/20">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" asChild>
                      <a
                        href={currentMediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={`image-${Date.now()}.png`}
                        title="Open image in new tab (right-click to save as)"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open {currentMediaUrl.includes('video') ? 'Video' : 'Image'}
                      </a>
                    </Button>
                  </div>
                </div>
                <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 z-10 opacity-0 group-hover/media:opacity-100 transition-all duration-300 translate-y-[-10px] group-hover/media:translate-y-0 shadow-lg" onClick={handleRemoveMedia}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {block.adCopy && (
              <div className="mt-2 p-3 bg-muted/50 rounded-lg border border-white/10">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Generated Text Preview</Label>
                <p className="text-sm text-foreground/80 line-clamp-3 leading-relaxed italic">"{block.adCopy}"</p>
                </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content Type</Label>
                <Select
                    value={block.contentType}
                    onValueChange={(value) =>
                    onUpdate({ contentType: value as ContentBlock['contentType'] })
                    }
                >
                <SelectTrigger className="h-10 bg-background/50 border-white/20">
                    <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="Social Media Post">Social Media Post</SelectItem>
                    <SelectItem value="Email Newsletter">Email Newsletter</SelectItem>
                    <SelectItem value="Blog Post Idea">Blog Post Idea</SelectItem>
                    </SelectContent>
                </Select>
            </div>
             {block.contentType === 'Social Media Post' && (
              <div className="space-y-2">
                <Label htmlFor={`time-${block.id}`} className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scheduled Time (Optional)</Label>
                    <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            id={`time-${block.id}`}
                            type="time" 
                    className="pl-10 h-10 bg-background/50 border-white/20"
                            value={block.scheduledTime || ''}
                            onChange={(e) => onUpdate({ scheduledTime: e.target.value })}
                        />
                    </div>
                </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Key Message / Prompt</Label>
              <Textarea
                placeholder="e.g., Announce our new summer collection..."
                value={block.keyMessage}
                onChange={(e) => onUpdate({ keyMessage: e.target.value })}
                rows={3}
                className="text-sm bg-background/50 border-white/20 focus-visible:ring-primary/50 resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tone of Voice</Label>
              <Select
                value={block.toneOfVoice}
                onValueChange={(value) =>
                  onUpdate({ toneOfVoice: value as ContentBlock['toneOfVoice'] })
                }
              >
                <SelectTrigger className="h-10 bg-background/50 border-white/20">
                  <SelectValue placeholder="Select a tone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Professional">Professional</SelectItem>
                  <SelectItem value="Playful">Playful</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Dialog open={isMediaSelectorOpen} onOpenChange={setIsMediaSelectorOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className='flex-1 h-10 bg-background/50 border-white/20 hover:bg-primary/10 hover:text-primary transition-colors' onClick={openMediaSelector}>
                    <ImageIconLucide className="mr-2 h-4 w-4" />
                    Select Media
                  </Button>
                </DialogTrigger>
                <DialogContent className='max-w-3xl'>
                    <DialogHeader>
                    <DialogTitle>Select Media from Galleries</DialogTitle>
                    </DialogHeader>
                    <Tabs defaultValue="images">
                    <TabsList className='grid w-full grid-cols-2'>
                        <TabsTrigger value="images"><ImageIconLucide className='mr-2'/>Images</TabsTrigger>
                        <TabsTrigger value="videos"><Film className='mr-2'/>Videos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="images">
                        <ScrollArea className='h-96'>
                        {mediaLoading ? <div className='flex justify-center items-center h-full'><Loader2 className='animate-spin h-8 w-8' /></div> :
                        <div className='grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 p-1'>
                            {availableMedia.images.map(image => (
                            <div key={image.id} className='relative group aspect-square cursor-pointer' onClick={() => handleSelectMedia(image.generatedImageUrl || image.sourceImageUrl)}>
                                <NextImage src={image.generatedImageUrl || image.sourceImageUrl} alt={image.title} fill sizes="(max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw" className='object-cover rounded-md' />
                                <div className={cn('absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity',
                                    currentMediaUrl === image.generatedImageUrl || currentMediaUrl === image.sourceImageUrl ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                )}>
                                <Check className='h-8 w-8 text-white' />
                                </div>
                            </div>
                            ))}
                        </div>}
                        </ScrollArea>
                    </TabsContent>
                    <TabsContent value="videos">
                        <ScrollArea className='h-96'>
                            {mediaLoading ? <div className='flex justify-center items-center h-full'><Loader2 className='animate-spin h-8 w-8' /></div> :
                            <div className='grid grid-cols-2 md:grid-cols-3 gap-2 p-1'>
                                {availableMedia.videos.map(video => (
                                    <div key={video.id} className='relative group aspect-video cursor-pointer' onClick={() => handleSelectMedia(video.videoUrl)}>
                                        <video src={video.videoUrl} className='w-full h-full object-cover rounded-md bg-black' />
                                        <div className={cn('absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity',
                                            currentMediaUrl === video.videoUrl ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                        )}>
                                        <Check className='h-8 w-8 text-white' />
                                        </div>
                                    </div>
                                ))}
                            </div>}
                        </ScrollArea>
                    </TabsContent>
                    </Tabs>
                </DialogContent>
                </Dialog>
                
              </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export default ContentBlockEditor;
