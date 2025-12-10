'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MessageCircle, X, Brain, Loader2 } from 'lucide-react';
import { useGlobalChatbot } from '@/contexts/global-chatbot-context';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

export function GlobalChatbotTrigger() {
  const { isOpen, toggleChatbot, sharedIsLoading, sharedThinkingProcess } = useGlobalChatbot();
  const { user } = useAuth();
  const pathname = usePathname();

  // Don't show the trigger if user is not logged in
  if (!user) {
    return null;
  }

  // Don't show the trigger on the full-screen companion page
  if (pathname === '/companion') {
    return null;
  }

  const isThinking = sharedIsLoading && sharedThinkingProcess.length > 0;
  const latestThought = sharedThinkingProcess[sharedThinkingProcess.length - 1] || '';

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {/* Thinking Process Tooltip - Show when thinking and closed */}
      {isThinking && !isOpen && (
        <div className="mb-2 max-w-xs rounded-lg bg-background/95 backdrop-blur-sm border shadow-lg p-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start gap-2">
            <Brain className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground mb-1">Team Companion is thinking...</p>
              <p className="text-xs text-muted-foreground line-clamp-2 break-words">
                {latestThought}
              </p>
              {sharedThinkingProcess.length > 1 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {sharedThinkingProcess.length} steps completed
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat Bubble Button */}
      <Button
        onClick={toggleChatbot}
        size="lg"
        className={cn(
          "h-14 w-14 rounded-full shadow-lg transition-all hover:scale-110 relative overflow-hidden",
          isOpen && "scale-95",
          isThinking && !isOpen && "ring-2 ring-primary ring-offset-2"
        )}
        style={
          isThinking && !isOpen
            ? {
                background: 'linear-gradient(135deg, hsl(280, 70%, 35%) 0%, hsl(320, 65%, 50%) 25%, hsl(174, 62%, 48%) 50%, hsl(142, 76%, 55%) 75%, hsl(280, 70%, 35%) 100%)',
                backgroundSize: '300% 300%',
                animation: 'gradient-shift 3s ease infinite',
              }
            : {
                background: 'var(--brand-gradient-feature, linear-gradient(to right, hsl(174, 62%, 48%), hsl(142, 76%, 55%)))',
              }
        }
        aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
      >
        {/* Animated gradient overlay when thinking */}
        {isThinking && !isOpen && (
          <div
            className="absolute inset-0 opacity-80"
            style={{
              background: 'linear-gradient(135deg, hsl(280, 70%, 35%) 0%, hsl(320, 65%, 50%) 25%, hsl(174, 62%, 48%) 50%, hsl(142, 76%, 55%) 75%, hsl(280, 70%, 35%) 100%)',
              backgroundSize: '300% 300%',
              animation: 'gradient-shift 3s ease infinite',
            }}
          />
        )}
        
        <div className="relative z-10 flex items-center justify-center">
          {isOpen ? (
            <X className="h-6 w-6 text-white" />
          ) : isThinking ? (
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          ) : (
            <MessageCircle className="h-6 w-6 text-white" />
          )}
        </div>
      </Button>

      {/* Add CSS animation for gradient */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes gradient-shift {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }
        `
      }} />
    </div>
  );
}
