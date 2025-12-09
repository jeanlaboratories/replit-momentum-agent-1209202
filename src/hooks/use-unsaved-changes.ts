
'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export function useUnsavedChanges(shouldPreventNavigation: boolean) {
  const router = useRouter();

  // This is the message that will be displayed to the user in the browser's native confirmation dialog.
  const confirmationMessage = 'You have unsaved changes. Are you sure you want to leave?';

  // Handling attempts to close the tab or navigate away from the site
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (shouldPreventNavigation) {
        event.preventDefault();
        // This is required for Chrome
        event.returnValue = confirmationMessage;
        return confirmationMessage;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [shouldPreventNavigation]);

}
