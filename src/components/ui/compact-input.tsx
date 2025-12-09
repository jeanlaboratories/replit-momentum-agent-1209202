'use client';

import React, { useState, useRef } from 'react';
import { Send, Paperclip, Loader2, Image as ImageIcon, Video, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useGlobalChatbot } from '@/contexts/global-chatbot-context';
import { MediaAttachment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { uploadBrandAssetAction } from '@/app/actions';
import { useAuth } from '@/hooks/use-auth';

interface CompactInputProps {
  placeholder?: string;
  className?: string;
}

export function CompactInput({ placeholder = 'Ask Team Companion...', className = '' }: CompactInputProps) {
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const { openChatbot } = useGlobalChatbot();
  const { brandId } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    openChatbot({ initialMessage: input });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!brandId) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const type = file.type.startsWith('image/') ? 'image' :
      file.type.startsWith('video/') ? 'video' : 'document';

    const maxSizeMB = type === 'video' ? 100 : type === 'image' ? 50 : 25;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      toast({
        variant: 'destructive',
        title: 'File Too Large',
        description: `${type === 'video' ? 'Video' : type === 'image' ? 'Image' : 'Document'} size must be less than ${maxSizeMB}MB.`
      });
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      const dataUri = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
      });

      const { asset, error } = await uploadBrandAssetAction(brandId, { name: file.name, dataUri, type: type as any });

      if (error) throw new Error(error);
      if (asset) {
        const attachment: MediaAttachment = {
          id: asset.id,
          type: type as any,
          url: asset.url,
          name: asset.name,
          size: file.size,
          mimeType: file.type
        };
        openChatbot({ attachments: [attachment], initialMessage: input });
        setInput('');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`relative bg-background/50 backdrop-blur-sm border rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-primary/50 transition-all ${className}`}>
      <div className="flex items-end p-2 gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileUpload}
          accept="image/*,video/*,.pdf,.doc,.docx,.txt"
        />
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[40px] max-h-[120px] py-2.5 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none"
          rows={1}
          style={{ height: 'auto' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
          }}
        />
        <Button
          type="button"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          onClick={handleSubmit}
          disabled={!input.trim() && !isUploading}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
