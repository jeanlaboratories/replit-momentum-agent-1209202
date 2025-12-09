'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MessageCircle, X } from 'lucide-react';
import { useGlobalChatbot } from '@/contexts/global-chatbot-context';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

export function GlobalChatbotTrigger() {
  const { isOpen, toggleChatbot } = useGlobalChatbot();
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

  return (
    <Button
      onClick={toggleChatbot}
      size="lg"
      className={cn(
        "fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg transition-all hover:scale-110",
        isOpen && "scale-95"
      )}
      style={{
        background: 'var(--brand-gradient-feature, linear-gradient(to right, hsl(174, 62%, 48%), hsl(142, 76%, 55%)))',
      }}
      aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
    >
      {isOpen ? (
        <X className="h-6 w-6 text-white" />
      ) : (
        <MessageCircle className="h-6 w-6 text-white" />
      )}
    </Button>
  );
}
