import React from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export type ProgressToastStatus = 'loading' | 'success' | 'error';

interface ProgressToastProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: ProgressToastStatus;
  title: string;
  description?: string;
  duration?: number;
}

export function ProgressToast({
  open,
  onOpenChange,
  status,
  title,
  description,
  duration = 5000
}: ProgressToastProps) {
  const icon = {
    loading: <Loader2 className="h-5 w-5 animate-spin text-purple-500" />,
    success: <CheckCircle2 className="h-5 w-5 text-green-500" />,
    error: <XCircle className="h-5 w-5 text-red-500" />
  }[status];

  const bgColor = {
    loading: 'bg-gray-800 border-purple-500/20',
    success: 'bg-gray-800 border-green-500/20',
    error: 'bg-gray-800 border-red-500/20'
  }[status];

  React.useEffect(() => {
    if (open && (status === 'success' || status === 'error')) {
      const timer = setTimeout(() => {
        onOpenChange(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [open, status, duration, onOpenChange]);

  return (
    <ToastProvider>
      <Toast
        open={open}
        onOpenChange={onOpenChange}
        duration={status === 'loading' ? Infinity : duration}
        className={cn('border-2', bgColor)}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">{icon}</div>
          <div className="flex-1 min-w-0">
            <ToastTitle className="text-white">{title}</ToastTitle>
            {description && (
              <ToastDescription className="text-gray-400">
                {description}
              </ToastDescription>
            )}
          </div>
        </div>
        {status !== 'loading' && <ToastClose />}
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );
}
