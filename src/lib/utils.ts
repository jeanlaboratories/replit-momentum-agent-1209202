import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  // Browser-compatible UUID generation
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function normalizeToLocalMidnight(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function isBeforeToday(date: Date): boolean {
  const today = normalizeToLocalMidnight(new Date());
  const checkDate = normalizeToLocalMidnight(date);
  return checkDate < today;
}

export function isTodayOrFuture(date: Date): boolean {
  return !isBeforeToday(date);
}

/**
 * Checks if a value has meaningful content (not empty)
 * - Strings must have trimmed length > 0
 * - Arrays must have at least one non-empty trimmed entry
 * - Null/undefined values return false
 */
export function hasMeaningfulContent(value: unknown): boolean {
  if (value == null) return false;
  
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  
  if (Array.isArray(value)) {
    return value.some(item => 
      typeof item === 'string' && item.trim().length > 0
    );
  }
  
  return false;
}

export function addDaysToISODate(isoDateString: string, days: number): string {
  const [year, month, day] = isoDateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, '0');
  const newDay = String(date.getDate()).padStart(2, '0');
  
  return `${newYear}-${newMonth}-${newDay}`;
}

export function parseISODateAsLocal(isoDateString: string): Date {
  const dateOnly = isoDateString.split('T')[0];
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mime });
}

export function hslToHex(hsl: string): string {
  // Handle hsl(h, s%, l%) format
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return '#000000'; // Fallback

  const h = parseInt(match[1]);
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;

  const a = s * Math.min(l, 1 - l);
  const f = (n: number, k = (n + h / 30) % 12) => {
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
