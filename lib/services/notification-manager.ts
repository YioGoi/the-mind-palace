import * as Notifications from "expo-notifications";
import { router } from 'expo-router';
import { NotesRepo } from '../db/notes-repo';
import { NotificationRepo } from '../db/notification-repo';
import { useAiAssistantStore } from '../store/ai-assistant-store';
import { useNotificationIntentStore } from '../store/notification-intent-store';
import { logger } from '../utils/logger';
import { Scheduling } from '../utils/notification-scheduling';
import { ExpoNotifications } from './notifications';

export type NoteWithReminders = {
  id: string
  title: string
  body?: string
  category: 'HAVE' | 'URGENT' | 'NICE'
  // HAVE/NICE:
  reminderAt?: number | null
  // URGENT:
  initialReminderAt?: number | null
  dueDate?: number | null
  status?: 'PENDING' | 'DONE' | 'EXPIRED'
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, // Show banner (iOS 17+)
    shouldShowList: true,   // Show in Notification Center (iOS 17+)
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let lastHandledNotificationResponseId: string | null = null
let notificationSystemInitialized = false
let notificationReceivedSubscription: Notifications.EventSubscription | null = null
let notificationResponseSubscription: Notifications.EventSubscription | null = null
let reconciliationPromise: Promise<void> | null = null

function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  source: 'listener' | 'initial'
) {
  const responseId = response.notification.request.identifier
  if (responseId && responseId === lastHandledNotificationResponseId) {
    return
  }
  lastHandledNotificationResponseId = responseId
  logger.info('Notification response received', { source, response })

  const data = (response.notification.request.content.data ?? {}) as {
    type?: 'open_note' | 'ai_cleanup_nudge'
    noteId?: string
    category?: 'HAVE' | 'URGENT' | 'NICE'
    prefill?: string
  }

  if (data.type === 'ai_cleanup_nudge') {
    logger.info('Opening AI assistant from cleanup nudge notification', { source, data })
    useAiAssistantStore.getState().open(data.prefill)
    return
  }

  if (!data.noteId || !data.category) {
    logger.info('Notification response missing note routing data', { source, data })
    return
  }

  useNotificationIntentStore.getState().openFromNotification({
    noteId: data.noteId,
    category: data.category,
  })
  router.push(`/${data.category.toLowerCase()}` as '/have' | '/urgent' | '/nice')
}

export async function initNotificationSystem() {
  await NotificationRepo.init()
  if (notificationSystemInitialized) {
    logger.info('Notification system already initialized; reusing existing listeners')
    return
  }

  const status = await ExpoNotifications.requestPermissions()
  logger.info('Notification system initialized', { permissionStatus: status })

  notificationReceivedSubscription?.remove()
  notificationResponseSubscription?.remove()

  notificationReceivedSubscription = Notifications.addNotificationReceivedListener((n) => {
    logger.info('Notification received', { notification: n })
  })

  notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener((r) => {
    handleNotificationResponse(r, 'listener')
  })

  notificationSystemInitialized = true

  const initialResponse = await Notifications.getLastNotificationResponseAsync()
  if (initialResponse) {
    handleNotificationResponse(initialResponse, 'initial')
  }
}

/**
 * Schedule single reminder for HAVE/NICE note
 */
export async function scheduleSingleReminder(noteId: string, reminderAt: number): Promise<void> {
  try {
    // Cancel existing reminders first
    await cancelAllReminders(noteId)

    const note = await NotesRepo.getById(noteId)
    if (!note) {
      logger.error('Cannot schedule: note not found', { noteId })
      return
    }

    const timestamps = Scheduling.generateHaveSchedule(reminderAt)
    for (const t of timestamps) {
      const id = await ExpoNotifications.scheduleNotification(
        {
          title: note.title,
          body: note.body || 'Reminder',
          data: { noteId, category: note.category },
        },
        { date: t }
      )
      await NotificationRepo.saveScheduled(noteId, id, t)
      logger.info('Scheduled single reminder', { noteId, notificationId: id, triggerAt: t })
    }

    // Log all scheduled notifications for this note
    const scheduled = await NotificationRepo.getScheduledByNote(noteId)
    logger.info('All scheduled notifications after scheduling', {
      noteId,
      scheduled: scheduled.map(s => ({ notificationId: s.notificationId, triggerAt: s.triggerAt }))
    })
  } catch (err) {
    logger.error('Schedule single reminder failed', { noteId, err })
    throw err
  }
}

/**
 * Schedule batch of reminders for URGENT note
 */
