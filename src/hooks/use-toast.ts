"use client"

/**
 * Toast Hook - Backward Compatible Adapter
 *
 * This hook maintains the existing toast API while routing all notifications
 * through the new beautiful top bar notification system.
 *
 * Usage remains identical:
 *   const { toast } = useToast()
 *   toast({ title: "Success!", description: "It worked", variant: "default" })
 *
 * But now renders in the gorgeous top bar notification system instead of
 * the old corner toasts.
 */

import * as React from "react"
import {
  notification,
  useNotification,
  type NotificationType,
  type NotificationAPI,
} from "@/hooks/use-notification"

// Re-export notification utilities for components that want to use the new API directly
export { notification, useNotification, type NotificationType, type NotificationAPI }
export { notifyPromise } from "@/hooks/use-notification"

/**
 * Legacy toast interface for backward compatibility
 */
export interface ToastProps {
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: 'default' | 'destructive'
  duration?: number
  action?: React.ReactElement
}

export type ToastActionElement = React.ReactElement

export interface ToastReturn {
  id: string
  dismiss: () => void
  update: (props: ToastProps) => void
}

/**
 * Convert variant to notification type
 */
function variantToType(variant?: 'default' | 'destructive'): NotificationType {
  return variant === 'destructive' ? 'error' : 'success'
}

/**
 * Standalone toast function - can be called outside of React components
 */
function toast(props: ToastProps): ToastReturn {
  const type = variantToType(props.variant)
  const title = typeof props.title === 'string' ? props.title : String(props.title || '')
  const description = typeof props.description === 'string'
    ? props.description
    : props.description
      ? String(props.description)
      : undefined

  const api = notification[type]({
    title,
    description,
    duration: props.duration,
  })

  return {
    id: api.id,
    dismiss: api.dismiss,
    update: (updateProps: ToastProps) => {
      const newType = variantToType(updateProps.variant)
      api.update({
        type: newType,
        title: typeof updateProps.title === 'string'
          ? updateProps.title
          : updateProps.title
            ? String(updateProps.title)
            : undefined,
        description: typeof updateProps.description === 'string'
          ? updateProps.description
          : updateProps.description
            ? String(updateProps.description)
            : undefined,
        duration: updateProps.duration,
      })
    },
  }
}

/**
 * useToast hook - backward compatible with existing usage
 *
 * @example
 * const { toast } = useToast()
 * toast({ title: "Saved!", description: "Your changes have been saved" })
 * toast({ title: "Error", description: "Something went wrong", variant: "destructive" })
 */
function useToast() {
  const { notifications, dismiss } = useNotification()

  // Memoize toast to maintain consistent reference
  const memoizedToast = React.useCallback((props: ToastProps) => {
    return toast(props)
  }, [])

  return {
    toast: memoizedToast,
    dismiss,
    // Legacy compatibility: expose toasts array mapped to old format
    toasts: notifications.map(n => ({
      id: n.id,
      title: n.title,
      description: n.description,
      variant: n.type === 'error' ? 'destructive' as const : 'default' as const,
      open: true,
      onOpenChange: () => dismiss(n.id),
    })),
  }
}

// Reducer export for any code that might import it (legacy compatibility)
export const reducer = (state: { toasts: any[] }, action: any) => state

export { useToast, toast }
