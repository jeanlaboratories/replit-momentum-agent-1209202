'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { getBrandProfileAction, getImagesAction, getVideosAction } from '@/app/actions';
import type { BrandProfile, EditedImage, Video } from '@/lib/types';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';

interface BrandDataContextType {
  brandProfile: BrandProfile | null;
  images: EditedImage[];
  videos: Video[];
  loading: {
    profile: boolean;
    media: boolean;
  };
  refetch: {
    profile: () => Promise<void>;
    images: () => Promise<void>;
    videos: () => Promise<void>;
    all: () => Promise<void>;
  };
  lastFetched: {
    profile: number | null;
    images: number | null;
    videos: number | null;
  };
}

const BrandDataContext = createContext<BrandDataContextType>({
  brandProfile: null,
  images: [],
  videos: [],
  loading: { profile: false, media: false },
  refetch: {
    profile: async () => {},
    images: async () => {},
    videos: async () => {},
    all: async () => {},
  },
  lastFetched: { profile: null, images: null, videos: null },
});

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

export const BrandDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { brandId, user } = useAuth();
  const { toast } = useToast();
  
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [images, setImages] = useState<EditedImage[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState({ profile: false, media: false });
  const [lastFetched, setLastFetched] = useState({ profile: null as number | null, images: null as number | null, videos: null as number | null });

  const isCacheValid = useCallback((timestamp: number | null) => {
    return timestamp && (Date.now() - timestamp) < CACHE_DURATION;
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!brandId || !user || isCacheValid(lastFetched.profile)) return;
    
    setLoading(prev => ({ ...prev, profile: true }));
    try {
      const profile = await getBrandProfileAction(brandId);
      setBrandProfile(profile || { summary: '', images: [], videos: [], documents: [] });
      setLastFetched(prev => ({ ...prev, profile: Date.now() }));
    } catch (error) {
      console.error('Failed to fetch brand profile:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load brand profile',
      });
    } finally {
      setLoading(prev => ({ ...prev, profile: false }));
    }
  }, [brandId, user, lastFetched.profile, isCacheValid, toast]);

  const fetchImages = useCallback(async () => {
    if (!brandId || !user || isCacheValid(lastFetched.images)) return;
    
    setLoading(prev => ({ ...prev, media: true }));
    try {
      const fetchedImages = await getImagesAction(brandId);
      setImages(fetchedImages);
      setLastFetched(prev => ({ ...prev, images: Date.now() }));
    } catch (error) {
      console.error('Failed to fetch images:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load images',
      });
    } finally {
      setLoading(prev => ({ ...prev, media: false }));
    }
  }, [brandId, user, lastFetched.images, isCacheValid, toast]);

  const fetchVideos = useCallback(async () => {
    if (!brandId || !user || isCacheValid(lastFetched.videos)) return;
    
    setLoading(prev => ({ ...prev, media: true }));
    try {
      const fetchedVideos = await getVideosAction(brandId);
      setVideos(fetchedVideos);
      setLastFetched(prev => ({ ...prev, videos: Date.now() }));
    } catch (error) {
      console.error('Failed to fetch videos:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load videos',
      });
    } finally {
      setLoading(prev => ({ ...prev, media: false }));
    }
  }, [brandId, user, lastFetched.videos, isCacheValid, toast]);

  const fetchAll = useCallback(async () => {
    if (!brandId || !user) return;
    
    await Promise.all([
      fetchProfile(),
      fetchImages(),
      fetchVideos(),
    ]);
  }, [brandId, user, fetchProfile, fetchImages, fetchVideos]);

  // Clear data when brandId changes (user switched brands)
  useEffect(() => {
    setBrandProfile(null);
    setImages([]);
    setVideos([]);
    setLastFetched({ profile: null, images: null, videos: null });
  }, [brandId]);

  // Auto-fetch when brandId changes or user logs in
  useEffect(() => {
    if (brandId && user) {
      fetchAll();
    }
  }, [brandId, user, fetchAll]);

  // Force refetch functions (ignore cache)
  const forceRefetchProfile = useCallback(async () => {
    setLastFetched(prev => ({ ...prev, profile: null }));
    await fetchProfile();
  }, [fetchProfile]);

  const forceRefetchImages = useCallback(async () => {
    setLastFetched(prev => ({ ...prev, images: null }));
    await fetchImages();
  }, [fetchImages]);

  const forceRefetchVideos = useCallback(async () => {
    setLastFetched(prev => ({ ...prev, videos: null }));
    await fetchVideos();
  }, [fetchVideos]);

  const forceRefetchAll = useCallback(async () => {
    setLastFetched({ profile: null, images: null, videos: null });
    await fetchAll();
  }, [fetchAll]);

  const value: BrandDataContextType = {
    brandProfile,
    images,
    videos,
    loading,
    refetch: {
      profile: forceRefetchProfile,
      images: forceRefetchImages,
      videos: forceRefetchVideos,
      all: forceRefetchAll,
    },
    lastFetched,
  };

  return (
    <BrandDataContext.Provider value={value}>
      {children}
    </BrandDataContext.Provider>
  );
};

export const useBrandData = () => {
  const context = useContext(BrandDataContext);
  if (!context) {
    throw new Error('useBrandData must be used within a BrandDataProvider');
  }
  return context;
};
