'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { GeminiChatbot } from '@/components/gemini-chatbot';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, Minimize2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGlobalChatbot } from '@/contexts/global-chatbot-context';
import { PageTransition } from '@/components/ui/page-transition';

/**
 * Full-screen Team Companion page
 *
 * This provides a ChatGPT/Claude/Gemini-like centered chat interface
 * with all the same capabilities as the drawer mode.
 */
export default function CompanionPage() {
  const { user, loading: authLoading, brandId } = useAuth();
  const router = useRouter();
  const { openChatbot } = useGlobalChatbot();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render if not authenticated
  if (!user) {
    return null;
  }

  const handleMinimize = () => {
    // Open the drawer and navigate away
    openChatbot();
    router.push('/');
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Minimal Header */}
      <header
        className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0"
        style={{
          background: 'var(--brand-gradient-hero, linear-gradient(to right, hsl(280, 70%, 35%), hsl(320, 65%, 50%)))',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <Sparkles className="h-5 w-5" style={{ color: 'hsl(var(--brand-hero-foreground, 0 0% 100%))' }} />
          </div>
          <div>
            <h1
              className="text-lg font-semibold"
              style={{ color: 'hsl(var(--brand-hero-foreground, 0 0% 100%))' }}
            >
              Team Companion
            </h1>
            <p
              className="text-xs opacity-80"
              style={{ color: 'hsl(var(--brand-hero-foreground, 0 0% 100%))' }}
            >
              Your intelligence & execution partner
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleMinimize}
          className="hover:bg-white/20 rounded-full gap-2"
          style={{ color: 'hsl(var(--brand-hero-foreground, 0 0% 100%))' }}
          aria-label="Minimize to drawer"
        >
          <Minimize2 className="h-4 w-4" />
          <span className="hidden sm:inline">Minimize</span>
        </Button>
      </header>

      {/* Chat Container - Centered like ChatGPT/Claude/Gemini */}
      <main className="flex-1 overflow-hidden min-h-0">
        <div className="h-full max-w-4xl mx-auto">
          <GeminiChatbot brandId={brandId || undefined} isFullScreen={true} />
        </div>
      </main>
    </div>
  );
}
