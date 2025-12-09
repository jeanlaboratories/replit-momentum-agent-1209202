'use client';

import React, { useState, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Loader2, User, Upload, Camera, Save, X } from 'lucide-react';
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { PageTransition } from '@/components/ui/page-transition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  // Form state
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Initialize form when user data loads
  React.useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
    }
  }, [user]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid File Type',
        description: 'Please select an image file.',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File Too Large',
        description: 'Please select an image smaller than 5MB.',
      });
      return;
    }

    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setPreviewImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsUpdating(true);
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('displayName', displayName);
      
      if (selectedFile) {
        formData.append('profileImage', selectedFile);
      }

      const response = await fetch('/api/profile/update', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Profile Updated',
          description: 'Your profile has been successfully updated.',
        });
        
        // Clear the selected file and preview
        handleClearImage();
        
        // Refresh the page to get updated user data
        window.location.reload();
      } else {
        throw new Error(result.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update profile',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageTransition className="container mx-auto px-4 py-8 md:px-6 md:py-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl md:text-4xl font-bold font-headline flex items-center gap-3">
          <User className="w-8 h-8 md:w-10 md:h-10 text-primary" />
          <span>User Account</span>
        </h1>
      </header>

      <div className="max-w-2xl mx-auto">
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>Personal Information</GlassCardTitle>
            <GlassCardDescription>
              Update your display name and profile picture. Your profile picture will be shown throughout the app.
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Profile Picture Section */}
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    {(previewImage || user.photoURL) && (
                      <AvatarImage 
                        src={previewImage || user.photoURL} 
                        alt={displayName || 'Profile'} 
                      />
                    )}
                    <AvatarFallback className="text-2xl">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Camera overlay */}
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Click the camera icon to upload a new profile picture
                  </p>
                  
                  {selectedFile && (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm text-green-600">
                        New image selected: {selectedFile.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearImage}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              {/* Form Fields */}
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user.email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed. Contact support if you need to update your email.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your display name"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    This is how your name will appear to other team members.
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <Button type="submit" disabled={isUpdating} className="w-full sm:w-auto">
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </GlassCardContent>
        </GlassCard>
      </div>
    </PageTransition>
  );
}
