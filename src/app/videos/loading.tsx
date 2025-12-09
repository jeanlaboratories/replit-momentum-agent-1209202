
import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-gray-900">
      <div className="flex flex-col items-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading Video Gallery...</p>
      </div>
    </div>
  );
}
