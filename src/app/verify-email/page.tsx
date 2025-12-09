'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { resendVerificationEmailAction } from '@/app/actions/signup';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (resendCount >= 3) {
      toast({
        variant: 'destructive',
        title: 'Rate Limit Exceeded',
        description: 'Maximum resend attempts reached. Please try again later or contact support.',
      });
      return;
    }

    setIsResending(true);

    const result = await resendVerificationEmailAction(email);

    setIsResending(false);

    if (result.success) {
      setShowSuccess(true);
      setResendCount(resendCount + 1);
      setCooldown(60); // 60 second cooldown
      toast({
        title: 'Email Sent!',
        description: result.message,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to Send',
        description: result.message,
      });
    }
  };

  if (showSuccess) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-background p-4">
        <GlassCard className="mx-auto w-full max-w-md">
          <GlassCardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <GlassCardTitle className="font-headline text-2xl">Email Sent!</GlassCardTitle>
            <GlassCardDescription className="mt-4">
              We've sent a new verification link to <strong>{email}</strong>
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
              <p className="font-medium mb-2">Next Steps:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Check your inbox and spam folder</li>
                <li>Click the verification link in the email</li>
                <li>Return to login to access your account</li>
              </ol>
            </div>
            {resendCount < 3 && (
              <p className="text-sm text-muted-foreground text-center">
                Didn't receive it?{' '}
                {cooldown > 0 ? (
                  <span className="text-amber-600">Wait {cooldown}s to resend</span>
                ) : (
                  <button
                    onClick={() => {
                      setShowSuccess(false);
                      handleResend(new Event('submit') as any);
                    }}
                    className="text-primary hover:underline"
                  >
                    Resend email
                  </button>
                )}
              </p>
            )}
          </GlassCardContent>
          <GlassCardFooter>
            <Button asChild className="w-full">
              <Link href="/login">Go to Login</Link>
            </Button>
          </GlassCardFooter>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-background p-4">
      <GlassCard className="mx-auto w-full max-w-md">
        <form onSubmit={handleResend}>
          <GlassCardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
            <GlassCardTitle className="font-headline text-2xl">Verify Your Email</GlassCardTitle>
            <GlassCardDescription className="mt-4">
              Enter your email address to receive a new verification link
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
              <p className="font-medium mb-1">Email Not Arriving?</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Check your spam or junk folder</li>
                <li>Ensure the email address is correct</li>
                <li>Wait a few minutes for delivery</li>
                <li>Contact support if issues persist</li>
              </ul>
            </div>

            {resendCount > 0 && (
              <p className="text-xs text-center text-muted-foreground">
                Resent {resendCount} time{resendCount > 1 ? 's' : ''} {resendCount >= 3 && '(limit reached)'}
              </p>
            )}
          </GlassCardContent>
          <GlassCardFooter className="flex-col space-y-3">
            <Button
              type="submit"
              disabled={isResending || resendCount >= 3 || cooldown > 0}
              className="w-full"
            >
              {isResending ? (
                <>
                  <Loader2 className="animate-spin mr-2" />
                  Sending...
                </>
              ) : cooldown > 0 ? (
                <>Wait {cooldown}s</>
              ) : (
                <>
                  <Mail className="mr-2" />
                  {resendCount > 0 ? 'Resend' : 'Send'} Verification Email
                </>
              )}
            </Button>
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              ← Back to Login
            </Link>
          </GlassCardFooter>
        </form>
      </GlassCard>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    }>
      <PageTransition>
        <VerifyEmailContent />
      </PageTransition>
    </Suspense>
  );
}
