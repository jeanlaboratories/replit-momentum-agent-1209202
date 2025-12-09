'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { PageTransition } from '@/components/ui/page-transition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updatePassword } from 'firebase/auth';

function SetupPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = searchParams.get('displayName') || '';
  const email = searchParams.get('email') || '';

  useEffect(() => {
    // Only redirect if auth has finished loading and user is still not authenticated
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!user) {
      setError('You must be logged in to set your password');
      return;
    }

    setLoading(true);

    try {
      await updatePassword(user, password);
      
      toast({
        title: 'Password Set Successfully!',
        description: 'You can now access your team workspace.',
      });

      // Redirect to dashboard after 1 second
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (err: any) {
      console.error('Error setting password:', err);
      setError(err.message || 'Failed to set password. Please try again.');
      setLoading(false);
    }
  };

  // Show loading spinner while auth is initializing
  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-950 via-teal-900 to-green-950">
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin text-teal-300 mx-auto mb-4" />
          <p className="text-teal-100 text-lg font-medium">Setting up your account...</p>
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-950 via-teal-900 to-green-950 p-4">
        <GlassCard className="w-full max-w-md">
          <GlassCardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-8 w-8 text-primary" />
          </div>
            <GlassCardTitle className="text-2xl">Set Your Password</GlassCardTitle>
            <GlassCardDescription>
            {displayName && <p className="text-lg font-medium mb-2">Welcome, {displayName}!</p>}
            Create a secure password to complete your account setup
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
          <form onSubmit={handleSetPassword} className="space-y-4">
            {email && (
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <p className="font-medium">{email}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters with uppercase, lowercase, and a number
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting Password...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Set Password & Continue
                </>
              )}
            </Button>
          </form>
          </GlassCardContent>
        </GlassCard>
    </div>
    </PageTransition>
  );
}

// Loading fallback component
function SetupPasswordLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-950 via-teal-900 to-green-950">
      <div className="text-center">
        <Loader2 className="h-16 w-16 animate-spin text-teal-300 mx-auto mb-4" />
        <p className="text-teal-100 text-lg font-medium">Loading...</p>
      </div>
    </div>
  );
}

// Main export with Suspense boundary
export default function SetupPasswordPage() {
  return (
    <Suspense fallback={<SetupPasswordLoading />}>
      <SetupPasswordContent />
    </Suspense>
  );
}
