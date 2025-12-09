'use client';

import { BrandProfile } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Globe, Mail } from 'lucide-react';
import NextImage from 'next/image';

interface BrandIdentityPanelProps {
  brandName: string;
  brandProfile: BrandProfile;
  onEditLogo?: () => void;
}

export function BrandIdentityPanel({ brandName, brandProfile, onEditLogo }: BrandIdentityPanelProps) {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Profile Picture/Logo */}
        <div className="flex justify-center -mt-16 mb-4">
          <div className={`w-32 h-32 rounded-full border-4 border-background bg-muted flex items-center justify-center overflow-hidden relative ${onEditLogo ? 'group cursor-pointer' : ''}`}>
            {brandProfile.logoUrl ? (
              <NextImage
                src={brandProfile.logoUrl}
                alt={`${brandName} logo`}
                width={128}
                height={128}
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                <span className="text-4xl font-bold text-white">
                  {brandName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {onEditLogo && (
              <div 
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center cursor-pointer"
                onClick={onEditLogo}
              >
                <span className="text-white text-xs font-medium">Edit</span>
              </div>
            )}
          </div>
        </div>

        {/* Brand Name */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">{brandName}</h1>
          {brandProfile.tagline && (
            <p className="text-sm text-muted-foreground mt-1">
              {brandProfile.tagline}
            </p>
          )}
        </div>

        {/* Brand Description/Bio */}
        {brandProfile.summary && (
          <div className="text-sm text-muted-foreground">
            <p>{brandProfile.summary}</p>
          </div>
        )}

        {/* Additional brand story if available */}
        {brandProfile.brandText?.coreText?.brandStory && (
          <div className="text-sm text-muted-foreground">
            <p className="line-clamp-3">{brandProfile.brandText.coreText.brandStory}</p>
          </div>
        )}

        {/* Key Information */}
        <div className="space-y-2 text-sm">
          {brandProfile.websiteUrl && (
            <a
              href={brandProfile.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:underline"
            >
              <Globe className="w-4 h-4" />
              {brandProfile.websiteUrl.replace(/^https?:\/\//, '')}
            </a>
          )}
          
          {brandProfile.contactEmail && (
            <a
              href={`mailto:${brandProfile.contactEmail}`}
              className="flex items-center gap-2 text-blue-600 hover:underline"
            >
              <Mail className="w-4 h-4" />
              {brandProfile.contactEmail}
            </a>
          )}
          
          {brandProfile.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              {brandProfile.location}
            </div>
          )}
        </div>

        {/* Taglines as badges */}
        {brandProfile.brandText?.coreText?.taglines && brandProfile.brandText.coreText.taglines.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {brandProfile.brandText.coreText.taglines.slice(0, 3).map((tagline, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tagline}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
