'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { FileText, Globe, Upload, Loader2, CheckCircle2, AlertCircle, Image, Video, Youtube, ChevronDown, Settings2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useJobQueue } from '@/contexts/job-queue-context';

type UploadStatus = 'idle' | 'loading' | 'success' | 'error';

type SourceType = 'manual' | 'website' | 'document' | 'image' | 'video' | 'youtube';

const SOURCE_TYPES: { key: SourceType; label: string; shortLabel: string; icon: typeof FileText; description: string }[] = [
  { key: 'manual', label: 'Manual Text', shortLabel: 'Text', icon: FileText, description: 'Paste guidelines, mission statements, or any text content' },
  { key: 'website', label: 'Website', shortLabel: 'Web', icon: Globe, description: 'Crawl and extract content from web pages' },
  { key: 'document', label: 'Document', shortLabel: 'Doc', icon: Upload, description: 'Upload PDF, Word, or text files' },
  { key: 'image', label: 'Image', shortLabel: 'Img', icon: Image, description: 'Upload images for AI visual analysis' },
  { key: 'video', label: 'Video', shortLabel: 'Vid', icon: Video, description: 'Upload videos for AI analysis' },
  { key: 'youtube', label: 'YouTube', shortLabel: 'YT', icon: Youtube, description: 'Extract from YouTube videos' },
];

