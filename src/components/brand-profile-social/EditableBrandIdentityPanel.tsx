'use client';

import { BrandProfile } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Globe, Mail, Pencil, Save, XCircle } from 'lucide-react';
import NextImage from 'next/image';
import { useState } from 'react';

interface EditableBrandIdentityPanelProps {
  brandName: string;
  brandProfile: BrandProfile;
  onEditLogo?: () => void;
  onUpdateField?: (field: 'name' | 'displayName' | 'tagline' | 'summary' | 'websiteUrl' | 'contactEmail' | 'location', value: string) => Promise<void>;
  canEdit?: boolean;
  isPersonalProfile?: boolean;
}

export function EditableBrandIdentityPanel({ 
  brandName, 
  brandProfile, 
  onEditLogo,
  onUpdateField,
  canEdit = false,
  isPersonalProfile = false
}: EditableBrandIdentityPanelProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const startEdit = (field: string, currentValue: string = '') => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const saveEdit = async (field: 'name' | 'displayName' | 'tagline' | 'summary' | 'websiteUrl' | 'contactEmail' | 'location') => {
    if (!onUpdateField) return;
    
    setIsSaving(true);
    try {
      await onUpdateField(field, editValue);
      setEditingField(null);
      setEditValue('');
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

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

        {/* Editable Brand Name */}
        <div className="text-center">
          {editingField === (isPersonalProfile ? 'displayName' : 'name') ? (
            <div className="space-y-2">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Enter team name..."
                className="text-2xl font-bold text-center"
                disabled={isSaving}
              />
              <div className="flex justify-center gap-2">
                <Button size="sm" onClick={() => saveEdit(isPersonalProfile ? 'displayName' : 'name')} disabled={isSaving}>
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={isSaving}>
                  <XCircle className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="group flex items-center justify-center gap-2">
              <h1 className="text-2xl font-bold">{brandName}</h1>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => startEdit(isPersonalProfile ? 'displayName' : 'name', brandName)}
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
          
          {/* Editable Tagline */}
          {editingField === 'tagline' ? (
            <div className="mt-1 space-y-2">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Enter tagline..."
                className="text-sm text-center"
                disabled={isSaving}
              />
              <div className="flex justify-center gap-2">
                <Button size="sm" onClick={() => saveEdit('tagline')} disabled={isSaving}>
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={isSaving}>
                  <XCircle className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 mt-1">
              {brandProfile.tagline ? (
                <p className="text-sm text-muted-foreground">
                  {brandProfile.tagline}
                </p>
              ) : canEdit ? (
                <p className="text-sm text-muted-foreground/50 italic">No tagline</p>
              ) : null}
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => startEdit('tagline', brandProfile.tagline || '')}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Editable Summary/Bio */}
        {editingField === 'summary' ? (
          <div className="space-y-2">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Enter team summary..."
              className="text-sm min-h-[100px]"
              disabled={isSaving}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={() => saveEdit('summary')} disabled={isSaving}>
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={isSaving}>
                <XCircle className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative group">
            {brandProfile.summary ? (
              <div className="text-sm text-muted-foreground">
                <p>{brandProfile.summary}</p>
              </div>
            ) : canEdit ? (
              <div className="text-sm text-muted-foreground/50 italic">
                <p>No summary</p>
              </div>
            ) : null}
            {canEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-0 right-0 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => startEdit('summary', brandProfile.summary || '')}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
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
          {/* Website URL */}
          {editingField === 'websiteUrl' ? (
            <div className="space-y-2">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="https://example.com"
                className="text-sm"
                disabled={isSaving}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={() => saveEdit('websiteUrl')} disabled={isSaving}>
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={isSaving}>
                  <XCircle className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between group">
              {brandProfile.websiteUrl ? (
                <a
                  href={brandProfile.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:underline"
                >
                  <Globe className="w-4 h-4" />
                  {brandProfile.websiteUrl.replace(/^https?:\/\//, '')}
                </a>
              ) : canEdit ? (
                <span className="flex items-center gap-2 text-muted-foreground/50 italic">
                  <Globe className="w-4 h-4" />
                  No website
                </span>
              ) : null}
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => startEdit('websiteUrl', brandProfile.websiteUrl || '')}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
          
          {/* Contact Email */}
          {editingField === 'contactEmail' ? (
            <div className="space-y-2">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="contact@example.com"
                type="email"
                className="text-sm"
                disabled={isSaving}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={() => saveEdit('contactEmail')} disabled={isSaving}>
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={isSaving}>
                  <XCircle className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between group">
              {brandProfile.contactEmail ? (
                <a
                  href={`mailto:${brandProfile.contactEmail}`}
                  className="flex items-center gap-2 text-blue-600 hover:underline"
                >
                  <Mail className="w-4 h-4" />
                  {brandProfile.contactEmail}
                </a>
              ) : canEdit ? (
                <span className="flex items-center gap-2 text-muted-foreground/50 italic">
                  <Mail className="w-4 h-4" />
                  No email
                </span>
              ) : null}
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => startEdit('contactEmail', brandProfile.contactEmail || '')}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
          
          {/* Location */}
          {editingField === 'location' ? (
            <div className="space-y-2">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="City, Country"
                className="text-sm"
                disabled={isSaving}
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={() => saveEdit('location')} disabled={isSaving}>
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={isSaving}>
                  <XCircle className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between group">
              {brandProfile.location ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  {brandProfile.location}
                </div>
              ) : canEdit ? (
                <span className="flex items-center gap-2 text-muted-foreground/50 italic">
                  <MapPin className="w-4 h-4" />
                  No location
                </span>
              ) : null}
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => startEdit('location', brandProfile.location || '')}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
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
