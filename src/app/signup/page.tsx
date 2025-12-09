'use client';

import { useState, useEffect } from 'react';
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
import { UserPlus, Loader2, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
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

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { signupWithEmail, loginWithGoogle, user, loading } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    brandName: '',
  });
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isGoogleSigningUp, setIsGoogleSigningUp] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: '' });
  const [showSuccess, setShowSuccess] = useState(false);
  const [currentBgIndex, setCurrentBgIndex] = useState(0);
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

  useEffect(() => {
    if (!formData.password) {
      setPasswordStrength({ score: 0, feedback: '' });
      return;
    }

    let score = 0;
    let feedback = '';

    if (formData.password.length >= 8) score++;
    if (formData.password.length >= 12) score++;
    if (/[a-z]/.test(formData.password) && /[A-Z]/.test(formData.password)) score++;
    if (/\d/.test(formData.password)) score++;
    if (/[^a-zA-Z0-9]/.test(formData.password)) score++;

    if (score <= 2) feedback = 'Weak password';
    else if (score === 3) feedback = 'Fair password';
    else if (score === 4) feedback = 'Good password';
    else feedback = 'Strong password';

    setPasswordStrength({ score, feedback });
  }, [formData.password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Password Mismatch',
        description: 'Passwords do not match. Please try again.',
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Weak Password',
        description: 'Password must be at least 8 characters long.',
      });
      return;
    }

    setIsSigningUp(true);

    const result = await signupWithEmail(
      formData.email,
      formData.password,
      formData.displayName,
      formData.brandName
    );

    setIsSigningUp(false);

    if (result.success) {
      setShowSuccess(true);
      toast({
        title: 'Momentum Ignited!',
        description: 'Your team is ready to build unstoppable forward motion',
      });

      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } else {
      toast({
        variant: 'destructive',
        title: 'Signup Failed',
        description: result.message,
      });
    }
  };

  const handleGoogleSignUp = async () => {
    setIsGoogleSigningUp(true);
    const result = await loginWithGoogle();
    setIsGoogleSigningUp(false);

    if (result.success) {
      toast({
        title: result.isNewUser ? 'Account Created!' : 'Welcome Back!',
        description: result.isNewUser
          ? 'Your account has been created with Google.'
          : 'You have been signed in with Google.',
      });
      router.push('/');
    } else {
      toast({
        variant: 'destructive',
        title: 'Google Sign Up Failed',
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

  if (showSuccess) {
    return (
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
            <Image src={bg} alt="Momentum background" fill className="object-cover" priority={index === 0} quality={90} />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-br from-teal-950/60 via-teal-900/50 to-green-950/60 backdrop-blur-[2px]" />

        <GlassCard className="relative z-10 mx-auto w-full max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-white/20 shadow-2xl">
          <GlassCardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-teal-100">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <GlassCardTitle className="font-headline text-3xl bg-gradient-to-r from-teal-600 to-green-600 bg-clip-text text-transparent">
              First Push Complete!
            </GlassCardTitle>
            <GlassCardDescription className="mt-4 text-base">
              We've sent a verification link to <strong className="text-gray-900 dark:text-white">{formData.email}</strong> to set your team in motion
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
            <div className="rounded-lg bg-gradient-to-br from-blue-50 to-teal-50 dark:from-blue-950/30 dark:to-teal-950/30 p-4 text-sm border border-blue-200 dark:border-blue-800">
              <p className="font-semibold mb-3 text-gray-900 dark:text-white">Next Steps:</p>
              <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
                <li>Check your inbox for the verification email</li>
                <li>Click the verification link in the email</li>
                <li>Return to the login page to access your account</li>
              </ol>
            </div>
            <p className="text-sm text-center text-gray-600 dark:text-gray-400 flex items-center justify-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Redirecting to login page in 3 seconds...
            </p>
          </GlassCardContent>
          <GlassCardFooter>
            <Button
              onClick={() => router.push('/login')}
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-teal-600 to-green-600 hover:from-teal-700 hover:to-green-700 shadow-lg"
            >
              Go to Login Now
            </Button>
          </GlassCardFooter>
        </GlassCard>
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
            Ignite Your Team's<br />Unstoppable Motion
          </p>
          <p className="text-lg sm:text-xl text-teal-200/90 max-w-xl leading-relaxed">
            Join teams who've transformed scattered knowledge into actionable intelligence and accelerated execution.
          </p>
          <div className="flex flex-wrap gap-4 text-teal-300/80 text-sm font-medium pt-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span>AI-Powered Intelligence</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>Multimodal Content</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Team Collaboration</span>
            </div>
          </div>
        </div>

          <GlassCard className="w-full max-w-lg bg-white hover:bg-white shadow-2xl">
          <form onSubmit={handleSubmit}>
              <GlassCardHeader className="text-center space-y-2 pb-6">
                <GlassCardTitle className="font-headline text-3xl bg-gradient-to-r from-teal-600 to-green-600 bg-clip-text text-transparent">
                Start Building Momentum
                </GlassCardTitle>
                <GlassCardDescription className="text-base">
                Transform your team's knowledge into action
                </GlassCardDescription>
              </GlassCardHeader>
              <GlassCardContent className="space-y-5">
              <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="displayName" className="text-sm font-semibold text-gray-700">
                    Your Name
                  </Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="John Doe"
                    required
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      className="h-11 text-base border-gray-300 focus:ring-2 focus:ring-teal-500 bg-white text-gray-900"
                  />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="john@example.com"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="h-11 text-base border-gray-300 focus:ring-2 focus:ring-teal-500 bg-white text-gray-900"
                  />
                </div>
              </div>

                <div className="space-y-4 pt-2 border-t border-gray-200">
                <div className="space-y-2">
                    <Label htmlFor="brandName" className="text-sm font-semibold text-gray-700">
                    Team Name
                  </Label>
                  <Input
                    id="brandName"
                    type="text"
                    placeholder="e.g., Riverside High Tigers, Product Team"
                    required
                    value={formData.brandName}
                    onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                      className="h-11 text-base border-gray-300 focus:ring-2 focus:ring-teal-500 bg-white text-gray-900"
                  />
                    <p className="text-xs text-gray-600">
                    You'll be the team lead and can invite members later.
                  </p>
                </div>
              </div>

                <div className="space-y-4 pt-2 border-t border-gray-200">
                <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="h-11 text-base border-gray-300 focus:ring-2 focus:ring-teal-500 bg-white text-gray-900"
                  />
                  {formData.password && (
                    <div className="flex items-center gap-2 text-xs">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            passwordStrength.score <= 2
                              ? 'bg-red-500'
                              : passwordStrength.score === 3
                              ? 'bg-yellow-500'
                              : passwordStrength.score === 4
                              ? 'bg-blue-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                        />
                      </div>
                        <span className="text-gray-600">{passwordStrength.feedback}</span>
                    </div>
                  )}
                    <p className="text-xs text-gray-600">
                    At least 8 characters with uppercase, lowercase, numbers & symbols.
                  </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-semibold text-gray-700">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="h-11 text-base border-gray-300 focus:ring-2 focus:ring-teal-500 bg-white text-gray-900"
                  />
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                      <div className="flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="h-3 w-3" />
                      <span>Passwords do not match</span>
                    </div>
                  )}
                </div>
              </div>
              </GlassCardContent>
              <GlassCardFooter className="flex-col space-y-4 pt-2">
              <Button
                type="submit"
                disabled={isSigningUp || isGoogleSigningUp || formData.password !== formData.confirmPassword}
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-teal-600 to-green-600 hover:from-teal-700 hover:to-green-700 shadow-lg hover:shadow-xl transition-all"
              >
                {isSigningUp ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-5 w-5" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-5 w-5" />
                    Create Account
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
                disabled={isSigningUp || isGoogleSigningUp}
                onClick={handleGoogleSignUp}
                className="w-full h-12 text-base font-semibold border-gray-300 bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-all"
              >
                {isGoogleSigningUp ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-5 w-5" />
                    Signing up...
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
                    Sign up with Google
                  </>
                )}
              </Button>

                <p className="text-sm text-center text-gray-600">
                Already have an account?{' '}
                <Link
                  href="/login"
                    className="font-semibold text-teal-600 hover:text-teal-700 hover:underline"
                >
                  Login here →
                </Link>
              </p>
                <p className="text-xs text-center text-gray-500">
                By creating an account, you agree to our Terms of Service and Privacy Policy.
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
