'use client';

import { Zap, User, LogOut, Video, Image as ImageIcon, Music2, FileText, Settings, Users, Brain, Folder, Calendar } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { HeaderJobStatus } from '@/components/header-job-status';

export function Header() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Hide header on auth pages and full-screen companion (has its own header)
  if (pathname === '/login' || pathname === '/signup' || pathname === '/companion') {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('');
  };
  
  const navLinks = [
    { href: '/', label: 'Event Calendar', icon: Calendar },
    { href: '/brand-profile', label: 'Team Profile', icon: FileText },
    { href: '/brand-soul', label: 'Team Intelligence', icon: Brain },
    { href: '/media', label: 'Media Library', icon: Folder },
  ];

  return (
    <header className="bg-background/80 sticky top-0 z-50 w-full border-b backdrop-blur-sm">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary fill-primary" />
            <span className="font-headline text-2xl font-bold text-primary">
                MOMENTUM
            </span>
            </Link>
            {user && (
              <nav className="hidden md:flex items-center gap-2">
                {navLinks.map((link) => (
                    <Button variant="link" asChild key={link.href}>
                    <Link href={link.href} className={cn("text-muted-foreground hover:text-primary transition-colors", { 'text-primary': pathname.startsWith(link.href) })}>
                            <link.icon className="mr-2 h-4 w-4" />
                            {link.label}
                        </Link>
                    </Button>
                ))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="link" className={cn("text-muted-foreground hover:text-primary transition-colors", { 'text-primary': pathname.startsWith('/images') || pathname.startsWith('/videos') || pathname.startsWith('/music') })}>
                    <Zap className="mr-2 h-4 w-4" />
                    Apps
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => router.push('/images')} className="cursor-pointer">
                    <ImageIcon className="mr-2 h-4 w-4" />
                    <span>Image Gallery</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/videos')} className="cursor-pointer">
                    <Video className="mr-2 h-4 w-4" />
                    <span>Video Gallery</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/music')} className="cursor-pointer">
                    <Music2 className="mr-2 h-4 w-4" />
                    <span>Music Gallery</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <HeaderJobStatus />
              </nav>
            )}
        </div>
        <nav className="pr-0">
          {loading ? (
            <Skeleton className="h-10 w-10 rounded-full" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full p-0"
                >
                  <Avatar className="h-10 w-10">
                    {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'user'}/>}
                    <AvatarFallback>
                      {getInitials(user.displayName)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className='w-56'>
                <DropdownMenuItem 
                  className='cursor-pointer flex flex-col items-start space-y-1 py-3'
                  onSelect={() => router.push('/brand-profile/personal')}
                >
                    <p className='text-sm font-medium leading-none'>{user.displayName || 'User'}</p>
                    <p className='text-xs leading-none text-muted-foreground'>{user.email}</p>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="md:hidden" />
                  <DropdownMenuItem onClick={() => router.push('/')} className="cursor-pointer md:hidden">
                    <Calendar className="mr-2 h-4 w-4" />
                    <span>Event Calendar</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/brand-profile')} className="cursor-pointer md:hidden">
                    <FileText className="mr-2 h-4 w-4" />
                    <span>Team Profile</span>
                  </DropdownMenuItem>
                   <DropdownMenuItem onClick={() => router.push('/brand-soul')} className="cursor-pointer md:hidden">
                    <Brain className="mr-2 h-4 w-4" />
                    <span>Team Intelligence</span>
                  </DropdownMenuItem>
                   <DropdownMenuItem onClick={() => router.push('/media')} className="cursor-pointer md:hidden">
                    <Folder className="mr-2 h-4 w-4" />
                    <span>Media Library</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/account')} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Account</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/settings')} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                   <DropdownMenuItem onClick={() => router.push('/settings/team')} className="cursor-pointer">
                    <Users className="mr-2 h-4 w-4" />
                    <span>Team</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Logout</span>
                  </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild>
              <Link href="/login">
                <User className="mr-2 h-4 w-4" />
                Login
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
