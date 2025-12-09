import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Header } from '@/components/layout/header';
import { AuthProvider } from '@/hooks/use-auth';
import { BrandDataProvider } from '@/hooks/use-brand-data';
import { BrandThemeProvider } from '@/contexts/brand-theme-context';
import { GlobalChatbotProvider } from '@/contexts/global-chatbot-context';
import { GlobalChatbotDrawer } from '@/components/global-chatbot-drawer';
import { GlobalChatbotTrigger } from '@/components/global-chatbot-trigger';
import { TimezoneProvider } from '@/contexts/TimezoneContext';
import { GenerationTrackingProvider } from '@/components/generation-tracking-provider';
import { JobQueueProvider } from '@/contexts/job-queue-context';
import { Suspense } from 'react';


export const metadata: Metadata = {
  title: 'MOMENTUM',
  description: 'AI Team Intelligence & Execution Platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className="font-body antialiased h-full overflow-hidden">
        <AuthProvider>
          <BrandDataProvider>
            <Suspense fallback={null}>
              <BrandThemeProvider>
                <TimezoneProvider>
                  <GlobalChatbotProvider>
                    <JobQueueProvider>
                      <GenerationTrackingProvider>
                        <div className="flex h-full flex-col">
                          <Header />
                          <main className="flex-1 overflow-auto">{children}</main>
                        </div>
                        <Toaster />
                        <GlobalChatbotDrawer />
                        <GlobalChatbotTrigger />
                      </GenerationTrackingProvider>
                    </JobQueueProvider>
                  </GlobalChatbotProvider>
                </TimezoneProvider>
              </BrandThemeProvider>
            </Suspense>
          </BrandDataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
