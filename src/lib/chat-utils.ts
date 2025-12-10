import { MediaAttachment } from '@/types/chat';

export const cleanMessageContent = (content: string, media?: MediaAttachment[]) => {
  let cleaned = content;

  // Remove markers first (if any remain)
  cleaned = cleaned.replace(/__IMAGE_DATA__[^]*?(?=\n\n|$)/g, '');
  cleaned = cleaned.replace(/__VIDEO_DATA__[^]*?(?=\n\n|$)/g, '');
  cleaned = cleaned.replace(/__IMAGE_URL__[^]*?(?=\n\n|$)/g, '');
  cleaned = cleaned.replace(/__VIDEO_URL__[^]*?(?=\n\n|$)/g, '');
  cleaned = cleaned.replace(/__MUSIC_URL__[^]*?(?=\n\n|$)/g, '');
  cleaned = cleaned.replace(/__EXPLAINABILITY__[^]*?(?=\n\n|$)/g, '');

  // Remove raw URLs of attached media
  // IMPORTANT: For YouTube videos, also remove the "YouTube video: " prefix
  if (media && media.length > 0) {
    media.forEach(m => {
      if (m.url && m.url.startsWith('http')) {
        try {
          // Escape regex special characters in URL
          const escapedUrl = m.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Regex to match URL and optional preceding phrases
          // Match "YouTube video: ", "Here's the link:", etc., whitespace, and the URL
          const urlRegex = new RegExp(`((YouTube video:?|Here's|Here is|check|see) (the|this) (link|video):?\\s*)?${escapedUrl}`, 'gi');
          cleaned = cleaned.replace(urlRegex, '');
        } catch (e) {
          // Fallback to simple replace if regex fails
          cleaned = cleaned.replace(m.url, '');
          // Also try to remove "YouTube video: " prefix if present
          cleaned = cleaned.replace(/YouTube video:\s*/gi, '');
        }
      }
    });
  }

  return cleaned.trim();
};

/**
 * Deduplicate media attachments by URL to prevent showing the same image/video twice.
 * This handles cases where the same media is added from multiple sources (streaming events + final_response markers).
 */
export const deduplicateMedia = (media: MediaAttachment[]): MediaAttachment[] => {
  if (!media || media.length === 0) return media;

  const seen = new Set<string>();
  const deduplicated: MediaAttachment[] = [];

  for (const item of media) {
    if (item.url && !seen.has(item.url)) {
      seen.add(item.url);
      deduplicated.push(item);
    }
  }

  return deduplicated;
};

/**
 * Validates and processes file uploads for chat
 */
export const validateFileUpload = (file: File): { valid: boolean; error?: string; type?: MediaAttachment['type'] } => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }

  // Determine media type
  if (file.type.startsWith('image/')) {
    return { valid: true, type: 'image' };
  } else if (file.type.startsWith('video/')) {
    return { valid: true, type: 'video' };
  } else if (file.type.startsWith('audio/')) {
    return { valid: true, type: 'audio' };
  } else if (file.type === 'application/pdf') {
    return { valid: true, type: 'pdf' };
  } else {
    return { valid: false, error: 'Unsupported file type. Please upload images, videos, audio, or PDFs.' };
  }
};

/**
 * Formats file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Extracts media URLs from chat response content
 */
export const extractMediaFromContent = (content: string): { 
  urls: string[]; 
  cleanContent: string;
  markers: Array<{ type: string; url: string; position: number }>;
} => {
  const markers: Array<{ type: string; url: string; position: number }> = [];
  const urls: string[] = [];
  
  // Find all markers with their positions
  const markerTypes = [
    { marker: '__IMAGE_URL__', type: 'image' },
    { marker: '__VIDEO_URL__', type: 'video' },
    { marker: '__MUSIC_URL__', type: 'music' }
  ];
  
  markerTypes.forEach(({ marker, type }) => {
    let searchPos = 0;
    while (searchPos < content.length) {
      const markerPos = content.indexOf(marker, searchPos);
      if (markerPos === -1) break;
      
      const endMarkerPos = content.indexOf(marker, markerPos + marker.length);
      if (endMarkerPos === -1) break;
      
      const url = content.substring(markerPos + marker.length, endMarkerPos).trim();
      markers.push({ type, url, position: markerPos });
      urls.push(url);
      
      searchPos = endMarkerPos + marker.length;
    }
  });
  
  // Remove all markers from content
  let cleanContent = content;
  markerTypes.forEach(({ marker }) => {
    const regex = new RegExp(`${marker}[^]*?${marker}`, 'g');
    cleanContent = cleanContent.replace(regex, '');
  });
  
  return {
    urls,
    cleanContent: cleanContent.trim(),
    markers
  };
};