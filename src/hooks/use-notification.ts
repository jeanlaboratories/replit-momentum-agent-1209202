"use client"

/**
 * Top Bar Notification System
 * A beautiful, intuitive notification system that displays in the header area
 *
 * Features:
 * - Elegant slide-down animations
 * - Multiple notification types (success, error, warning, info, loading)
 * - Auto-dismiss with visual progress indicator
 * - Stackable notifications (max 3 visible)
 * - Smooth entry/exit animations
 */

import * as React from "react"

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  description?: string
  duration?: number // ms, 0 = persistent (for loading)
  dismissible?: boolean
  action?: {
    label: string
    onClick: () => void
  }
}

interface NotificationState {
  notifications: Notification[]
}

const NOTIFICATION_LIMIT = 3
const DEFAULT_DURATION = 5000

type ActionType =
  | { type: 'ADD'; notification: Notification }
  | { type: 'UPDATE'; id: string; notification: Partial<Notification> }
  | { type: 'DISMISS'; id: string }
  | { type: 'DISMISS_ALL' }

let count = 0

function genId(): string {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return `notification-${count}-${Date.now()}`
}

const listeners: Array<(state: NotificationState) => void> = []
let memoryState: NotificationState = { notifications: [] }

function dispatch(action: ActionType) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => listener(memoryState))
}

function reducer(state: NotificationState, action: ActionType): NotificationState {
  switch (action.type) {
    case 'ADD':
      return {
        ...state,
        notifications: [action.notification, ...state.notifications].slice(0, NOTIFICATION_LIMIT),
      }
    case 'UPDATE':
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.id ? { ...n, ...action.notification } : n
        ),
      }
    case 'DISMISS':
      return {
        ...state,
        notifications: state.notifications.filter((n) => n.id !== action.id),
      }
    case 'DISMISS_ALL':
      return {
        ...state,
        notifications: [],
      }
    default:
      return state
  }
}

// Auto-dismiss timeouts
const dismissTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleDismiss(id: string, duration: number) {
  if (dismissTimeouts.has(id)) {
    clearTimeout(dismissTimeouts.get(id))
  }

  if (duration > 0) {
    const timeout = setTimeout(() => {
      dismissTimeouts.delete(id)
      dispatch({ type: 'DISMISS', id })
    }, duration)
    dismissTimeouts.set(id, timeout)
  }
}

function cancelDismiss(id: string) {
  if (dismissTimeouts.has(id)) {
    clearTimeout(dismissTimeouts.get(id))
    dismissTimeouts.delete(id)
  }
}

export type NotifyOptions = Omit<Notification, 'id' | 'type'>

export interface NotificationAPI {
  id: string
  dismiss: () => void
  update: (options: Partial<NotifyOptions & { type?: NotificationType }>) => void
}

/**
 * Show a notification
 */
function notify(type: NotificationType, options: NotifyOptions): NotificationAPI {
  const id = genId()
  const duration = options.duration ?? (type === 'loading' ? 0 : DEFAULT_DURATION)
  const dismissible = options.dismissible ?? (type !== 'loading')

  const notification: Notification = {
    id,
    type,
    title: options.title,
    description: options.description,
    duration,
    dismissible,
    action: options.action,
  }

  dispatch({ type: 'ADD', notification })

  if (duration > 0) {
    scheduleDismiss(id, duration)
  }

  return {
    id,
    dismiss: () => {
      cancelDismiss(id)
      dispatch({ type: 'DISMISS', id })
    },
    update: (updateOptions) => {
      const newDuration = updateOptions.duration ?? notification.duration
      dispatch({
        type: 'UPDATE',
        id,
        notification: updateOptions,
      })

      // If updating to a non-loading type with duration, schedule dismiss
      if (updateOptions.type && updateOptions.type !== 'loading' && newDuration && newDuration > 0) {
        scheduleDismiss(id, newDuration)
      }
    },
  }
}

/**
 * Notification convenience methods
 */
export const notification = {
  success: (options: NotifyOptions) => notify('success', options),
  error: (options: NotifyOptions) => notify('error', options),
  warning: (options: NotifyOptions) => notify('warning', options),
  info: (options: NotifyOptions) => notify('info', options),
  loading: (options: NotifyOptions) => notify('loading', { ...options, duration: 0 }),
  dismiss: (id: string) => {
    cancelDismiss(id)
    dispatch({ type: 'DISMISS', id })
  },
  dismissAll: () => {
    dismissTimeouts.forEach((_, id) => cancelDismiss(id))
    dispatch({ type: 'DISMISS_ALL' })
  },
}

/**
 * Promise-based notification for async operations
 * Shows loading state, then success/error based on promise result
 */
export function notifyPromise<T>(
  promise: Promise<T>,
  options: {
    loading: NotifyOptions
    success: NotifyOptions | ((data: T) => NotifyOptions)
    error: NotifyOptions | ((error: Error) => NotifyOptions)
  }
): Promise<T> {
  const api = notification.loading(options.loading)

  promise
    .then((data) => {
      const successOpts = typeof options.success === 'function'
        ? options.success(data)
        : options.success
      api.update({ ...successOpts, type: 'success', duration: DEFAULT_DURATION })
    })
    .catch((error) => {
      const errorOpts = typeof options.error === 'function'
        ? options.error(error)
        : options.error
      api.update({ ...errorOpts, type: 'error', duration: DEFAULT_DURATION * 1.5 })
    })

  return promise
}

/**
 * React hook for notifications
 */
export function useNotification() {
  const [state, setState] = React.useState<NotificationState>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])

  return {
    notifications: state.notifications,
    ...notification,
  }
}

/**
 * Backward-compatible toast adapter
 * Maps toast({ title, description, variant }) to notification system
 */
export function useToast() {
  const notificationAPI = useNotification()

  const toast = React.useCallback(({
    title,
    description,
    variant
  }: {
    title?: string
    description?: string
    variant?: 'default' | 'destructive'
  }) => {
    const type: NotificationType = variant === 'destructive' ? 'error' : 'success'
    return notificationAPI[type]({
      title: title || '',
      description,
    })
  }, [notificationAPI])

  return {
    toast,
    dismiss: notificationAPI.dismiss,
    // Keep backwards compatibility
    toasts: notificationAPI.notifications.map(n => ({
      id: n.id,
      title: n.title,
      description: n.description,
      variant: n.type === 'error' ? 'destructive' as const : 'default' as const,
    })),
  }
}
