'use client';

import { useMemo } from 'react';
import { Globe } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTimezone } from '@/contexts/TimezoneContext';
import { getSupportedTimezones, getTimezoneDisplayName } from '@/lib/timezone-utils';
import { useToast } from '@/hooks/use-toast';

export function TimezoneSelector() {
  const { timezone, setTimezone, isLoading } = useTimezone();
  const { toast } = useToast();

  const timezones = useMemo(() => {
    const tzList = getSupportedTimezones();
    return tzList.map(tz => ({
      value: tz,
      label: getTimezoneDisplayName(tz),
    }));
  }, []);

  const handleSelect = async (newTimezone: string) => {
    try {
      await setTimezone(newTimezone);
      toast({
        title: 'Timezone updated',
        description: `Calendar now displays in ${getTimezoneDisplayName(newTimezone)}`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update timezone',
        description: 'Please try again.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Globe className="h-4 w-4" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <Select value={timezone} onValueChange={handleSelect}>
      <SelectTrigger className="w-[280px]">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          <SelectValue placeholder="Select timezone" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {timezones.map((tz) => (
          <SelectItem key={tz.value} value={tz.value}>
            {tz.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
