
'use client';

import { useState } from 'react';
import { seedDatabase, clearDatabaseAction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { PageTransition } from '@/components/ui/page-transition';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Database, Trash2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function SeedPage() {
  const [isLoadingSeed, setIsLoadingSeed] = useState(false);
  const [isLoadingClear, setIsLoadingClear] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSeed = async () => {
    setIsLoadingSeed(true);
    setError(null);
    try {
        const result = await seedDatabase();
        if (result.success) {
          toast({
            title: 'Success',
            description: result.message,
          });
        } else {
            setError('An unknown error occurred during seeding.');
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to seed database. See error details on the page.',
          });
        }
    } catch (e: any) {
        setError(e.message);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e.message || 'Failed to seed database. See error details on the page.',
      });
    } finally {
        setIsLoadingSeed(false);
    }
  };

  const handleClear = async () => {
    setIsLoadingClear(true);
    setError(null);
    const result = await clearDatabaseAction();
    setIsLoadingClear(false);

    if (result.success) {
      toast({
        title: 'Success',
        description: result.message,
      });
    } else {
      setError(result.message);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to clear database. See error details on the page.',
      });
    }
  };

  return (
    <PageTransition>
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
        <GlassCard className="w-full max-w-md">
          <GlassCardHeader>
            <GlassCardTitle>Database Management</GlassCardTitle>
            <GlassCardDescription>
            Use these actions to manage your Firestore data. Seeding creates comprehensive demo data including 3 teams with users, initiatives, Team Intelligence artifacts, user preferences, sponsorships, images, and videos. Clearing will permanently delete all data including users, teams, initiatives, Team Intelligence, and all media assets.
            </GlassCardDescription>
          </GlassCardHeader>
          <GlassCardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Action Failed</AlertTitle>
              <AlertDescription className='break-words'>
                {error}
              </AlertDescription>
            </Alert>
          )}
          <div className='flex flex-col gap-4'>
            <Button onClick={handleSeed} disabled={isLoadingSeed || isLoadingClear} className="w-full">
              {isLoadingSeed ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
              Seed Data
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isLoadingClear || isLoadingSeed} className="w-full">
                  {isLoadingClear ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Clear Database
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    <AlertTriangle className="inline-block mr-2 text-destructive" />
                    Are you absolutely sure?
                    </AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all users, teams, initiatives, and associated data from your database.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClear} className='bg-destructive hover:bg-destructive/90'>
                    Yes, clear database
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          </GlassCardContent>
        </GlassCard>
      </div>
    </PageTransition>
  );
}
