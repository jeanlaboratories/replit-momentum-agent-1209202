'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import {
  GlassCard,
  GlassCardContent,
  GlassCardDescription,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardFooter
} from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Building,
  Heart,
  HandHeart,
  Users,
  Eye,
  MoreHorizontal,
  Trash2,
  Mail,
  Calendar,
  ExternalLink,
  UserPlus,
  AlertTriangle,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Sponsorship, SponsorshipInvitation } from '@/lib/types';
import { AuthenticatedUser } from '@/lib/secure-auth';
import { 
  revokeSponsorshipAction, 
  initiateSponsorshipAction,
  getSponsorshipsAction,
  getPendingSponsorshipInvitationsAction
} from '@/app/actions/sponsorship-management';

interface SponsorManagementProps {
  brandId: string;
  initialSponsorships: { outgoing: Sponsorship[], incoming: Sponsorship[] };
  initialInvitations: SponsorshipInvitation[];
  user: AuthenticatedUser;
}

export default function SponsorManagement({ 
  brandId, 
  initialSponsorships, 
  initialInvitations,
  user 
}: SponsorManagementProps) {
  const { toast } = useToast();
  const router = useRouter();

  // State management
  const [sponsorships, setSponsorships] = useState(initialSponsorships);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Modal states
  const [selectedSponsorship, setSelectedSponsorship] = useState<Sponsorship | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  
  // Invite form state
  const [inviteForm, setInviteForm] = useState({
    managerEmail: '',
    note: ''
  });

  // Client-side hydration flag to prevent hydration mismatches
  const [isClient, setIsClient] = useState(false);

  // Set client flag after mount to prevent hydration mismatches
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Refresh sponsorship data and invitations
  const refreshSponsorships = async () => {
    setLoading(true);
    try {
      const [sponsorshipsResult, invitationsResult] = await Promise.all([
        getSponsorshipsAction(brandId),
        getPendingSponsorshipInvitationsAction()
      ]);

      if (sponsorshipsResult.error) {
      toast({ variant: 'destructive', title: 'Error', description: sponsorshipsResult.error });
      } else if (sponsorshipsResult.sponsorships) {
        setSponsorships(sponsorshipsResult.sponsorships);
      }

      if (invitationsResult.error) {
      toast({ variant: 'destructive', title: 'Error', description: invitationsResult.error });
      } else if (invitationsResult.invitations) {
        setInvitations(invitationsResult.invitations);
      }
    } catch (error) {
      console.error('Error refreshing sponsorships:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to refresh sponsorship data.' });
    } finally {
      setLoading(false);
    }
  };

  // Handle sponsorship revocation
  const handleRevokeSponsorhip = async (sponsorBrandId: string, sponsoredBrandId: string) => {
    const actionKey = `revoke-${sponsorBrandId}-${sponsoredBrandId}`;
    setActionLoading(actionKey);
    
    try {
      const { success, message } = await revokeSponsorshipAction(sponsorBrandId, sponsoredBrandId);
      if (success) {
      toast({ title: 'Success', description: message });
        await refreshSponsorships();
      } else {
      toast({ variant: 'destructive', title: 'Error', description: message });
      }
    } catch (error) {
      console.error('Error revoking sponsorship:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to revoke sponsorship.' });
    } finally {
      setActionLoading(null);
      setShowRevokeDialog(false);
      setSelectedSponsorship(null);
    }
  };

  // Handle new sponsorship invitation
  const handleSendInvitation = async () => {
    if (!inviteForm.managerEmail.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Manager email is required.' });
      return;
    }

    setActionLoading('invite');
    try {
      const { success, message } = await initiateSponsorshipAction(
        brandId,
        inviteForm.managerEmail.trim(),
        inviteForm.note.trim() || undefined
      );
      
      if (success) {
      toast({ title: 'Success', description: message });
        setInviteForm({ managerEmail: '', note: '' });
        setShowInviteModal(false);
        await refreshSponsorships();
      } else {
      toast({ variant: 'destructive', title: 'Error', description: message });
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to send sponsorship invitation.' });
    } finally {
      setActionLoading(null);
    }
  };

  // Navigate to sponsored brand profile
  const viewSponsoredBrandProfile = (sponsoredBrandId: string) => {
    router.push(`/brand-profile?sponsor=${sponsoredBrandId}`);
  };

  // Navigate to sponsor brand profile (when sponsored brand wants to view their sponsor)
  const viewSponsorBrandProfile = (sponsorBrandId: string) => {
    router.push(`/brand-profile?sponsor=${sponsorBrandId}`);
  };

  // Calculate summary statistics
  const stats = {
    totalOutgoing: sponsorships.outgoing.length,
    activeOutgoing: sponsorships.outgoing.filter(s => s.status === 'ACTIVE').length,
    totalIncoming: sponsorships.incoming.length,
    activeIncoming: sponsorships.incoming.filter(s => s.status === 'ACTIVE').length,
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sponsor Management</h1>
          <p className="text-muted-foreground">
            Manage and view your brand's sponsorship relationships
          </p>
        </div>
        <Button onClick={() => setShowInviteModal(true)} className="flex items-center">
          <UserPlus className="mr-2 h-4 w-4" />
          Invite New Sponsor
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <GlassCard>
          <GlassCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <GlassCardTitle className="text-sm font-medium">Brands You Sponsor</GlassCardTitle>
            <HandHeart className="h-4 w-4 text-muted-foreground" />
          </GlassCardHeader>
          <GlassCardContent>
            <div className="text-2xl font-bold">{stats.totalOutgoing}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeOutgoing} active
            </p>
          </GlassCardContent>
        </GlassCard>
        
        <GlassCard>
          <GlassCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <GlassCardTitle className="text-sm font-medium">Your Sponsors</GlassCardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </GlassCardHeader>
          <GlassCardContent>
            <div className="text-2xl font-bold">{stats.totalIncoming}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeIncoming} active
            </p>
          </GlassCardContent>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <GlassCardTitle className="text-sm font-medium">Total Relationships</GlassCardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </GlassCardHeader>
          <GlassCardContent>
            <div className="text-2xl font-bold">{stats.totalOutgoing + stats.totalIncoming}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeOutgoing + stats.activeIncoming} active
            </p>
          </GlassCardContent>
        </GlassCard>

        <GlassCard>
          <GlassCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <GlassCardTitle className="text-sm font-medium">Pending Invitations</GlassCardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </GlassCardHeader>
          <GlassCardContent>
            <div className="text-2xl font-bold">{invitations.length}</div>
            <p className="text-xs text-muted-foreground">
              awaiting response
            </p>
          </GlassCardContent>
        </GlassCard>
      </div>

      {/* Brands You Sponsor */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center">
            <HandHeart className="mr-2 h-5 w-5" />
            Brands You Sponsor ({sponsorships.outgoing.length})
          </GlassCardTitle>
          <GlassCardDescription>
            Brands that your company sponsors and has read-only access to
          </GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent>
          {sponsorships.outgoing.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-lg">
              <Building className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No brands sponsored yet</h3>
              <p className="text-muted-foreground mb-4">
                Start sponsoring brands to showcase your partnerships
              </p>
              <Button onClick={() => setShowInviteModal(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Your First Brand
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brand Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sponsored Since</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sponsorships.outgoing.map((sponsorship) => (
                  <TableRow key={sponsorship.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <Building className="mr-2 h-4 w-4 text-muted-foreground" />
                        {sponsorship.status === 'ACTIVE' ? (
                          <button
                            onClick={() => viewSponsoredBrandProfile(sponsorship.sponsoredBrandId)}
                            className="font-medium text-primary hover:text-primary/80 hover:underline cursor-pointer text-left"
                          >
                            {sponsorship.sponsoredBrandName}
                          </button>
                        ) : (
                          <span>{sponsorship.sponsoredBrandName}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={sponsorship.status === 'ACTIVE' ? 'default' : 
                                sponsorship.status === 'PENDING' ? 'secondary' : 'destructive'}
                      >
                        {sponsorship.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isClient ? (
                        sponsorship.approvedAt ? 
                          format(new Date(sponsorship.approvedAt), 'MMM dd, yyyy') :
                          format(new Date(sponsorship.createdAt), 'MMM dd, yyyy')
                      ) : (
                        '...'
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {isClient ? (
                        `${formatDistanceToNow(new Date(sponsorship.revokedAt || sponsorship.approvedAt || sponsorship.createdAt))} ago`
                      ) : (
                        '...'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedSponsorship(sponsorship);
                              setShowDetailsModal(true);
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {sponsorship.status === 'ACTIVE' && (
                            <DropdownMenuItem
                              onClick={() => viewSponsoredBrandProfile(sponsorship.sponsoredBrandId)}
                            >
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Brand Profile
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {sponsorship.status === 'ACTIVE' && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedSponsorship(sponsorship);
                                setShowRevokeDialog(true);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Revoke Sponsorship
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Your Sponsors */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center">
            <Heart className="mr-2 h-5 w-5" />
            Your Sponsors ({sponsorships.incoming.length})
          </GlassCardTitle>
          <GlassCardDescription>
            Brands that sponsor your company and have read-only access to your profile
          </GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent>
          {sponsorships.incoming.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-lg">
              <Heart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No sponsors yet</h3>
              <p className="text-muted-foreground">
                When brands sponsor you, they'll appear here
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sponsor Brand</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sponsored Since</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sponsorships.incoming.map((sponsorship) => (
                  <TableRow key={sponsorship.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <Building className="mr-2 h-4 w-4 text-muted-foreground" />
                        {sponsorship.status === 'ACTIVE' ? (
                          <button
                            onClick={() => viewSponsorBrandProfile(sponsorship.sponsorBrandId)}
                            className="font-medium text-primary hover:text-primary/80 hover:underline cursor-pointer text-left"
                          >
                            {sponsorship.sponsorBrandName}
                          </button>
                        ) : (
                          <span>{sponsorship.sponsorBrandName}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={sponsorship.status === 'ACTIVE' ? 'default' : 
                                sponsorship.status === 'PENDING' ? 'secondary' : 'destructive'}
                      >
                        {sponsorship.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isClient ? (
                        sponsorship.approvedAt ? 
                          format(new Date(sponsorship.approvedAt), 'MMM dd, yyyy') :
                          format(new Date(sponsorship.createdAt), 'MMM dd, yyyy')
                      ) : (
                        '...'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {sponsorship.metadata?.permissions?.canViewBrandProfile && (
                          <Badge variant="outline" className="text-xs">
                            <Eye className="mr-1 h-3 w-3" />
                            Profile
                          </Badge>
                        )}
                        {sponsorship.metadata?.permissions?.canViewUploads && (
                          <Badge variant="outline" className="text-xs">
                            <Building className="mr-1 h-3 w-3" />
                            Assets
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedSponsorship(sponsorship);
                              setShowDetailsModal(true);
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Sponsorship Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sponsorship Details</DialogTitle>
            <DialogDescription>
              Information about this sponsorship relationship
            </DialogDescription>
          </DialogHeader>
          {selectedSponsorship && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Sponsor</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedSponsorship.sponsorBrandName}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Sponsored Brand</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedSponsorship.sponsoredBrandName}
                  </p>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <div className="mt-1">
                  <Badge 
                    variant={selectedSponsorship.status === 'ACTIVE' ? 'default' : 
                            selectedSponsorship.status === 'PENDING' ? 'secondary' : 'destructive'}
                  >
                    {selectedSponsorship.status}
                  </Badge>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Created</Label>
                <p className="text-sm text-muted-foreground">
                  {isClient ? (
                    format(new Date(selectedSponsorship.createdAt), 'MMMM dd, yyyy at h:mm a')
                  ) : (
                    '...'
                  )}
                </p>
              </div>

              {selectedSponsorship.approvedAt && (
                <div>
                  <Label className="text-sm font-medium">Approved</Label>
                  <p className="text-sm text-muted-foreground">
                    {isClient ? (
                      format(new Date(selectedSponsorship.approvedAt), 'MMMM dd, yyyy at h:mm a')
                    ) : (
                      '...'
                    )}
                  </p>
                </div>
              )}

              {selectedSponsorship.metadata?.note && (
                <div>
                  <Label className="text-sm font-medium">Note</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedSponsorship.metadata.note}
                  </p>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">Permissions</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedSponsorship.metadata?.permissions?.canViewBrandProfile && (
                    <Badge variant="outline" className="text-xs">
                      <Eye className="mr-1 h-3 w-3" />
                      Brand Profile
                    </Badge>
                  )}
                  {selectedSponsorship.metadata?.permissions?.canViewUploads && (
                    <Badge variant="outline" className="text-xs">
                      <Building className="mr-1 h-3 w-3" />
                      Asset Access
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Sponsorship Dialog */}
      <AlertDialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5 text-destructive" />
              Revoke Sponsorship
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the sponsorship with{' '}
              <strong>{selectedSponsorship?.sponsoredBrandName}</strong>?
              <br /><br />
              This will immediately remove their read-only access to your brand profile 
              and assets. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedSponsorship && handleRevokeSponsorhip(
                selectedSponsorship.sponsorBrandId, 
                selectedSponsorship.sponsoredBrandId
              )}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={actionLoading?.startsWith('revoke-')}
            >
              {actionLoading?.startsWith('revoke-') ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Revoking...
                </>
              ) : (
                'Revoke Sponsorship'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite New Sponsor Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite New Sponsor</DialogTitle>
            <DialogDescription>
              Send a sponsorship invitation to another brand's manager
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="managerEmail">Manager Email *</Label>
              <Input
                id="managerEmail"
                type="email"
                placeholder="manager@brandname.com"
                value={inviteForm.managerEmail}
                onChange={(e) => setInviteForm(prev => ({ ...prev, managerEmail: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="note">Personal Message (optional)</Label>
              <Textarea
                id="note"
                placeholder="Tell them why you'd like to sponsor their brand..."
                value={inviteForm.note}
                onChange={(e) => setInviteForm(prev => ({ ...prev, note: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendInvitation} 
              disabled={!inviteForm.managerEmail.trim() || actionLoading === 'invite'}
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
