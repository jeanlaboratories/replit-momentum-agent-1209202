"use client"

/**
 * Toaster Component
 *
 * Renders the beautiful top bar notification system.
 * Fully backward compatible - existing toast() calls will automatically
 * use the new notification system.
 */

import { NotificationBar } from "@/components/ui/notification-bar"

export function Toaster() {
  return <NotificationBar />
}
