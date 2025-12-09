'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Heart, Building2, Calendar, User } from 'lucide-react';
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { PageTransition } from '@/components/ui/page-transition';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SponsorshipInvitation } from '@/lib/types';
import { 
  approveSponsorshipAction, 
  declineSponsorshipAction,
  getSponsorshipInvitationByTokenAction 
} from '@/app/actions/sponsorship-management';

export default function SponsorshipInvitePage() {
  const { token } = useParams() as { token: string };
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [invitation, setInvitation] = useState<SponsorshipInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInvitation = async () => {
      if (!token) {
        setError('Invalid invitation link');
        setLoading(false);
        return;
      }

      try {
        const { invitation: invitationData, error } = await getSponsorshipInvitationByTokenAction(token);
        
        if (error || !invitationData) {
          setError(error || 'Invitation not found or has expired');
        } else {
          setInvitation(invitationData);
        }
      } catch (e) {
        setError('Failed to load invitation');
      } finally {
        setLoading(false);
      }
    };

    loadInvitation();
  }, [token]);

  const handleAccept = async () => {
    if (!invitation || !user?.email) return;
    
    setProcessing(true);
    try {
      const result = await approveSponsorshipAction(invitation.token);
      
      if (result.success) {
        toast({
          title: 'Sponsorship Accepted!',
          description: 'You now have sponsored access to this brand profile.',
        });
        router.push('/settings/team');
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to Accept',
          description: result.message,
        });
      }
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An error occurred while accepting the invitation.',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!invitation) return;
    
    setProcessing(true);
    try {
      const result = await declineSponsorshipAction(invitation.token);
      
      if (result.success) {
        toast({
          title: 'Invitation Declined',
          description: 'The sponsorship invitation has been declined.',
        });
        router.push('/');
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to Decline',
          description: result.message,
        });
      }
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An error occurred while declining the invitation.',
      });
    } finally {
      setProcessing(false);
    }
  };

  // Show loading spinner while authenticating or loading invitation
  if (authLoading || loading) {
    return (
      <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-md">
            <GlassCardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading invitation...</p>
            </GlassCardContent>
          </GlassCard>
      </div>
      </PageTransition>
    );
  }

  // Show authentication required if not logged in
  if (!user) {
    return (
      <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-md">
            <GlassCardHeader className="text-center">
              <GlassCardTitle className="flex items-center justify-center gap-2">
              <Heart className="h-6 w-6 text-primary" />
              Authentication Required
              </GlassCardTitle>
              <GlassCardDescription>
              Please log in to view and respond to this sponsorship invitation.
              </GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent className="text-center">
            <Button onClick={() => router.push('/login')} className="w-full">
              Login to Continue
            </Button>
            </GlassCardContent>
          </GlassCard>
      </div>
      </PageTransition>
    );
  }

  // Show error state if invitation not found or invalid
  if (error || !invitation) {
    return (
      <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-md">
            <GlassCardHeader className="text-center">
              <GlassCardTitle className="flex items-center justify-center gap-2 text-destructive">
              <XCircle className="h-6 w-6" />
              Invalid Invitation
              </GlassCardTitle>
              <GlassCardDescription>
              {error || 'This invitation link is invalid or has expired.'}
              </GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent className="text-center">
            <Button variant="outline" onClick={() => router.push('/')} className="w-full">
              Return Home
            </Button>
            </GlassCardContent>
          </GlassCard>
      </div>
      </PageTransition>
    );
  }

  // Check if invitation is for current user
  const isForCurrentUser = invitation.managerEmail === user.email;

  if (!isForCurrentUser) {
    return (
      <PageTransition>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-md">
            <GlassCardHeader className="text-center">
              <GlassCardTitle className="flex items-center justify-center gap-2 text-amber-600">
              <XCircle className="h-6 w-6" />
              Not Your Invitation
              </GlassCardTitle>
              <GlassCardDescription>
              This invitation is for {invitation.managerEmail}, but you're logged in as {user.email}.
              </GlassCardDescription>
            </GlassCardHeader>
            <GlassCardContent className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Please log in with the correct email address or ask for a new invitation.
            </p>
            <Button variant="outline" onClick={() => router.push('/login')} className="w-full">
              Switch Account
            </Button>
            </GlassCardContent>
          </GlassCard>
      </div>
      </PageTransition>
    );
  }

  // Show invitation details and response options
  return (
    <PageTransition>
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
        <GlassCard className="w-full max-w-2xl">
          <GlassCardHeader className="text-center pb-6">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Heart className="h-8 w-8 text-primary" />
              <GlassCardTitle className="text-2xl">Sponsorship Invitation</GlassCardTitle>
          </div>
            <GlassCardDescription className="text-lg">
            You've been invited to establish a sponsorship relationship
            </GlassCardDescription>
          </GlassCardHeader>

          <GlassCardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="bg-muted/50 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Sponsor Brand</p>
                <p className="text-sm text-muted-foreground">{invitation.sponsorBrandName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Invited By</p>
                <p className="text-sm text-muted-foreground">{invitation.initiatedByName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Invitation Date</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(invitation.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {invitation.note && (
              <div className="pt-2 border-t">
                <p className="font-medium mb-2">Message</p>
                <p className="text-sm text-muted-foreground italic">"{invitation.note}"</p>
              </div>
            )}
          </div>

          {/* What This Means */}
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
            <h4 className="font-medium text-blue-900 mb-2">What This Means</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• You'll be able to view {invitation.sponsorBrandName}'s brand profile in read-only mode</p>
              <p>• Access their brand information, documents, and marketing assets</p>
              <p>• See their AI-generated content and campaigns for inspiration</p>
              <p>• Cannot edit, download, or generate new content</p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge variant="outline" className="px-4 py-2">
              Status: {invitation.status}
            </Badge>
          </div>

          {/* Action Buttons */}
          {invitation.status === 'PENDING' && (
            <div className="flex gap-4 pt-4">
              <Button
                onClick={handleDecline}
                variant="outline"
                disabled={processing}
                className="flex-1"
              >
                {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                Decline
              </Button>
              <Button
                onClick={handleAccept}
                disabled={processing}
                className="flex-1"
              >
                {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Accept Invitation
              </Button>
            </div>
          )}

          {invitation.status !== 'PENDING' && (
            <div className="text-center pt-4">
              <p className="text-muted-foreground mb-4">
                This invitation has already been {invitation.status.toLowerCase()}.
              </p>
              <Button variant="outline" onClick={() => router.push('/')}>
                Return Home
              </Button>
            </div>
          )}
          </GlassCardContent>
        </GlassCard>
    </div>
    </PageTransition>
  );
}
