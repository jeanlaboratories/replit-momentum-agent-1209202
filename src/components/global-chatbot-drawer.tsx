'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGlobalChatbot } from '@/contexts/global-chatbot-context';
import { GeminiChatbot } from '@/components/gemini-chatbot';
import { cn } from '@/lib/utils';
import { X, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

export function GlobalChatbotDrawer() {
  const { isOpen, closeChatbot } = useGlobalChatbot();
  const { user, brandId } = useAuth();
  const router = useRouter();

  const handleExpand = () => {
    closeChatbot();
    router.push('/companion');
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Don't render the drawer if user is not logged in
  if (!user) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={closeChatbot}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full md:w-[600px] lg:w-[700px] bg-background shadow-2xl z-50",
          "transform transition-transform duration-300 ease-in-out",
          "flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-6 py-4"
          style={{
            background: 'var(--brand-gradient-hero, linear-gradient(to right, hsl(280, 70%, 35%), hsl(320, 65%, 50%)))',
            color: 'hsl(var(--brand-hero-foreground, 0 0% 100%))',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <span className="text-2xl" style={{ color: 'hsl(var(--brand-hero-foreground, 0 0% 100%))' }}>✨</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold" style={{ color: 'hsl(var(--brand-hero-foreground, 0 0% 100%))' }}>Team Companion</h2>
              <p className="text-sm opacity-80" style={{ color: 'hsl(var(--brand-hero-foreground, 0 0% 100%))' }}>Your intelligence & execution partner</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleExpand}
              className="hover:bg-white/20 rounded-full"
              style={{ color: 'hsl(var(--brand-hero-foreground, 0 0% 100%))' }}
              aria-label="Expand to full screen"
              title="Open full screen"
            >
              <Maximize2 className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeChatbot}
              className="hover:bg-white/20 rounded-full"
              style={{ color: 'hsl(var(--brand-hero-foreground, 0 0% 100%))' }}
              aria-label="Close AI Assistant"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Chatbot Content */}
        <div className="flex-1 overflow-hidden">
          <GeminiChatbot brandId={brandId || undefined} />
        </div>
      </div>
    </>
  );
}
