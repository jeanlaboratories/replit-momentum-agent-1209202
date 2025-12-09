'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardFooter, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { PageTransition } from '@/components/ui/page-transition';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Zap } from 'lucide-react';

interface InvitationData {
  brandName: string;
  role: string;
  inviterName: string;
  email: string;
}

export default function AcceptInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const token = params.token as string;
  
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function verifyInvitation() {
      try {
        const response = await fetch(`/api/invitations/verify?token=${token}`);
        const data = await response.json();
        
        if (data.success && data.invitation) {
          setInvitation(data.invitation);
        } else {
          setError(data.message || 'Invalid or expired invitation');
        }
      } catch (err) {
        setError('Failed to verify invitation');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      verifyInvitation();
    }
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    
    try {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Show success message and redirect based on user type
        if (data.isNewUser) {
          toast({
            title: 'Welcome to MOMENTUM!',
            description: 'Check your email to set your password and get started.',
          });
        } else {
          toast({
            title: 'Success!',
            description: 'You can now login with your existing credentials.',
          });
        }
        
        // Redirect to login page after 2 seconds
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: data.message || 'Failed to accept invitation',
        });
        setAccepting(false);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred',
      });
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <PageTransition>
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-950 via-teal-900 to-green-950">
        <div className="text-center">
          <Loader2 className="h-16 w-16 animate-spin text-teal-300 mx-auto mb-4" />
          <p className="text-teal-100 text-lg font-medium">Verifying invitation...</p>
        </div>
      </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-950 via-teal-900 to-green-950 p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <Zap className="h-12 w-12 text-teal-300" strokeWidth={2.5} />
            <h1 className="font-headline text-5xl font-bold text-white">MOMENTUM</h1>
          </div>
          <p className="text-xl text-teal-200">Team Invitation</p>
        </div>

          <GlassCard className="bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl">
          {error ? (
            <>
                <GlassCardHeader className="text-center pb-6">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="h-10 w-10 text-red-600" />
                </div>
                  <GlassCardTitle className="text-2xl text-red-900">Invalid Invitation</GlassCardTitle>
                  <GlassCardDescription className="text-base text-gray-600">{error}</GlassCardDescription>
                </GlassCardHeader>
                <GlassCardFooter className="flex-col space-y-4">
                <Button
                  onClick={() => router.push('/login')}
                  className="w-full bg-gradient-to-r from-teal-600 to-green-600 hover:from-teal-700 hover:to-green-700"
                >
                  Go to Login
                </Button>
                </GlassCardFooter>
            </>
          ) : invitation ? (
            <>
                  <GlassCardHeader className="text-center pb-6">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-teal-100 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-teal-600" />
                </div>
                    <GlassCardTitle className="text-2xl bg-gradient-to-r from-teal-600 to-green-600 bg-clip-text text-transparent">
                  You're Invited!
                    </GlassCardTitle>
                    <GlassCardDescription className="text-base">
                  Join the team on MOMENTUM
                    </GlassCardDescription>
                  </GlassCardHeader>
              
                  <GlassCardContent className="space-y-6">
                <div className="bg-gradient-to-r from-teal-50 to-green-50 border border-teal-200 rounded-lg p-6">
                  <h3 className="font-semibold text-lg text-gray-900 mb-4">Invitation Details</h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Team</dt>
                      <dd className="text-base font-semibold text-gray-900">{invitation.brandName}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Your Role</dt>
                      <dd className="text-base font-semibold text-gray-900">
                        {invitation.role === 'MANAGER' ? 'Team Lead' : 'Contributor'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Invited By</dt>
                      <dd className="text-base font-semibold text-gray-900">{invitation.inviterName}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Your Email</dt>
                      <dd className="text-base font-semibold text-gray-900">{invitation.email}</dd>
                    </div>
                  </dl>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-900 mb-2">Next Steps:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-amber-800">
                    <li>Click "Accept Invitation" below</li>
                    <li>Create a secure password for your account</li>
                    <li>Start collaborating with your team!</li>
                  </ol>
                </div>
                  </GlassCardContent>

                  <GlassCardFooter className="flex-col space-y-4">
                <Button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-teal-600 to-green-600 hover:from-teal-700 hover:to-green-700 shadow-lg hover:shadow-xl transition-all"
                >
                  {accepting ? (
                    <>
                      <Loader2 className="animate-spin mr-2 h-5 w-5" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-5 w-5" />
                      Accept Invitation
                    </>
                  )}
                </Button>
                <p className="text-sm text-center text-gray-500">
                  Already have an account?{' '}
                  <a href="/login" className="font-semibold text-teal-600 hover:text-teal-700 hover:underline">
                    Log in here
                  </a>
                </p>
                  </GlassCardFooter>
            </>
          ) : null}
          </GlassCard>
      </div>
    </div>
    </PageTransition>
  );
}
