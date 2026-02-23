import * as Notifications from "expo-notifications";
import { NotesRepo } from '../db/notes-repo';
import { NotificationRepo } from '../db/notification-repo';
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
    shouldShowAlert: true, // Show alert in foreground
    shouldShowBanner: true, // Show banner (iOS 17+)
    shouldShowList: true,   // Show in Notification Center (iOS 17+)
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function initNotificationSystem() {
  await NotificationRepo.init()
  const status = await ExpoNotifications.requestPermissions()
  logger.info('Notification system initialized', { permissionStatus: status })

  // Add notification listeners
  Notifications.addNotificationReceivedListener((n) => {
    logger.info('Notification received', { notification: n })
  })
  Notifications.addNotificationResponseReceivedListener((r) => {
    logger.info('Notification response received', { response: r })
  })
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
        { title: note.title, body: note.body || 'Reminder' },
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
    if (!note || !note.initialReminderAt || !note.dueDate) {
      logger.error('Cannot schedule urgent: missing data', { noteId, note })
      return
    }

    // Cancel existing reminders first
    await cancelAllReminders(noteId)
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
        { title: `⚠️ ${note.title}`, body: note.body || 'Urgent reminder' },
        { date: t }
      )
      await NotificationRepo.saveScheduled(noteId, id, t)
    }

    // Always schedule a special notification at dueDate
    if (note.dueDate) {
      const dueId = await ExpoNotifications.scheduleNotification(
        {
          title: `⏰ ${note.title}`,
          body: 'Hey you have an urgent task and its due date is now',
        },
        { date: note.dueDate }
      )
      await NotificationRepo.saveScheduled(noteId, dueId, note.dueDate)
      logger.info('Scheduled dueDate notification', { noteId, dueId, dueDate: note.dueDate })
    }

    // Log all scheduled notifications for this note
    const scheduled = await NotificationRepo.getScheduledByNote(noteId)
    logger.info('All scheduled notifications after scheduling', {
      noteId,
      scheduled: scheduled.map(s => ({ notificationId: s.notificationId, triggerAt: s.triggerAt }))
    })

    logger.info('Scheduled urgent batch', { noteId, count: timestamps.length, isDev })
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
    for (const s of scheduled) {
      await ExpoNotifications.cancelNotification(s.notificationId)
      await NotificationRepo.deleteByNotificationId(s.notificationId)
    }
    logger.info('Cancelled all reminders', { noteId, count: scheduled.length })
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

/**
 * Reconcile all URGENT notes - called on app open/resume
 * Checks for expired notes and reschedules upcoming reminders
 */
export async function reconcileUrgentNotes(isDev = false): Promise<void> {
  try {
    logger.info('Reconciling URGENT notes', { isDev })

    const allNotes = await NotesRepo.listAll()
    const urgentNotes = allNotes.filter(n => n.category === 'URGENT')

    for (const note of urgentNotes) {
      if (!note.dueDate || !note.initialReminderAt) continue

      const now = Date.now()

      // Check if note should be expired
      if (Scheduling.shouldExpire(note.dueDate, now) && note.status !== 'EXPIRED') {
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
  }
}

export const NotificationManager = {
  initNotificationSystem,
  scheduleSingleReminder,
  scheduleUrgentBatch,
  cancelAllReminders,
  markNoteDone,
  reconcileUrgentNotes,
}
