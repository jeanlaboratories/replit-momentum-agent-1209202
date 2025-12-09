'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Users, ShieldCheck, UserPlus, Mail, User, MoreHorizontal, MoreVertical, Trash2, Check, X, RefreshCw, Heart, ExternalLink, HandHeart, Building } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { PageTransition } from '@/components/ui/page-transition';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { BrandMember, BrandInvitation, BrandRole, Sponsorship, SponsorshipInvitation } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function TeamPage() {
  const { user, loading: authLoading, brandId } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  // State
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<BrandMember[]>([]);
  const [invitations, setInvitations] = useState<BrandInvitation[]>([]);
  const [sponsorships, setSponsorships] = useState<{ outgoing: Sponsorship[], incoming: Sponsorship[] }>({ outgoing: [], incoming: [] });
  const [sponsorshipInvitations, setSponsorshipInvitations] = useState<SponsorshipInvitation[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  
  // Invite dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [inviteRole, setInviteRole] = useState<BrandRole>('CONTRIBUTOR');

  // Sponsorship dialog state
  const [sponsorDialogOpen, setSponsorDialogOpen] = useState(false);
  const [sponsorEmail, setSponsorEmail] = useState('');
  const [sponsorNote, setSponsorNote] = useState('');

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'remove-member' | 'change-role' | 'cancel-invitation' | 'revoke-sponsorship';
    data?: any;
  }>({ isOpen: false, type: 'remove-member' });

  // Use brandId from auth context (not hardcoded)

  // Real team data loading using Firebase integration
  const loadTeamData = useCallback(async () => {
    // Early exit if user is not authenticated or auth is still loading
    if (!user?.uid || !brandId || authLoading) {
      return;
    }

    try {
      setLoading(true);
      
      // Import the real server actions
      const { getBrandMembersAction, getBrandInvitationsAction } = await import('../../actions/team-management');
      
      // Check again before making requests
      if (!user?.uid || authLoading) {
        return;
      }
      
      // Load members first
      const membersResult = await getBrandMembersAction(brandId);

      // Final check before updating state
      if (!user?.uid || authLoading) {
        return;
      }

      if (membersResult.members) {
        setMembers(membersResult.members);
        
        // Only load invitations if user is a manager
        const userRole = membersResult.members.find(member => member.userId === user?.uid)?.role;
        const isManager = userRole === 'MANAGER';
        
        if (isManager) {
          const invitationsResult = await getBrandInvitationsAction(brandId);
          
          if (!user?.uid || authLoading) {
            return;
          }
          
          if (invitationsResult.invitations) {
            setInvitations(invitationsResult.invitations);
          } else if (invitationsResult.error && !invitationsResult.error.includes('Permission denied')) {
            toast({
              title: 'Error loading invitations', 
              description: invitationsResult.error,
              variant: 'destructive'
            });
          }

          // Load pending sponsorship invitations for managers only  
          try {
            const { getPendingSponsorshipInvitationsAction } = await import('../../actions/sponsorship-management');
            const sponsorshipInvitationsResult = await getPendingSponsorshipInvitationsAction();

            if (!user?.uid || authLoading) {
              return;
            }

            if (sponsorshipInvitationsResult.invitations) {
              setSponsorshipInvitations(sponsorshipInvitationsResult.invitations);
            } else if (sponsorshipInvitationsResult.error) {
              console.error('Error loading sponsorship invitations:', sponsorshipInvitationsResult.error);
            }
          } catch (error) {
            console.error('Error loading sponsorship invitation data:', error);
          }
        } else {
          // Clear invitations and sponsorship invitations for non-managers  
          setInvitations([]);
          setSponsorshipInvitations([]);
        }

        // Load sponsorships for ALL users (both managers and contributors)
        try {
          const { getSponsorshipsAction } = await import('../../actions/sponsorship-management');
          const sponsorshipsResult = await getSponsorshipsAction(brandId);
          
          if (!user?.uid || authLoading) {
            return;
          }

          if (sponsorshipsResult.sponsorships) {
            setSponsorships(sponsorshipsResult.sponsorships);
          } else if (sponsorshipsResult.error) {
            console.error('Error loading sponsorships:', sponsorshipsResult.error);
          }
        } catch (error) {
          console.error('Error loading sponsorship data:', error);
        }
      } else if (membersResult.error) {
        toast({
          title: 'Error loading team members',
          description: membersResult.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      // Only show error if still authenticated
      if (user?.uid && !authLoading) {
        toast({
          title: 'Error loading team data',
          description: 'Failed to load team information',
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
    }
  }, [user, brandId, toast, authLoading]);

  // Handle invite user using real server action
  const handleInviteUser = async () => {
    if (!inviteEmail || !brandId) return;

    try {
      setActionLoading('invite');
      
      const { inviteUserAction } = await import('../../actions/team-management');
      const result = await inviteUserAction(brandId, inviteEmail, inviteDisplayName, inviteRole);
      
      if (result.success) {
        setInviteDialogOpen(false);
        setInviteEmail('');
        setInviteDisplayName('');
        setInviteRole('CONTRIBUTOR');
        
        // Only reload team data if user is still authenticated
        if (user?.uid && !authLoading) {
          loadTeamData();
        }
        
        toast({
          title: 'Invitation sent',
          description: result.message,
        });
      } else {
        toast({
          title: 'Error sending invitation',
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error sending invitation',
        description: 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle sponsorship invitation
  const handleSponsorshipInvitation = async () => {
    if (!sponsorEmail || !brandId) return;

    try {
      setActionLoading('sponsor-invite');
      
      const { initiateSponsorshipAction } = await import('../../actions/sponsorship-management');
      const result = await initiateSponsorshipAction(brandId, sponsorEmail, sponsorNote);
      
      if (result.success) {
        setSponsorDialogOpen(false);
        setSponsorEmail('');
        setSponsorNote('');
        
        // Only reload team data if user is still authenticated
        if (user?.uid && !authLoading) {
          loadTeamData();
        }
        
        toast({
          title: 'Sponsorship invitation sent',
          description: result.message,
        });
      } else {
        toast({
          title: 'Error sending sponsorship invitation',
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error sending sponsorship invitation',
        description: 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Handle navigate to sponsor brand profile
  const handleNavigateToSponsorBrand = (brandId: string) => {
    router.push(`/brand-profile?sponsor=${brandId}`);
  };

  // Handle revoke sponsorship (with confirmation)
  const handleRevokeSponsorhip = (sponsorBrandId: string, sponsoredBrandId: string, sponsorBrandName: string) => {
    setConfirmDialog({
      isOpen: true,
      type: 'revoke-sponsorship',
      data: { sponsorBrandId, sponsoredBrandId, sponsorBrandName }
    });
  };

  // Execute revoke sponsorship after confirmation
  const executeRevokeSponsorhip = async (sponsorBrandId: string, sponsoredBrandId: string) => {
    try {
      setActionLoading(`revoke-${sponsorBrandId}-${sponsoredBrandId}`);
      
      const { revokeSponsorshipAction } = await import('../../actions/sponsorship-management');
      const result = await revokeSponsorshipAction(sponsorBrandId, sponsoredBrandId);
      
      if (result.success) {
        // Only reload team data if user is still authenticated
        if (user?.uid && !authLoading) {
          loadTeamData();
        }
        
        toast({
          title: 'Sponsorship revoked',
          description: result.message,
        });
      } else {
        toast({
          title: 'Error revoking sponsorship',
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error revoking sponsorship',
        description: 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
      setConfirmDialog({ isOpen: false, type: 'revoke-sponsorship' });
    }
  };

  // Handle cancel invitation (with confirmation)
  const handleCancelInvitation = (email: string, role: BrandRole) => {
    setConfirmDialog({
      isOpen: true,
      type: 'cancel-invitation',
      data: { email, role }
    });
  };

  // Execute cancel invitation after confirmation using real server action
  const executeCancelInvitation = async (email: string) => {
    try {
      setActionLoading(`cancel-${email}`);
      
      const { cancelInvitationAction } = await import('../../actions/team-management');
      const result = await cancelInvitationAction(brandId!, email);
      
      if (result.success) {
        // Only reload team data if user is still authenticated
        if (user?.uid && !authLoading) {
          loadTeamData();
        }
        
        toast({
          title: 'Invitation cancelled',
          description: result.message,
        });
      } else {
        toast({
          title: 'Error cancelling invitation',
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error cancelling invitation',
        description: 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
      setConfirmDialog({ isOpen: false, type: 'cancel-invitation' });
    }
  };

  // Handle remove member (with confirmation)
  const handleRemoveMember = (userId: string, userName: string, userEmail: string) => {
    if (userId === user?.uid) return; // Can't remove self
    
    setConfirmDialog({
      isOpen: true,
      type: 'remove-member',
      data: { userId, userName, userEmail }
    });
  };

  // Execute remove member after confirmation using real server action
  const executeRemoveMember = async (userId: string, userName: string) => {
    try {
      setActionLoading(`remove-${userId}`);
      
      const { removeMemberAction } = await import('../../actions/team-management');
      const result = await removeMemberAction(brandId!, userId);
      
      if (result.success) {
        // Only reload team data if user is still authenticated
        if (user?.uid && !authLoading) {
          loadTeamData();
        }
        
        toast({
          title: 'Member removed', 
          description: result.message,
        });
      } else {
        toast({
          title: 'Error removing member',
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error removing member',
        description: 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
      setConfirmDialog({ isOpen: false, type: 'remove-member' });
    }
  };

  // Handle role change (with confirmation)
  const handleRoleChange = (userId: string, newRole: BrandRole, userName: string, currentRole: BrandRole) => {
    if (userId === user?.uid) return; // Can't change own role
    
    setConfirmDialog({
      isOpen: true,
      type: 'change-role',
      data: { userId, newRole, userName, currentRole }
    });
  };

  // Execute role change after confirmation using real server action
  const executeRoleChange = async (userId: string, newRole: BrandRole, userName: string) => {
    try {
      setActionLoading(`role-${userId}`);
      
      const { changeMemberRoleAction } = await import('../../actions/team-management');
      const result = await changeMemberRoleAction(brandId!, userId, newRole);
      
      if (result.success) {
        // Only reload team data if user is still authenticated
        if (user?.uid && !authLoading) {
          loadTeamData();
        }
        
        toast({
          title: 'Role updated',
          description: result.message,
        });
      } else {
        toast({
          title: 'Error updating role',
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error updating role',
        description: 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
      setConfirmDialog({ isOpen: false, type: 'change-role' });
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      // User is logged out - clear state and redirect
      setMembers([]);
      setInvitations([]);
      setLoading(false);
      router.push('/login');
      return;
    }
    
    if (user && !authLoading) {
      // Call loadTeamData directly without it being in dependencies to avoid circular dependency
      loadTeamData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, router]);

  // Add automatic refresh when page becomes visible (user switches back to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user && !authLoading) {
        // Page became visible and user is authenticated - refresh data
        loadTeamData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, authLoading, loadTeamData]);

  // Add window focus refresh for better UX
  useEffect(() => {
    const handleFocus = () => {
      if (user && !authLoading) {
        // Window gained focus and user is authenticated - refresh data
        loadTeamData();
      }
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, authLoading, loadTeamData]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground">Please log in to access team management.</p>
        </div>
      </div>
    );
  }

  // Get current user role
  const userRole = members.find(member => member.userId === user?.uid)?.role;
  const isManager = userRole === 'MANAGER';

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Team Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your creative team members and their roles
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={loadTeamData}
            disabled={loading}
            title="Refresh team data"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          
          {isManager && (
            <>
              <Dialog open={sponsorDialogOpen} onOpenChange={setSponsorDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Heart className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Sponsor Team</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Sponsor a Team</DialogTitle>
                    <DialogDescription>
                      Invite another team to access your team profile and resources
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="sponsor-email">Manager Email</Label>
                      <Input
                        id="sponsor-email"
                        type="email"
                        placeholder="manager@otherbrand.com"
                        value={sponsorEmail}
                        onChange={(e) => setSponsorEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="sponsor-note">Message (Optional)</Label>
                      <Input
                        id="sponsor-note"
                        placeholder="We'd love to sponsor your team..."
                        value={sponsorNote}
                        onChange={(e) => setSponsorNote(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => setSponsorDialogOpen(false)}
                        disabled={actionLoading === 'sponsor-invite'}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSponsorshipInvitation}
                        disabled={!sponsorEmail || actionLoading === 'sponsor-invite'}
                      >
                        {actionLoading === 'sponsor-invite' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Heart className="mr-2 h-4 w-4" />
                            Send Invitation
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden xs:inline">Invite</span>
                    <span className="hidden sm:inline ml-1">Team Member</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join your creative team
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="displayName">Full Name</Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="John Doe"
                    value={inviteDisplayName}
                    onChange={(e) => setInviteDisplayName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as BrandRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONTRIBUTOR">Contributor</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setInviteDialogOpen(false)}
                    disabled={actionLoading === 'invite'}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleInviteUser}
                    disabled={!inviteEmail || !inviteDisplayName || actionLoading === 'invite'}
                  >
                    {actionLoading === 'invite' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Invitation
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Team Members */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Team Members ({members.length})
          </GlassCardTitle>
          <GlassCardDescription>
            Current team members and their roles
          </GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent>
          {members.length === 0 ? (
            <div className="text-center py-8">
              <User className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No team members</h3>
              <p className="text-muted-foreground">Start by inviting your first team member.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead key="member">Member</TableHead>
                      <TableHead key="role">Role</TableHead>
                      <TableHead key="joined">Joined</TableHead>
                      {isManager && <TableHead key="actions" className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member, index) => (
                      <TableRow key={member?.id || `member-${index}`}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Avatar>
                              <AvatarImage src={member.userPhotoURL || undefined} />
                              <AvatarFallback>
                                {member.userDisplayName?.charAt(0)?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <Link href={`/brand-profile/personal?userId=${member.userId}`} className="font-medium hover:underline text-primary">
                                {member.userDisplayName || 'Unknown User'}
                              </Link>
                              <p className="text-sm text-muted-foreground">{member.userEmail || 'No email'}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={member.role === 'MANAGER' ? 'default' : 'secondary'}>
                            {member.role === 'MANAGER' ? (
                              <ShieldCheck className="mr-1 h-3 w-3" />
                            ) : (
                              <User className="mr-1 h-3 w-3" />
                            )}
                            {member.role === 'MANAGER' ? 'Manager' : 'Contributor'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'N/A'}
                        </TableCell>
                        {isManager && (
                          <TableCell className="text-right">
                            {member.userId !== user.uid && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    disabled={actionLoading?.startsWith(`role-${member.userId}`) || actionLoading?.startsWith(`remove-${member.userId}`)}
                                  >
                                    {(actionLoading?.startsWith(`role-${member.userId}`) || actionLoading?.startsWith(`remove-${member.userId}`)) ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <MoreHorizontal className="h-4 w-4" />
                                    )}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => handleRoleChange(
                                      member.userId,
                                      member.role === 'MANAGER' ? 'CONTRIBUTOR' : 'MANAGER',
                                      member.userDisplayName || member.userEmail,
                                      member.role
                                    )}
                                  >
                                    {member.role === 'MANAGER' ? 'Make Contributor' : 'Make Manager'}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-red-600"
                                    onClick={() => handleRemoveMember(member.userId, member.userDisplayName || member.userEmail, member.userEmail)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Remove Member
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-3">
                {members.map((member, index) => (
                  <div key={member?.id || `member-mobile-${index}`} className="flex items-start gap-3 p-4 border rounded-lg">
                    <Avatar className="flex-shrink-0">
                      <AvatarImage src={member.userPhotoURL || undefined} />
                      <AvatarFallback>
                        {member.userDisplayName?.charAt(0)?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <Link href={`/brand-profile/personal?userId=${member.userId}`} className="font-medium truncate hover:underline text-primary block">
                            {member.userDisplayName || 'Unknown User'}
                          </Link>
                          <p className="text-sm text-muted-foreground break-all">{member.userEmail || 'No email'}</p>
                        </div>
                        {isManager && member.userId !== user.uid && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="flex-shrink-0"
                                disabled={actionLoading?.startsWith(`role-${member.userId}`) || actionLoading?.startsWith(`remove-${member.userId}`)}
                              >
                                {(actionLoading?.startsWith(`role-${member.userId}`) || actionLoading?.startsWith(`remove-${member.userId}`)) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleRoleChange(
                                  member.userId,
                                  member.role === 'MANAGER' ? 'CONTRIBUTOR' : 'MANAGER',
                                  member.userDisplayName || member.userEmail,
                                  member.role
                                )}
                              >
                                {member.role === 'MANAGER' ? 'Make Contributor' : 'Make Manager'}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleRemoveMember(member.userId, member.userDisplayName || member.userEmail, member.userEmail)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove Member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant={member.role === 'MANAGER' ? 'default' : 'secondary'} className="text-xs">
                          {member.role === 'MANAGER' ? (
                            <ShieldCheck className="mr-1 h-3 w-3" />
                          ) : (
                            <User className="mr-1 h-3 w-3" />
                          )}
                          {member.role === 'MANAGER' ? 'Manager' : 'Contributor'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Joined {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Pending Invitations */}
      {isManager && (
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center">
              <Mail className="mr-2 h-5 w-5" />
              Pending Invitations ({invitations.length})
            </GlassCardTitle>
            <GlassCardDescription>
              Invitations awaiting response
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            {invitations.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No pending invitations</h3>
                <p className="text-muted-foreground">All invitations have been responded to.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead key="email">Email</TableHead>
                        <TableHead key="role">Role</TableHead>
                        <TableHead key="invited">Invited</TableHead>
                        <TableHead key="actions" className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitations.map((invitation) => (
                        <TableRow key={invitation.id}>
                          <TableCell className="font-medium">{invitation.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {invitation.role === 'MANAGER' ? 'Manager' : 'Contributor'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(invitation.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleCancelInvitation(invitation.email, invitation.role)}
                              disabled={actionLoading === `cancel-${invitation.email}`}
                            >
                              {actionLoading === `cancel-${invitation.email}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-3">
                  {invitations.map((invitation) => (
                    <div key={invitation.id} className="flex items-start justify-between gap-3 p-4 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium break-all">{invitation.email}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {invitation.role === 'MANAGER' ? 'Manager' : 'Contributor'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(invitation.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex-shrink-0"
                        onClick={() => handleCancelInvitation(invitation.email, invitation.role)}
                        disabled={actionLoading === `cancel-${invitation.email}`}
                      >
                        {actionLoading === `cancel-${invitation.email}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Sponsorships */}
      {isManager && (
        <GlassCard>
          <GlassCardHeader>
            <div className="flex items-center justify-between">
              <div>
                <GlassCardTitle className="flex items-center">
                  <Heart className="mr-2 h-5 w-5" />
                  Brand Sponsorships
                </GlassCardTitle>
                <GlassCardDescription>
                  Sponsor relationships and partnerships
                </GlassCardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/brands/${user?.brandId}/sponsors`)}
                className="flex items-center"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Manage Sponsors
              </Button>
            </div>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="space-y-6">
              {/* Outgoing Sponsorships */}
              <div>
                <h4 className="font-medium mb-3 flex items-center">
                  <HandHeart className="mr-2 h-4 w-4" />
                  Brands You Sponsor ({sponsorships.outgoing.length})
                </h4>
                {sponsorships.outgoing.length === 0 ? (
                  <div className="text-center py-4 border border-dashed rounded-lg">
                    <Building className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No brands sponsored yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sponsorships.outgoing.map((sponsorship) => (
                      <div key={sponsorship.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{sponsorship.sponsoredBrandName}</p>
                            <div className="text-sm text-muted-foreground">
                              Status: <Badge variant={sponsorship.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                {sponsorship.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {sponsorship.status === 'ACTIVE' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  disabled={actionLoading?.startsWith(`revoke-${sponsorship.sponsorBrandId}-${sponsorship.sponsoredBrandId}`)}
                                >
                                  {actionLoading?.startsWith(`revoke-${sponsorship.sponsorBrandId}-${sponsorship.sponsoredBrandId}`) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <MoreVertical className="h-4 w-4" />
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleRevokeSponsorhip(sponsorship.sponsorBrandId, sponsorship.sponsoredBrandId, sponsorship.sponsoredBrandName)}
                                >
                                  <X className="mr-2 h-4 w-4" />
                                  Revoke Sponsorship
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Incoming Sponsorships */}
              <div>
                <h4 className="font-medium mb-3 flex items-center">
                  <Heart className="mr-2 h-4 w-4" />
                  Brands Sponsoring You ({sponsorships.incoming.length})
                </h4>
                {sponsorships.incoming.length === 0 ? (
                  <div className="text-center py-4 border border-dashed rounded-lg">
                    <Heart className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No incoming sponsorships</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sponsorships.incoming.map((sponsorship) => (
                      <div key={sponsorship.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <div>
                            {sponsorship.status === 'ACTIVE' ? (
                              <button
                                onClick={() => handleNavigateToSponsorBrand(sponsorship.sponsorBrandId)}
                                className="font-medium text-primary hover:text-primary/80 hover:underline cursor-pointer text-left"
                              >
                                {sponsorship.sponsorBrandName}
                              </button>
                            ) : (
                              <p className="font-medium">{sponsorship.sponsorBrandName}</p>
                            )}
                            <div className="text-sm text-muted-foreground">
                              Status: <Badge variant={sponsorship.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                {sponsorship.status}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {sponsorship.status === 'ACTIVE' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleNavigateToSponsorBrand(sponsorship.sponsorBrandId)}
                              >
                                <ExternalLink className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">View Profile</span>
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    disabled={actionLoading?.startsWith(`revoke-${sponsorship.sponsorBrandId}-${sponsorship.sponsoredBrandId}`)}
                                  >
                                    {actionLoading?.startsWith(`revoke-${sponsorship.sponsorBrandId}-${sponsorship.sponsoredBrandId}`) ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <MoreVertical className="h-4 w-4" />
                                    )}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => handleRevokeSponsorhip(sponsorship.sponsorBrandId, sponsorship.sponsoredBrandId, sponsorship.sponsorBrandName)}
                                  >
                                    <X className="mr-2 h-4 w-4" />
                                    Revoke Sponsorship
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Pending Sponsorship Invitations */}
      {sponsorshipInvitations.length > 0 && (
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="flex items-center">
              <Mail className="mr-2 h-5 w-5" />
              Pending Sponsorship Invitations ({sponsorshipInvitations.length})
            </GlassCardTitle>
            <GlassCardDescription>
              Sponsorship invitations awaiting your response
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="space-y-3">
              {sponsorshipInvitations.map((invitation) => (
                <div key={invitation.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium">{invitation.sponsorBrandName}</p>
                        <p className="text-sm text-muted-foreground">
                          wants to sponsor your team
                        </p>
                      </div>
                      {invitation.note && (
                        <div className="p-3 bg-muted rounded-md">
                          <p className="text-sm italic">"{invitation.note}"</p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Invited by {invitation.initiatedByName} • {new Date(invitation.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <Button 
                        size="sm"
                        onClick={() => {
                          router.push(`/sponsorship/invite/${invitation.token}`);
                        }}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Review
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, isOpen: open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.type === 'remove-member' && 'Remove Team Member'}
              {confirmDialog.type === 'change-role' && 'Change Member Role'}
              {confirmDialog.type === 'cancel-invitation' && 'Cancel Invitation'}
              {confirmDialog.type === 'revoke-sponsorship' && 'Revoke Sponsorship'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.type === 'remove-member' && (
                <>This action cannot be undone. {confirmDialog.data?.userName} will lose access to the team and all associated data.</>
              )}
              {confirmDialog.type === 'change-role' && (
                <>Change {confirmDialog.data?.userName}'s role from {confirmDialog.data?.currentRole?.toLowerCase()} to {confirmDialog.data?.newRole?.toLowerCase()}?</>
              )}
              {confirmDialog.type === 'cancel-invitation' && (
                <>Cancel the pending invitation for {confirmDialog.data?.email}? They won't be able to use this invitation link.</>
              )}
              {confirmDialog.type === 'revoke-sponsorship' && (
                <>Are you sure you want to revoke the sponsorship with {confirmDialog.data?.sponsorBrandName}? They will lose read-only access to your team profile.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
              disabled={actionLoading !== null}
            >
              Cancel
            </Button>
            <Button
              variant={confirmDialog.type === 'change-role' ? 'default' : 'destructive'}
              onClick={() => {
                if (confirmDialog.type === 'remove-member') {
                  executeRemoveMember(confirmDialog.data.userId, confirmDialog.data.userName);
                } else if (confirmDialog.type === 'change-role') {
                  executeRoleChange(confirmDialog.data.userId, confirmDialog.data.newRole, confirmDialog.data.userName);
                } else if (confirmDialog.type === 'cancel-invitation') {
                  executeCancelInvitation(confirmDialog.data.email);
                } else if (confirmDialog.type === 'revoke-sponsorship') {
                  executeRevokeSponsorhip(confirmDialog.data.sponsorBrandId, confirmDialog.data.sponsoredBrandId);
                }
              }}
              disabled={actionLoading !== null}
            >
              {actionLoading !== null ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {confirmDialog.type === 'remove-member' && (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove Member
                    </>
                  )}
                  {confirmDialog.type === 'change-role' && 'Change Role'}
                  {confirmDialog.type === 'cancel-invitation' && (
                    <>
                      <X className="mr-2 h-4 w-4" />
                      Cancel Invitation
                    </>
                  )}
                  {confirmDialog.type === 'revoke-sponsorship' && (
                    <>
                      <X className="mr-2 h-4 w-4" />
                      Revoke Sponsorship
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