export default function UploadSourcesTab() {
  const { brandId } = useAuth();
  const { addJob, startJob, setProgress, completeJob, failJob } = useJobQueue();
  const [activeSource, setActiveSource] = useState<SourceType>('manual');
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const setProgressRef = useRef(setProgress);
  useEffect(() => {
    setProgressRef.current = setProgress;
  }, [setProgress]);

  // Form states
  const [manualText, setManualText] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualTags, setManualTags] = useState('');

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [websiteTitle, setWebsiteTitle] = useState('');
  const [crawlDepth, setCrawlDepth] = useState('single-page');
  const [websiteTags, setWebsiteTags] = useState('');
  const [maxImages, setMaxImages] = useState('10');
  const [minImageWidth, setMinImageWidth] = useState('');
  const [minImageHeight, setMinImageHeight] = useState('');
  const [imageKeywords, setImageKeywords] = useState('');

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentTags, setDocumentTags] = useState('');

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageTitle, setImageTitle] = useState('');
  const [imageDescription, setImageDescription] = useState('');
  const [imageTags, setImageTags] = useState('');

  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [videoTags, setVideoTags] = useState('');

  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeDescription, setYoutubeDescription] = useState('');
  const [youtubeTags, setYoutubeTags] = useState('');

  const resetStatus = () => {
    setTimeout(() => {
      setStatus('idle');
      setStatusMessage('');
    }, 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId) return;

    setStatus('loading');
    setStatusMessage('');

    try {
      switch (activeSource) {
        case 'manual':
          await handleManualTextSubmit();
          break;
        case 'website':
          await handleWebsiteSubmit();
          break;
        case 'document':
          await handleDocumentSubmit();
          break;
        case 'image':
          await handleImageSubmit();
          break;
        case 'video':
          await handleVideoSubmit();
          break;
        case 'youtube':
          await handleYoutubeSubmit();
          break;
      }
    } catch (error) {
      setStatus('error');
      setStatusMessage(error instanceof Error ? error.message : 'Unknown error');
      resetStatus();
    }
  };

  const handleManualTextSubmit = async () => {
    if (!manualText) throw new Error('Content is required');

    const title = manualTitle || 'Manual Text Entry';
    const jobId = addJob({
      type: 'source-ingest-text',
      title: `Ingesting: ${title.substring(0, 30)}${title.length > 30 ? '...' : ''}`,
      description: 'Processing manual text for AI extraction',
      resultUrl: '/brand-soul?tab=artifacts',
    });
    startJob(jobId);
    setProgressRef.current(jobId, 20);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2 * 60 * 1000);
    setProgressRef.current(jobId, 40);

    const response = await fetch('/api/brand-soul/ingest/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId,
        userId: brandId,
        content: manualText,
        sourceUrl: 'manual://user-input',
        title: manualTitle || 'Manual Text Entry',
        tags: manualTags,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    setProgressRef.current(jobId, 80);
    const data = await response.json();

    if (data.success) {
      setStatus('success');
      setStatusMessage('Text ingested successfully!');
      setManualText('');
      setManualTitle('');
      setManualTags('');
      completeJob(jobId, { resultUrl: '/brand-soul?tab=artifacts' });
    } else {
      failJob(jobId, data.message || 'Failed to ingest text');
      throw new Error(data.message || 'Failed to ingest text');
    }
    resetStatus();
  };

  const handleWebsiteSubmit = async () => {
    if (!websiteUrl) throw new Error('URL is required');

    const displayUrl = websiteUrl.length > 40 ? websiteUrl.substring(0, 40) + '...' : websiteUrl;
    const jobId = addJob({
      type: 'source-ingest-website',
      title: `Crawling: ${displayUrl}`,
      description: crawlDepth === 'subpages' ? 'Crawling website and subpages' : 'Crawling single page',
      resultUrl: '/brand-soul?tab=artifacts',
    });
    startJob(jobId);
    setProgressRef.current(jobId, 10);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);
    setProgressRef.current(jobId, 30);

    const response = await fetch('/api/brand-soul/ingest/website', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId,
        userId: brandId,
        url: websiteUrl,
        title: websiteTitle || websiteUrl,
        crawlDepth,
        tags: websiteTags,
        imageOptions: {
          maxImages: Math.max(0, Math.min(50, parseInt(maxImages) || 10)),
          minWidth: minImageWidth ? parseInt(minImageWidth) : undefined,
          minHeight: minImageHeight ? parseInt(minImageHeight) : undefined,
          keywords: imageKeywords ? imageKeywords.split(',').map(k => k.trim()).filter(Boolean) : undefined,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    setProgressRef.current(jobId, 80);
    const data = await response.json();

    if (data.success) {
      setStatus('success');
      setStatusMessage('Website crawled successfully!');
      setWebsiteUrl('');
      setWebsiteTitle('');
      setWebsiteTags('');
      completeJob(jobId, { resultUrl: '/brand-soul?tab=artifacts' });
    } else {
      failJob(jobId, data.message || 'Failed to crawl website');
      throw new Error(data.message || 'Failed to crawl website');
    }
    resetStatus();
  };

  const handleDocumentSubmit = async () => {
    if (!selectedFile) throw new Error('File is required');

    const title = documentTitle || selectedFile.name;
    const jobId = addJob({
      type: 'source-ingest-document',
      title: `Uploading: ${title.substring(0, 30)}${title.length > 30 ? '...' : ''}`,
      description: 'Processing document for AI extraction',
      resultUrl: '/brand-soul?tab=artifacts',
    });
    startJob(jobId);
    setProgressRef.current(jobId, 20);

    const formData = new FormData();
    formData.append('brandId', brandId!);
    formData.append('userId', brandId!);
    formData.append('file', selectedFile);
    formData.append('title', documentTitle || selectedFile.name);
    formData.append('tags', documentTags);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3 * 60 * 1000);
    setProgressRef.current(jobId, 40);

    const response = await fetch('/api/brand-soul/ingest/document', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    setProgressRef.current(jobId, 80);
    const data = await response.json();

    if (data.success) {
      setStatus('success');
      setStatusMessage('Document uploaded successfully!');
      setSelectedFile(null);
      setDocumentTitle('');
      setDocumentTags('');
      completeJob(jobId, { resultUrl: '/brand-soul?tab=artifacts' });
    } else {
      failJob(jobId, data.message || 'Failed to upload document');
      throw new Error(data.message || 'Failed to upload document');
    }
    resetStatus();
  };

  const handleImageSubmit = async () => {
    if (!selectedImage) throw new Error('Image is required');

    const title = imageTitle || selectedImage.name;
    const jobId = addJob({
      type: 'source-ingest-image',
      title: `Uploading: ${title.substring(0, 30)}${title.length > 30 ? '...' : ''}`,
      description: 'Processing image for AI visual analysis',
      resultUrl: '/brand-soul?tab=artifacts',
    });
    startJob(jobId);
    setProgressRef.current(jobId, 20);

    const formData = new FormData();
    formData.append('brandId', brandId!);
    formData.append('file', selectedImage);
    formData.append('title', imageTitle || selectedImage.name);
    formData.append('description', imageDescription);
    formData.append('tags', imageTags);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2 * 60 * 1000);
    setProgressRef.current(jobId, 40);

    const response = await fetch('/api/brand-soul/ingest/image', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    setProgressRef.current(jobId, 80);
    const data = await response.json();

    if (data.success) {
      setStatus('success');
      setStatusMessage('Image uploaded successfully!');
      setSelectedImage(null);
      setImageTitle('');
      setImageDescription('');
      setImageTags('');
      completeJob(jobId, { resultUrl: '/brand-soul?tab=artifacts' });
    } else {
      failJob(jobId, data.message || 'Failed to upload image');
      throw new Error(data.message || 'Failed to upload image');
    }
    resetStatus();
  };

  const handleVideoSubmit = async () => {
    if (!selectedVideo) throw new Error('Video is required');

    const title = videoTitle || selectedVideo.name;
    const jobId = addJob({
      type: 'source-ingest-video',
      title: `Uploading: ${title.substring(0, 30)}${title.length > 30 ? '...' : ''}`,
      description: 'Processing video for AI analysis',
      resultUrl: '/brand-soul?tab=artifacts',
    });
    startJob(jobId);
    setProgressRef.current(jobId, 10);

    const formData = new FormData();
    formData.append('brandId', brandId!);
    formData.append('file', selectedVideo);
    formData.append('title', videoTitle || selectedVideo.name);
    formData.append('description', videoDescription);
    formData.append('tags', videoTags);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000);
    setProgressRef.current(jobId, 30);

    const response = await fetch('/api/brand-soul/ingest/video', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    setProgressRef.current(jobId, 80);
    const data = await response.json();

    if (data.success) {
      setStatus('success');
      setStatusMessage('Video uploaded successfully!');
      setSelectedVideo(null);
      setVideoTitle('');
      setVideoDescription('');
      setVideoTags('');
      completeJob(jobId, { resultUrl: '/brand-soul?tab=artifacts' });
    } else {
      failJob(jobId, data.message || 'Failed to upload video');
      throw new Error(data.message || 'Failed to upload video');
    }
    resetStatus();
  };

  const handleYoutubeSubmit = async () => {
    if (!youtubeUrl) throw new Error('YouTube URL is required');

    const displayUrl = youtubeUrl.length > 40 ? youtubeUrl.substring(0, 40) + '...' : youtubeUrl;
    const jobId = addJob({
      type: 'source-ingest-youtube',
      title: youtubeTitle ? `YouTube: ${youtubeTitle.substring(0, 25)}${youtubeTitle.length > 25 ? '...' : ''}` : `YouTube: ${displayUrl}`,
      description: 'Extracting transcript and analyzing video',
      resultUrl: '/brand-soul?tab=artifacts',
    });
    startJob(jobId);
    setProgressRef.current(jobId, 20);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);
    setProgressRef.current(jobId, 40);

    const response = await fetch('/api/brand-soul/ingest/youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brandId,
        url: youtubeUrl,
        title: youtubeTitle,
        description: youtubeDescription,
        tags: youtubeTags,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    setProgressRef.current(jobId, 80);
    const data = await response.json();

    if (data.success) {
      setStatus('success');
      setStatusMessage('YouTube video queued for processing!');
      setYoutubeUrl('');
      setYoutubeTitle('');
      setYoutubeDescription('');
      setYoutubeTags('');
      completeJob(jobId, { resultUrl: '/brand-soul?tab=artifacts' });
    } else {
      failJob(jobId, data.message || 'Failed to process YouTube video');
      throw new Error(data.message || 'Failed to process YouTube video');
    }
    resetStatus();
  };

  const isSubmitDisabled = () => {
    if (status === 'loading') return true;
    switch (activeSource) {
      case 'manual': return !manualText;
      case 'website': return !websiteUrl;
      case 'document': return !selectedFile;
      case 'image': return !selectedImage;
      case 'video': return !selectedVideo;
      case 'youtube': return !youtubeUrl;
      default: return true;
    }
  };

  const getSubmitLabel = () => {
    if (status === 'loading') return 'Processing...';
    if (status === 'success') return 'Success!';
    if (status === 'error') return 'Try Again';

    switch (activeSource) {
      case 'manual': return 'Add Text';
      case 'website': return 'Crawl Site';
      case 'document': return 'Upload';
      case 'image': return 'Upload';
      case 'video': return 'Upload';
      case 'youtube': return 'Add Video';
      default: return 'Submit';
    }
  };

  if (!brandId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500 text-sm">Please log in to upload sources.</p>
        </CardContent>
      </Card>
    );
  }

  const activeSourceConfig = SOURCE_TYPES.find(s => s.key === activeSource)!;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Status Message */}
        {statusMessage && (
          <div className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
            status === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            {status === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {statusMessage}
          </div>
        )}

        {/* Compact Source Type Selector */}
        <div className="flex items-center gap-1 p-1 bg-gray-100/80 rounded-lg overflow-x-auto">
          {SOURCE_TYPES.map(({ key, label, shortLabel, icon: Icon }) => (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveSource(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                    activeSource === key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{shortLabel}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                {SOURCE_TYPES.find(s => s.key === key)?.description}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Form Card */}
        <Card className="border-gray-200">
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Manual Text Form */}
              {activeSource === 'manual' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-title" className="text-xs text-gray-600">Title</Label>
                    <Input
                      id="manual-title"
                      placeholder="e.g., Team Guidelines 2024"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-text" className="text-xs text-gray-600">Content *</Label>
                    <Textarea
                      id="manual-text"
                      placeholder="Paste your team content here..."
                      rows={6}
                      required
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      className="text-sm resize-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-tags" className="text-xs text-gray-600">Tags (comma-separated)</Label>
                    <Input
                      id="manual-tags"
                      placeholder="guidelines, voice, mission"
                      value={manualTags}
                      onChange={(e) => setManualTags(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </>
              )}

              {/* Website Form */}
              {activeSource === 'website' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="website-url" className="text-xs text-gray-600">URL *</Label>
                      <Input
                        id="website-url"
                        type="url"
                        placeholder="https://example.com"
                        required
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="website-title" className="text-xs text-gray-600">Title</Label>
                      <Input
                        id="website-title"
                        placeholder="Company About Page"
                        value={websiteTitle}
                        onChange={(e) => setWebsiteTitle(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="crawl-depth" className="text-xs text-gray-600">Crawl Depth</Label>
                      <Select value={crawlDepth} onValueChange={setCrawlDepth}>
                        <SelectTrigger id="crawl-depth" className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single-page">Single Page</SelectItem>
                          <SelectItem value="subpages">Subpages (max 10)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="website-tags" className="text-xs text-gray-600">Tags</Label>
                      <Input
                        id="website-tags"
                        placeholder="about, company"
                        value={websiteTags}
                        onChange={(e) => setWebsiteTags(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  {/* Advanced Options */}
                  <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        Image extraction options
                        <ChevronDown className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-gray-50 rounded-lg">
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Max Images</Label>
                          <Input
                            type="number"
                            min="0"
                            max="50"
                            value={maxImages}
                            onChange={(e) => setMaxImages(e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Min Width</Label>
                          <Input
                            type="number"
                            placeholder="800"
                            value={minImageWidth}
                            onChange={(e) => setMinImageWidth(e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Min Height</Label>
                          <Input
                            type="number"
                            placeholder="600"
                            value={minImageHeight}
                            onChange={(e) => setMinImageHeight(e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Keywords</Label>
                          <Input
                            placeholder="logo, team"
                            value={imageKeywords}
                            onChange={(e) => setImageKeywords(e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </>
              )}

              {/* Document Form */}
              {activeSource === 'document' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="document-file" className="text-xs text-gray-600">File (PDF, DOCX, TXT) *</Label>
                    <Input
                      id="document-file"
                      type="file"
                      accept=".pdf,.docx,.doc,.txt,.md"
                      required
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="h-8 text-sm file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-100"
                    />
                    {selectedFile && (
                      <p className="text-xs text-gray-500">{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="document-title" className="text-xs text-gray-600">Title</Label>
                      <Input
                        id="document-title"
                        placeholder="Team Style Guide"
                        value={documentTitle}
                        onChange={(e) => setDocumentTitle(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="document-tags" className="text-xs text-gray-600">Tags</Label>
                      <Input
                        id="document-tags"
                        placeholder="style, design"
                        value={documentTags}
                        onChange={(e) => setDocumentTags(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Image Form */}
              {activeSource === 'image' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="image-file" className="text-xs text-gray-600">Image (JPG, PNG, WEBP) *</Label>
                    <Input
                      id="image-file"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      required
                      onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
                      className="h-8 text-sm file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-100"
                    />
                    {selectedImage && (
                      <p className="text-xs text-gray-500">{selectedImage.name} ({(selectedImage.size / 1024).toFixed(1)} KB)</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="image-title" className="text-xs text-gray-600">Title</Label>
                      <Input
                        id="image-title"
                        placeholder="Team Logo"
                        value={imageTitle}
                        onChange={(e) => setImageTitle(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="image-tags" className="text-xs text-gray-600">Tags</Label>
                      <Input
                        id="image-tags"
                        placeholder="logo, branding"
                        value={imageTags}
                        onChange={(e) => setImageTags(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="image-description" className="text-xs text-gray-600">Description</Label>
                    <Textarea
                      id="image-description"
                      placeholder="Brief description..."
                      rows={2}
                      value={imageDescription}
                      onChange={(e) => setImageDescription(e.target.value)}
                      className="text-sm resize-none"
                    />
                  </div>
                </>
              )}

              {/* Video Form */}
              {activeSource === 'video' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="video-file" className="text-xs text-gray-600">Video (MP4, MOV, WEBM) *</Label>
                    <Input
                      id="video-file"
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
                      required
                      onChange={(e) => setSelectedVideo(e.target.files?.[0] || null)}
                      className="h-8 text-sm file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-100"
                    />
                    {selectedVideo && (
                      <p className="text-xs text-gray-500">{selectedVideo.name} ({(selectedVideo.size / (1024 * 1024)).toFixed(1)} MB)</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="video-title" className="text-xs text-gray-600">Title</Label>
                      <Input
                        id="video-title"
                        placeholder="Product Demo"
                        value={videoTitle}
                        onChange={(e) => setVideoTitle(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="video-tags" className="text-xs text-gray-600">Tags</Label>
                      <Input
                        id="video-tags"
                        placeholder="demo, product"
                        value={videoTags}
                        onChange={(e) => setVideoTags(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="video-description" className="text-xs text-gray-600">Description</Label>
                    <Textarea
                      id="video-description"
                      placeholder="Brief description..."
                      rows={2}
                      value={videoDescription}
                      onChange={(e) => setVideoDescription(e.target.value)}
                      className="text-sm resize-none"
                    />
                  </div>
                </>
              )}

              {/* YouTube Form */}
              {activeSource === 'youtube' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="youtube-url" className="text-xs text-gray-600">YouTube URL *</Label>
                      <Input
                        id="youtube-url"
                        type="url"
                        placeholder="https://youtube.com/watch?v=..."
                        required
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="youtube-title" className="text-xs text-gray-600">Title</Label>
                      <Input
                        id="youtube-title"
                        placeholder="Company Overview"
                        value={youtubeTitle}
                        onChange={(e) => setYoutubeTitle(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="youtube-description" className="text-xs text-gray-600">Description</Label>
                      <Textarea
                        id="youtube-description"
                        placeholder="Brief description..."
                        rows={2}
                        value={youtubeDescription}
                        onChange={(e) => setYoutubeDescription(e.target.value)}
                        className="text-sm resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="youtube-tags" className="text-xs text-gray-600">Tags</Label>
                      <Input
                        id="youtube-tags"
                        placeholder="video, testimonial"
                        value={youtubeTags}
                        onChange={(e) => setYoutubeTags(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitDisabled()}
                  size="sm"
                  className={`h-8 px-4 ${
                    status === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' :
                    status === 'error' ? 'bg-red-600 hover:bg-red-700' : ''
                  }`}
                >
                  {status === 'loading' && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  {status === 'success' && <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                  {status === 'error' && <AlertCircle className="w-3.5 h-3.5 mr-1.5" />}
                  {getSubmitLabel()}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
