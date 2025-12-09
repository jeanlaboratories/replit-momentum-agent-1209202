'use client';

import { useState, useEffect } from 'react';
import { BrandText } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Pencil, Save, XCircle, Wand2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateBrandTextAction, regenerateBrandTextSectionAction, updateUserBrandTextFieldAction, generateUserBrandTextSectionAction } from '@/app/actions';
import _ from 'lodash';

interface BrandTextEditorProps {
  brandId: string;
  userId?: string;
  initialBrandText?: BrandText;
  onUpdate?: (brandText: BrandText) => void;
}

const DEFAULT_BRAND_TEXT: BrandText = {
  coreText: { missionVision: '', brandStory: '', taglines: [] },
  marketingText: { adCopy: [], productDescriptions: [], emailCampaigns: [], landingPageCopy: '' },
  contentMarketingText: { blogPosts: [], socialMediaCaptions: [], whitePapers: [], videoScripts: [] },
  technicalSupportText: { userManuals: '', faqs: [] },
  publicRelationsText: { pressReleases: [], companyStatements: [], mediaKitText: '' }
};

type EditableField = {
  isEditing: boolean;
  isRegenerating: boolean;
  currentValue: string | string[];
};

type EditingState = {
  [key: string]: EditableField;
};

export function BrandTextEditor({ brandId, userId, initialBrandText, onUpdate }: BrandTextEditorProps) {
  const { toast } = useToast();
  const [brandText, setBrandText] = useState(initialBrandText || DEFAULT_BRAND_TEXT);
  const [editingState, setEditingState] = useState<EditingState>({});

  useEffect(() => {
    setBrandText(initialBrandText || DEFAULT_BRAND_TEXT);
    // Reset editing state when switching profiles or brand text changes
    setEditingState({});
  }, [initialBrandText, userId]);

  const startEditing = (key: string, value: string | string[]) => {
    // Prevent editing when viewing someone else's profile (userId is undefined)
    if (!userId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot edit in read-only mode.' });
      return;
    }
    
    setEditingState(prev => ({
      ...prev,
      [key]: { isEditing: true, isRegenerating: false, currentValue: value }
    }));
  };

  const cancelEditing = (key: string) => {
    setEditingState(prev => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  };

  const handleValueChange = (key: string, value: string | string[]) => {
    setEditingState(prev => ({
      ...prev,
      [key]: { ...prev[key], currentValue: value }
    }));
  };

  const handleSave = async (key: string, isArrayField: boolean = false) => {
    const field = editingState[key];
    if (!field) return;
    
    // Prevent saving when viewing someone else's profile (userId is undefined)
    if (!userId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot edit in read-only mode.' });
      return;
    }

    // Convert newline-separated string back to array for array fields
    let valueToSave = field.currentValue;
    if (isArrayField && typeof field.currentValue === 'string') {
      valueToSave = field.currentValue
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    }

    const { error } = userId
      ? await updateUserBrandTextFieldAction(userId, brandId, key, valueToSave)
      : await updateBrandTextAction(brandId, key, valueToSave);
      
    if (error) {
      toast({ variant: 'destructive', title: 'Save Failed', description: error });
    } else {
      const newBrandText = _.cloneDeep(brandText || DEFAULT_BRAND_TEXT);
      _.set(newBrandText, key, valueToSave);
      setBrandText(newBrandText);
      onUpdate?.(newBrandText);
      cancelEditing(key);
      toast({ title: 'Success', description: 'Your changes have been saved to your profile.' });
    }
  };

  const handleRegenerate = async (key: string, sectionTitle: string) => {
    // Prevent regenerating when viewing someone else's profile (userId is undefined)
    if (!userId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cannot edit in read-only mode.' });
      return;
    }
    
    setEditingState(prev => ({
      ...prev,
      [key]: { isEditing: false, isRegenerating: true, currentValue: _.get(brandText, key) }
    }));

    const { newContent, error } = userId
      ? await generateUserBrandTextSectionAction(userId, brandId, key, sectionTitle)
      : await regenerateBrandTextSectionAction(brandId, key, sectionTitle);

    setEditingState(prev => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Regeneration Failed', description: error });
    } else if (newContent) {
      const newBrandText = _.cloneDeep(brandText || DEFAULT_BRAND_TEXT);
      _.set(newBrandText, key, newContent);
      
      setBrandText(newBrandText);
      onUpdate?.(newBrandText);
      toast({ title: 'Success', description: `${sectionTitle} regenerated and saved to your profile.` });
    }
  };

  const renderTextSection = (key: string, label: string, value: string) => {
    const field = editingState[key];
    const isEditing = field?.isEditing;
    const isRegenerating = field?.isRegenerating;

    return (
      <div key={key} className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">{label}</h4>
          <div className="flex gap-2">
            {!isEditing && !isRegenerating && userId && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEditing(key, value)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRegenerate(key, label)}
                >
                  <Wand2 className="h-3 w-3" />
                </Button>
              </>
            )}
            {isEditing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSave(key)}
                >
                  <Save className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancelEditing(key)}
                >
                  <XCircle className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
        {isRegenerating ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Regenerating...
          </div>
        ) : isEditing ? (
          <Textarea
            value={field.currentValue as string}
            onChange={(e) => handleValueChange(key, e.target.value)}
            className="min-h-[100px]"
          />
        ) : (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {value || 'No content yet'}
          </p>
        )}
      </div>
    );
  };

  const renderArraySection = (key: string, label: string, values: string[]) => {
    const field = editingState[key];
    const isEditing = field?.isEditing;
    const isRegenerating = field?.isRegenerating;

    return (
      <div key={key} className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">{label}</h4>
          <div className="flex gap-2">
            {!isEditing && !isRegenerating && userId && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEditing(key, values.join('\n'))}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRegenerate(key, label)}
                >
                  <Wand2 className="h-3 w-3" />
                </Button>
              </>
            )}
            {isEditing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSave(key, true)}
                >
                  <Save className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancelEditing(key)}
                >
                  <XCircle className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
        {isRegenerating ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Regenerating...
          </div>
        ) : isEditing ? (
          <Textarea
            value={field.currentValue as string}
            onChange={(e) => handleValueChange(key, e.target.value)}
            placeholder="Enter one item per line"
            className="min-h-[100px]"
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {values.length > 0 ? (
              values.map((item, idx) => (
                <Badge key={idx} variant="secondary">
                  {item}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No items yet</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Text Content</CardTitle>
        <CardDescription>Edit and regenerate team text sections</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Core Text */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Core Team Text</h3>
          {renderTextSection('coreText.missionVision', 'Mission & Vision', brandText?.coreText?.missionVision || '')}
          {renderTextSection('coreText.brandStory', 'Team Story', brandText?.coreText?.brandStory || '')}
          {renderArraySection('coreText.taglines', 'Taglines', brandText?.coreText?.taglines || [])}
        </div>

        {/* Outreach Text */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Outreach Content</h3>
          {renderArraySection('marketingText.adCopy', 'Ad Copy', brandText?.marketingText?.adCopy || [])}
          {renderArraySection('marketingText.productDescriptions', 'Product Descriptions', brandText?.marketingText?.productDescriptions || [])}
          {renderArraySection('marketingText.emailCampaigns', 'Email Initiative Snippets', brandText?.marketingText?.emailCampaigns || [])}
          {renderTextSection('marketingText.landingPageCopy', 'Landing Page Copy', brandText?.marketingText?.landingPageCopy || '')}
        </div>

        {/* Content Creation */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Content Creation</h3>
          {renderArraySection('contentMarketingText.socialMediaCaptions', 'Social Media Captions', brandText?.contentMarketingText?.socialMediaCaptions || [])}
          {renderArraySection('contentMarketingText.blogPosts', 'Blog Posts', brandText?.contentMarketingText?.blogPosts || [])}
        </div>
      </CardContent>
    </Card>
  );
}
