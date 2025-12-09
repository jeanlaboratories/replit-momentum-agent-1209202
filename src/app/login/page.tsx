'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  GlassCard,
  GlassCardContent,
  GlassCardDescription,
  GlassCardFooter,
  GlassCardHeader,
  GlassCardTitle,
} from '@/components/ui/glass-card';
import { PageTransition } from '@/components/ui/page-transition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LogIn, Loader2, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import Image from 'next/image';

const BACKGROUND_IMAGES = [
  '/backgrounds/momentum-1.png',
  '/backgrounds/momentum-2.png',
  '/backgrounds/momentum-3.png',
  '/backgrounds/momentum-4.png',
];

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { loginWithEmail, loginWithGoogle, user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false);
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const interval = setInterval(() => {
      setCurrentBgIndex((prev) => (prev + 1) % BACKGROUND_IMAGES.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [prefersReducedMotion]);

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * BACKGROUND_IMAGES.length);
    setCurrentBgIndex(randomIndex);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);

    const result = await loginWithEmail(email, password);
    setIsLoggingIn(false);

    if (result.success) {
      toast({
        title: 'Success',
        description: result.message,
      });
      router.push('/');
    } else {
      if (result.requiresVerification) {
        setVerificationEmail(email);
        setShowVerificationPrompt(true);
      }
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: result.message,
      });
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoggingIn(true);
    const result = await loginWithGoogle();
    setIsGoogleLoggingIn(false);

    if (result.success) {
      toast({
        title: 'Success',
        description: result.message,
      });
      router.push('/');
    } else {
      toast({
        variant: 'destructive',
        title: 'Google Sign In Failed',
        description: result.message,
      });
    }
  };

  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-teal-950 via-teal-900 to-green-950">
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin text-teal-300 mx-auto mb-4" />
          <p className="text-teal-100 text-lg font-medium">Loading your momentum...</p>
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {BACKGROUND_IMAGES.map((bg, index) => (
        <div
          key={bg}
          className={`absolute inset-0 transition-opacity duration-2000 ease-in-out ${
            index === currentBgIndex ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            transitionDuration: prefersReducedMotion ? '0ms' : '2000ms',
          }}
        >
          <Image
            src={bg}
            alt="Momentum inspiring background"
            fill
            className="object-cover"
            priority={index === 0}
            quality={90}
            onLoad={() => index === 0 && setIsImageLoaded(true)}
          />
        </div>
      ))}

      <div className="absolute inset-0 bg-gradient-to-br from-teal-950/60 via-teal-900/50 to-green-950/60 backdrop-blur-[2px]" />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-8 flex items-center justify-between gap-8 flex-col lg:flex-row">
        <div className="flex-1 text-center lg:text-left space-y-6 max-w-2xl">
          <div className="inline-flex items-center gap-3 mb-4">
            <Zap className="h-12 w-12 text-teal-300" strokeWidth={2.5} />
            <h1 className="font-headline text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight">
              MOMENTUM
            </h1>
          </div>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-teal-100 leading-snug">
            AI Team Intelligence &<br />Execution Platform
          </p>
          <p className="text-lg sm:text-xl text-teal-200/90 max-w-xl leading-relaxed">
            Transform scattered team knowledge into actionable intelligence. Build unstoppable forward motion.
          </p>
          <div className="flex items-center gap-4 text-teal-300/80 text-sm font-medium pt-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span>Team Intelligence</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>AI Content Generation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Collaborative Planning</span>
            </div>
          </div>
        </div>

          <GlassCard className="w-full max-w-md bg-white hover:bg-white shadow-2xl">
          <form onSubmit={handleSubmit}>
              <GlassCardHeader className="text-center space-y-2 pb-6">
                <GlassCardTitle className="font-headline text-3xl bg-gradient-to-r from-teal-700 to-green-700 bg-clip-text text-transparent">
                Resume Your Momentum
                </GlassCardTitle>
                <GlassCardDescription className="text-base text-gray-600">
                Your team's forward motion awaits
                </GlassCardDescription>
              </GlassCardHeader>
              <GlassCardContent className="space-y-5">
              {showVerificationPrompt && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm">
                    <p className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Email Verification Required
                  </p>
                    <p className="text-amber-800 mb-3 leading-relaxed">
                    Please verify your email address before logging in. Check your inbox for the verification link.
                  </p>
                  <Link
                    href={`/verify-email?email=${encodeURIComponent(verificationEmail)}`}
                      className="text-amber-900 font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    Resend verification email →
                  </Link>
                </div>
              )}
              <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                    className="h-11 text-base border-gray-300 focus:ring-2 focus:ring-teal-500 bg-white text-gray-900"
                />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                    className="h-11 text-base border-gray-300 focus:ring-2 focus:ring-teal-500 bg-white text-gray-900"
                />
              </div>
              </GlassCardContent>
              <GlassCardFooter className="flex-col space-y-4 pt-2">
              <Button
                type="submit"
                disabled={isLoggingIn || isGoogleLoggingIn}
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-teal-600 to-green-600 hover:from-teal-700 hover:to-green-700 shadow-lg hover:shadow-xl transition-all"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-5 w-5" />
                    Logging in...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-5 w-5" />
                    Login
                  </>
                )}
              </Button>

              <div className="relative w-full">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or continue with</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={isLoggingIn || isGoogleLoggingIn}
                onClick={handleGoogleSignIn}
                className="w-full h-12 text-base font-semibold border-gray-300 bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-all"
              >
                {isGoogleLoggingIn ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-5 w-5" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Continue with Google
                  </>
                )}
              </Button>

                <p className="text-sm text-center text-gray-600">
                Don't have an account?{' '}
                <Link
                  href="/signup"
                    className="font-semibold text-teal-700 hover:text-teal-800 hover:underline"
                >
                  Ignite your momentum →
                </Link>
              </p>
              </GlassCardFooter>
          </form>
          </GlassCard>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {BACKGROUND_IMAGES.map((_, index) => (
          <button
            key={index}
            onClick={() => !prefersReducedMotion && setCurrentBgIndex(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentBgIndex
                ? 'bg-teal-300 w-8'
                : 'bg-white/50 hover:bg-white/70'
            }`}
            aria-label={`View background ${index + 1}`}
          />
        ))}
      </div>
    </div>
    </PageTransition>
  );
}
