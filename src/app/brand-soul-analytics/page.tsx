'use client';

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BrandSoulAnalyticsDashboard } from '@/components/brand-soul-analytics-dashboard';
import { PageTransition } from '@/components/ui/page-transition';

export default function BrandSoulAnalyticsPage() {
  const { user, brandId, loading: authLoading } = useAuth();
  const router = useRouter();

  if (authLoading || !user) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!brandId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No Brand Selected</h2>
          <p className="text-muted-foreground mb-6">Please select or create a brand to view analytics.</p>
          <Link href="/brand-profile">
            <Button>Go to Brand Profile</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PageTransition className="container mx-auto px-4 py-8 md:px-6 md:py-12">
      <div className="mb-6">
        <Link href="/brand-profile">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Brand Profile
          </Button>
        </Link>
      </div>

      <BrandSoulAnalyticsDashboard brandId={brandId} />
    </PageTransition>
  );
}
