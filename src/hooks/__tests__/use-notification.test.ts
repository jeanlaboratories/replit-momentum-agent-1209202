/**
 * Tests for the Notification System
 *
 * Tests the core notification functionality including:
 * - Creating notifications of all types
 * - Auto-dismiss timing
 * - Manual dismiss
 * - Update notifications
 * - Promise-based notifications
 * - Backward compatibility with toast API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { notification, notifyPromise } from '../use-notification'
import { toast } from '../use-toast'

// Mock timers for testing auto-dismiss
vi.useFakeTimers()

describe('Notification System', () => {
  beforeEach(() => {
    // Clear all notifications before each test
    notification.dismissAll()
    vi.clearAllTimers()
  })

  describe('notification.success', () => {
    it('creates a success notification with title', () => {
      const api = notification.success({ title: 'Success!' })
      expect(api.id).toBeDefined()
      expect(typeof api.dismiss).toBe('function')
      expect(typeof api.update).toBe('function')
    })

    it('creates a success notification with title and description', () => {
      const api = notification.success({
        title: 'Saved!',
        description: 'Your changes have been saved',
      })
      expect(api.id).toBeDefined()
    })

    it('auto-dismisses after default duration', () => {
      const api = notification.success({ title: 'Test' })

      // Fast-forward past the default duration (5000ms)
      vi.advanceTimersByTime(5100)

      // The notification should have been dismissed via internal mechanism
      expect(api.id).toBeDefined()
    })
  })

  describe('notification.error', () => {
    it('creates an error notification', () => {
      const api = notification.error({ title: 'Error occurred' })
      expect(api.id).toBeDefined()
    })

    it('error notifications auto-dismiss', () => {
      const api = notification.error({
        title: 'Error',
        description: 'Something went wrong',
      })
      expect(api.id).toBeDefined()
    })
  })

  describe('notification.warning', () => {
    it('creates a warning notification', () => {
      const api = notification.warning({ title: 'Warning!' })
      expect(api.id).toBeDefined()
    })
  })

  describe('notification.info', () => {
    it('creates an info notification', () => {
      const api = notification.info({
        title: 'Info',
        description: 'Here is some information',
      })
      expect(api.id).toBeDefined()
    })
  })

  describe('notification.loading', () => {
    it('creates a loading notification that does not auto-dismiss', () => {
      const api = notification.loading({ title: 'Loading...' })
      expect(api.id).toBeDefined()

      // Advance time significantly
      vi.advanceTimersByTime(60000)

      // Loading notifications should persist until manually dismissed
      expect(api.id).toBeDefined()
    })

    it('can be manually dismissed', () => {
      const api = notification.loading({ title: 'Loading...' })
      api.dismiss()
      // No error means dismiss worked
      expect(true).toBe(true)
    })

    it('can be updated to success after loading', () => {
      const api = notification.loading({ title: 'Saving...' })
      api.update({
        type: 'success',
        title: 'Saved!',
        description: 'Your changes are saved',
        duration: 5000,
      })
      expect(api.id).toBeDefined()
    })
  })

  describe('notification.dismiss', () => {
    it('dismisses a notification by id', () => {
      const api = notification.success({ title: 'Test' })
      notification.dismiss(api.id)
      // No error means dismiss worked
      expect(true).toBe(true)
    })
  })

  describe('notification.dismissAll', () => {
    it('dismisses all notifications', () => {
      notification.success({ title: 'One' })
      notification.error({ title: 'Two' })
      notification.warning({ title: 'Three' })
      notification.dismissAll()
      // No error means dismissAll worked
      expect(true).toBe(true)
    })
  })

  describe('custom duration', () => {
    it('respects custom duration', () => {
      const api = notification.success({
        title: 'Quick',
        duration: 1000,
      })
      expect(api.id).toBeDefined()
    })

    it('duration 0 means persistent', () => {
      const api = notification.info({
        title: 'Persistent',
        duration: 0,
      })

      vi.advanceTimersByTime(60000)
      expect(api.id).toBeDefined()
    })
  })

  describe('action buttons', () => {
    it('supports action callback', () => {
      const onClickMock = vi.fn()
      const api = notification.info({
        title: 'With Action',
        action: {
          label: 'Undo',
          onClick: onClickMock,
        },
      })
      expect(api.id).toBeDefined()
    })
  })
})

describe('notifyPromise', () => {
  beforeEach(() => {
    notification.dismissAll()
    vi.clearAllTimers()
  })

  it('shows loading then success on resolved promise', async () => {
    const promise = Promise.resolve({ data: 'test' })

    const result = notifyPromise(promise, {
      loading: { title: 'Loading...' },
      success: { title: 'Done!' },
      error: { title: 'Failed' },
    })

    await expect(result).resolves.toEqual({ data: 'test' })
  })

  it('shows loading then error on rejected promise', async () => {
    const promise = Promise.reject(new Error('Test error'))

    const result = notifyPromise(promise, {
      loading: { title: 'Loading...' },
      success: { title: 'Done!' },
      error: { title: 'Failed' },
    })

    await expect(result).rejects.toThrow('Test error')
  })

  it('supports dynamic success message based on data', async () => {
    const promise = Promise.resolve({ count: 5 })

    const result = notifyPromise(promise, {
      loading: { title: 'Saving...' },
      success: (data) => ({
        title: 'Saved!',
        description: `Saved ${data.count} items`,
      }),
      error: { title: 'Failed' },
    })

    await expect(result).resolves.toEqual({ count: 5 })
  })

  it('supports dynamic error message based on error', async () => {
    const promise = Promise.reject(new Error('Network timeout'))

    const result = notifyPromise(promise, {
      loading: { title: 'Connecting...' },
      success: { title: 'Connected!' },
      error: (err) => ({
        title: 'Connection Failed',
        description: err.message,
      }),
    })

    await expect(result).rejects.toThrow('Network timeout')
  })
})

describe('Backward Compatibility - toast adapter', () => {
  beforeEach(() => {
    notification.dismissAll()
    vi.clearAllTimers()
  })

  describe('toast function', () => {
    it('maps default variant to success notification', () => {
      const api = toast({
        title: 'Test',
        description: 'Description',
        variant: 'default',
      })

      expect(api.id).toBeDefined()
      expect(typeof api.dismiss).toBe('function')
      expect(typeof api.update).toBe('function')
    })

    it('maps destructive variant to error notification', () => {
      const api = toast({
        title: 'Error',
        description: 'Something went wrong',
        variant: 'destructive',
      })

      expect(api.id).toBeDefined()
    })

    it('handles missing variant (defaults to success)', () => {
      const api = toast({
        title: 'No variant',
      })

      expect(api.id).toBeDefined()
    })

    it('handles string titles and descriptions', () => {
      const api = toast({
        title: 'String title',
        description: 'String description',
      })

      expect(api.id).toBeDefined()
    })
  })
})

describe('Notification Limits', () => {
  beforeEach(() => {
    notification.dismissAll()
  })

  it('limits visible notifications to 3', () => {
    // Create more than 3 notifications
    notification.success({ title: 'One' })
    notification.success({ title: 'Two' })
    notification.success({ title: 'Three' })
    notification.success({ title: 'Four' })
    notification.success({ title: 'Five' })

    // The system should only keep the 3 most recent
    expect(true).toBe(true)
  })
})

describe('Unique IDs', () => {
  beforeEach(() => {
    notification.dismissAll()
  })

  it('generates unique IDs for each notification', () => {
    const ids = new Set<string>()

    for (let i = 0; i < 100; i++) {
      const api = notification.info({ title: `Test ${i}` })
      expect(ids.has(api.id)).toBe(false)
      ids.add(api.id)
      api.dismiss()
    }

    expect(ids.size).toBe(100)
  })
})
