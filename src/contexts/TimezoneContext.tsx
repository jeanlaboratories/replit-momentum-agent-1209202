'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getBrowserTimezone } from '@/lib/timezone-utils';
import { getUserProfilePreferencesAction, updateUserProfilePreferenceAction } from '@/app/actions';

interface TimezoneContextType {
  timezone: string;
  setTimezone: (timezone: string) => Promise<void>;
  isLoading: boolean;
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

export function TimezoneProvider({ children }: { children: React.ReactNode }) {
  const { user, brandId } = useAuth();
  const [timezone, setTimezoneState] = useState<string>(() => getBrowserTimezone());
  const [isLoading, setIsLoading] = useState(true);

  // Load user's timezone preference
  useEffect(() => {
    async function loadTimezone() {
      if (!user || !brandId) {
        setTimezoneState(getBrowserTimezone());
        setIsLoading(false);
        return;
      }

      try {
        const preferences = await getUserProfilePreferencesAction(user.uid, brandId);
        if (preferences?.timezone) {
          setTimezoneState(preferences.timezone);
        } else {
          // No preference saved, use browser timezone
          setTimezoneState(getBrowserTimezone());
        }
      } catch (error) {
        console.error('[TimezoneContext] Error loading timezone:', error);
        setTimezoneState(getBrowserTimezone());
      } finally {
        setIsLoading(false);
      }
    }

    loadTimezone();
  }, [user, brandId]);

  // Update timezone preference
  const setTimezone = useCallback(async (newTimezone: string) => {
    if (!user || !brandId) {
      setTimezoneState(newTimezone);
      return;
    }

    try {
      setTimezoneState(newTimezone);
      
      // Save to user preferences
      await updateUserProfilePreferenceAction(user.uid, brandId, {
        timezone: newTimezone,
      });
    } catch (error) {
      console.error('[TimezoneContext] Error saving timezone:', error);
      throw error;
    }
  }, [user, brandId]);

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone, isLoading }}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (context === undefined) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
}
