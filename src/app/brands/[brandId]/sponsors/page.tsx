import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/secure-auth';
import { requireBrandRole } from '@/lib/brand-membership';
import { getSponsorshipsAction, getPendingSponsorshipInvitationsAction } from '@/app/actions/sponsorship-management';
import SponsorManagement from './SponsorManagement';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { Loader2 } from 'lucide-react';

interface SponsorPageProps {
  params: Promise<{
    brandId: string;
  }>;
}

// Loading component for Suspense boundary
function SponsorPageLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-center py-12">
        <GlassCard>
          <GlassCardContent className="flex items-center space-x-4 py-6">
            <Loader2 className="h-6 w-6 animate-spin" />
            <div>Loading sponsor management...</div>
          </GlassCardContent>
        </GlassCard>
      </div>
    </div>
  );
}

// Server component to handle data loading and access control
async function SponsorPageContent({ params }: SponsorPageProps) {
  const { brandId } = await params;
  
  try {
    // Authenticate user and enforce manager access
    const user = await getAuthenticatedUser();
    await requireBrandRole(user.uid, brandId, 'MANAGER');

    // Fetch sponsorship data
    const { sponsorships, error: sponsorshipsError } = await getSponsorshipsAction(brandId);
    const { invitations, error: invitationsError } = await getPendingSponsorshipInvitationsAction();

    if (sponsorshipsError) {
      throw new Error(sponsorshipsError);
    }

    // Pass data to client component
    return (
      <SponsorManagement
        brandId={brandId}
        initialSponsorships={sponsorships || { outgoing: [], incoming: [] }}
        initialInvitations={invitations || []}
        user={user}
      />
    );
  } catch (error) {
    console.error('Error loading sponsor page:', error);
    redirect('/settings/team');
  }
}

// Main page component with Suspense boundary
export default function SponsorPage(props: SponsorPageProps) {
  return (
    <Suspense fallback={<SponsorPageLoading />}>
      <SponsorPageContent {...props} />
    </Suspense>
  );
}