export async function scheduleUrgentBatch(noteId: string, isDev = false): Promise<void> {
  try {
    const note = await NotesRepo.getById(noteId)
    if (!note || (!note.initialReminderAt && !note.dueDate)) {
      logger.error('Cannot schedule urgent: missing data', { noteId, note })
      return
    }

    // Cancel existing reminders first
    await cancelAllReminders(noteId)

    if (note.initialReminderAt && note.dueDate) {
      // Use the full interval between initialReminderAt and dueDate
      const timestamps = Scheduling.generateUrgentSchedule(
        note.initialReminderAt,
        note.dueDate,
        note.dueDate - note.initialReminderAt,
        Date.now(),
        isDev
      )

      // Schedule interval reminders
      for (const t of timestamps) {
        const id = await ExpoNotifications.scheduleNotification(
          {
            title: `⚠️ ${note.title}`,
            body: note.body || 'Urgent reminder',
            data: { noteId, category: note.category },
          },
          { date: t }
        )
        await NotificationRepo.saveScheduled(noteId, id, t)
      }
    } else if (note.initialReminderAt && note.initialReminderAt > Date.now() + 1000) {
      const id = await ExpoNotifications.scheduleNotification(
        {
          title: `⚠️ ${note.title}`,
          body: note.body || 'Urgent reminder',
          data: { noteId, category: note.category },
        },
        { date: note.initialReminderAt }
      )
      await NotificationRepo.saveScheduled(noteId, id, note.initialReminderAt)
      logger.info('Scheduled urgent reminder without due date', {
        noteId,
        notificationId: id,
        triggerAt: note.initialReminderAt,
      })
    }

    // Schedule a special notification at dueDate when present
    if (note.dueDate && note.dueDate > Date.now() + 1000) {
      const dueId = await ExpoNotifications.scheduleNotification(
        {
          title: `⏰ ${note.title}`,
          body: 'Hey you have an urgent task and its due date is now',
          data: { noteId, category: note.category },
        },
        { date: note.dueDate }
      )
      await NotificationRepo.saveScheduled(noteId, dueId, note.dueDate)
      logger.info('Scheduled dueDate notification', { noteId, dueId, dueDate: note.dueDate })
    } else if (note.dueDate) {
      logger.info('Skipped dueDate notification because it is too close or in the past', {
        noteId,
        dueDate: note.dueDate,
        now: Date.now(),
      })
    }

    // Log all scheduled notifications for this note
    const scheduled = await NotificationRepo.getScheduledByNote(noteId)
    logger.info('All scheduled notifications after scheduling', {
      noteId,
      scheduled: scheduled.map(s => ({ notificationId: s.notificationId, triggerAt: s.triggerAt }))
    })

    logger.info('Scheduled urgent batch', {
      noteId,
      count: scheduled.length,
      hasInitialReminderAt: Boolean(note.initialReminderAt),
      hasDueDate: Boolean(note.dueDate),
      isDev,
    })
  } catch (err) {
    logger.error('Schedule urgent batch failed', { noteId, err })
    throw err
  }
}

/**
 * Cancel all reminders for a note
 */
export async function cancelAllReminders(noteId: string): Promise<void> {
  try {
    const scheduled = await NotificationRepo.getScheduledByNote(noteId)
    const uniqueNotificationIds = [...new Set(scheduled.map(s => s.notificationId))]

    for (const notificationId of uniqueNotificationIds) {
      await ExpoNotifications.cancelNotification(notificationId)
      await NotificationRepo.deleteByNotificationId(notificationId)
    }
    logger.info('Cancelled all reminders', {
      noteId,
      count: uniqueNotificationIds.length,
      duplicateRows: scheduled.length - uniqueNotificationIds.length,
    })
  } catch (err) {
    logger.error('Cancel all reminders failed', { noteId, err })
    throw err
  }
}

/**
 * Mark note as DONE and cancel all reminders
 */
export async function markNoteDone(noteId: string): Promise<void> {
  try {
    // Update note status in DB
    await NotesRepo.updateStatus(noteId, 'DONE')

    // Cancel all scheduled reminders
    await cancelAllReminders(noteId)

    logger.info('Marked note done', { noteId })
  } catch (err) {
    logger.error('Mark note done failed', { noteId, err })
    throw err
  }
}

export async function markNoteUndone(noteId: string): Promise<void> {
  try {
    await NotesRepo.updateStatus(noteId, 'PENDING')
    logger.info('Marked note undone', { noteId })
  } catch (err) {
    logger.error('Mark note undone failed', { noteId, err })
    throw err
  }
}

/**
 * Reconcile all URGENT notes - called on app open/resume
 * Checks for expired notes and reschedules upcoming reminders
 */
export async function reconcileUrgentNotes(isDev = false): Promise<void> {
  if (reconciliationPromise) {
    logger.info('Reconciliation already in progress; reusing active run', { isDev })
    return reconciliationPromise
  }

  reconciliationPromise = (async () => {
    try {
      logger.info('Reconciling URGENT notes', { isDev })

      const allNotes = await NotesRepo.listAll()
      const urgentNotes = allNotes.filter(n => n.category === 'URGENT')

      for (const note of urgentNotes) {
        if (!note.dueDate && !note.initialReminderAt) continue

        const now = Date.now()

        // Check if note should be expired
        if (note.dueDate && Scheduling.shouldExpire(note.dueDate, now) && note.status !== 'EXPIRED') {
          await NotesRepo.updateStatus(note.id, 'EXPIRED')
          await cancelAllReminders(note.id)
          logger.info('Note expired during reconciliation', { noteId: note.id })
          continue
        }

        // Skip if already done or expired
        if (note.status === 'DONE' || note.status === 'EXPIRED') {
          await cancelAllReminders(note.id)
          continue
        }

        // Check if we need to schedule more reminders
        const scheduled = await NotificationRepo.getScheduledByNote(note.id)
        const upcoming = scheduled.filter(s => s.triggerAt >= now)

        if (upcoming.length === 0) {
          logger.info('Rescheduling urgent note', { noteId: note.id })
          await scheduleUrgentBatch(note.id, isDev)
        }
      }

      logger.info('Reconciliation complete')
    } catch (err) {
      logger.error('Reconciliation failed', { err })
      throw err
    } finally {
      reconciliationPromise = null
    }
  })()

  return reconciliationPromise
}

export const NotificationManager = {
  initNotificationSystem,
  scheduleSingleReminder,
  scheduleUrgentBatch,
  cancelAllReminders,
  markNoteDone,
  markNoteUndone,
  reconcileUrgentNotes,
}
