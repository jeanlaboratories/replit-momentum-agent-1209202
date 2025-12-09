"use client"

/**
 * Notification Bar Component
 *
 * A beautiful, animated notification system that displays below the header
 * Features:
 * - Smooth slide-down animations with spring physics feel
 * - Gradient backgrounds matching notification types
 * - Progress bar for auto-dismiss timing
 * - Stacked notifications with smart positioning
 * - Icon animations for each notification type
 */

import * as React from "react"
import { useNotification, type Notification, type NotificationType } from "@/hooks/use-notification"
import { cn } from "@/lib/utils"
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  X,
  Sparkles,
} from "lucide-react"

// Notification type configurations
const notificationConfig: Record<NotificationType, {
  icon: React.ComponentType<{ className?: string }>
  gradient: string
  border: string
  iconColor: string
  textColor: string
  progressColor: string
  glow: string
}> = {
  success: {
    icon: CheckCircle2,
    gradient: "bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-teal-500/10",
    border: "border-emerald-500/30",
    iconColor: "text-emerald-500",
    textColor: "text-emerald-900 dark:text-emerald-100",
    progressColor: "bg-emerald-500",
    glow: "shadow-emerald-500/20",
  },
  error: {
    icon: XCircle,
    gradient: "bg-gradient-to-r from-red-500/10 via-rose-500/10 to-pink-500/10",
    border: "border-red-500/30",
    iconColor: "text-red-500",
    textColor: "text-red-900 dark:text-red-100",
    progressColor: "bg-red-500",
    glow: "shadow-red-500/20",
  },
  warning: {
    icon: AlertTriangle,
    gradient: "bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-yellow-500/10",
    border: "border-amber-500/30",
    iconColor: "text-amber-500",
    textColor: "text-amber-900 dark:text-amber-100",
    progressColor: "bg-amber-500",
    glow: "shadow-amber-500/20",
  },
  info: {
    icon: Info,
    gradient: "bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-violet-500/10",
    border: "border-blue-500/30",
    iconColor: "text-blue-500",
    textColor: "text-blue-900 dark:text-blue-100",
    progressColor: "bg-blue-500",
    glow: "shadow-blue-500/20",
  },
  loading: {
    icon: Loader2,
    gradient: "bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10",
    border: "border-violet-500/30",
    iconColor: "text-violet-500",
    textColor: "text-violet-900 dark:text-violet-100",
    progressColor: "bg-violet-500",
    glow: "shadow-violet-500/20",
  },
}

interface NotificationItemProps {
  notification: Notification
  index: number
  onDismiss: (id: string) => void
}

function NotificationItem({ notification, index, onDismiss }: NotificationItemProps) {
  const [isVisible, setIsVisible] = React.useState(false)
  const [progress, setProgress] = React.useState(100)
  const config = notificationConfig[notification.type]
  const Icon = config.icon

  // Animate in on mount
  React.useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // Progress bar animation for auto-dismiss
  React.useEffect(() => {
    if (notification.duration && notification.duration > 0) {
      const startTime = Date.now()
      const duration = notification.duration

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime
        const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
        setProgress(remaining)

        if (remaining <= 0) {
          clearInterval(interval)
        }
      }, 50)

      return () => clearInterval(interval)
    }
  }, [notification.duration])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(() => onDismiss(notification.id), 200)
  }

  return (
    <div
      className={cn(
        // Base styles
        "relative w-full overflow-hidden rounded-lg border backdrop-blur-md",
        // Gradient and colors
        config.gradient,
        config.border,
        // Shadow and glow effect
        "shadow-lg",
        config.glow,
        // Animation
        "transition-all duration-300 ease-out",
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-4",
        // Stack offset based on index
        index > 0 && "mt-2"
      )}
      style={{
        // Slight scale reduction for stacked items
        transform: isVisible
          ? `translateY(0) scale(${1 - index * 0.02})`
          : `translateY(-16px) scale(${1 - index * 0.02})`,
      }}
    >
      {/* Main content */}
      <div className="flex items-start gap-3 p-4">
        {/* Icon with animation */}
        <div className={cn(
          "flex-shrink-0 rounded-full p-1",
          notification.type === 'loading' && "animate-spin"
        )}>
          <Icon className={cn("h-5 w-5", config.iconColor)} />
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <div className={cn("font-semibold text-sm", config.textColor)}>
            {notification.title}
          </div>
          {notification.description != null && notification.description !== '' && String(notification.description) !== '0' && (
            <div className={cn(
              "text-sm mt-0.5 opacity-80",
              config.textColor
            )}>
              {notification.description}
            </div>
          )}
          {/* Action button */}
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className={cn(
                "mt-2 text-xs font-medium underline underline-offset-2",
                "hover:opacity-80 transition-opacity",
                config.iconColor
              )}
            >
              {notification.action.label}
            </button>
          )}
        </div>

        {/* Dismiss button */}
        {notification.dismissible !== false && (
          <button
            onClick={handleDismiss}
            className={cn(
              "flex-shrink-0 rounded-full p-1",
              "hover:bg-black/5 dark:hover:bg-white/10",
              "transition-colors duration-150",
              config.textColor,
              "opacity-60 hover:opacity-100"
            )}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Progress bar for auto-dismiss */}
      {notification.duration != null && notification.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5 dark:bg-white/5">
          <div
            className={cn(
              "h-full transition-all duration-100 ease-linear",
              config.progressColor
            )}
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
      )}

      {/* Decorative sparkle for success */}
      {notification.type === 'success' && (
        <Sparkles
          className={cn(
            "absolute top-2 right-12 h-4 w-4 opacity-30",
            config.iconColor,
            "animate-pulse"
          )}
        />
      )}
    </div>
  )
}

/**
 * Notification Bar - renders below the header
 */
export function NotificationBar() {
  const { notifications, dismiss } = useNotification()

  if (notifications.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        // Positioning below header
        "fixed top-16 left-0 right-0 z-50",
        // Container styling
        "px-4 py-2",
        // Pointer events only on children
        "pointer-events-none"
      )}
    >
      <div className="mx-auto max-w-xl">
        <div className="pointer-events-auto space-y-2">
          {notifications.map((notification, index) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              index={index}
              onDismiss={dismiss}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Compact notification display for inline use
 */
export function InlineNotification({
  type,
  title,
  description,
  className,
}: {
  type: NotificationType
  title: string
  description?: string
  className?: string
}) {
  const config = notificationConfig[type]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3",
        config.gradient,
        config.border,
        className
      )}
    >
      <Icon className={cn(
        "h-5 w-5 flex-shrink-0",
        config.iconColor,
        type === 'loading' && "animate-spin"
      )} />
      <div className="flex-1 min-w-0">
        <div className={cn("font-medium text-sm", config.textColor)}>
          {title}
        </div>
        {description != null && description !== '' && String(description) !== '0' && (
          <div className={cn("text-sm mt-0.5 opacity-80", config.textColor)}>
            {description}
          </div>
        )}
      </div>
    </div>
  )
}
