import { NotificationRepo } from '../db/notification-repo'
import { logger } from '../utils/logger'
import { Scheduling } from '../utils/notification-scheduling'
import { ExpoNotifications } from './notifications'

export type Note = {
  id: string
  title: string
  body?: string
  category: 'HAVE' | 'URGENT' | 'NICE'
  contextId?: string | null
  // HAVE:
  alarmAt?: number
  // URGENT:
  initialAlarmAt?: number
  dueDate?: number
  status?: 'OPEN' | 'DONE' | 'EXPIRED'
}

export async function initNotificationSystem() {
  await NotificationRepo.init()
  logger.info('Notification system initialized')
}

export async function scheduleForHave(note: Note) {
  if (!note.alarmAt) return
  await NotificationRepo.deleteAllForNote(note.id)
  const timestamps = Scheduling.generateHaveSchedule(note.alarmAt)
  for (const t of timestamps) {
    const id = await ExpoNotifications.scheduleNotification({ title: note.title, body: note.body }, { date: t })
    await NotificationRepo.saveScheduled({ noteId: note.id, notificationId: id, scheduledAt: t, type: 'HAVE' })
  }
}

export async function scheduleForUrgent(note: Note, windowMs: number, isDev = false) {
  if (!note.initialAlarmAt || !note.dueDate) return
  await NotificationRepo.deleteAllForNote(note.id)
  const timestamps = Scheduling.generateUrgentSchedule(note.initialAlarmAt, note.dueDate, windowMs, Date.now(), isDev)
  for (const t of timestamps) {
    const id = await ExpoNotifications.scheduleNotification({ title: note.title, body: note.body }, { date: t })
    await NotificationRepo.saveScheduled({ noteId: note.id, notificationId: id, scheduledAt: t, type: 'URGENT' })
  }
}

export async function cancelForNote(noteId: string) {
  const rows = await NotificationRepo.getScheduledByNote(noteId)
  for (const r of rows) {
    await ExpoNotifications.cancelNotification(r.notificationId)
    await NotificationRepo.deleteByNotificationId(r.notificationId)
  }
  logger.info('Cancelled all notifications for note', { noteId })
}

// Reconcile scheduled notifications with actual note states.
// getNoteById should return Note | null. This keeps the manager decoupled from app storage.
export async function reconcile(
  windowMs: number,
  getNoteById: (noteId: string) => Promise<Note | null>,
  getAllNotes?: () => Promise<Note[]>,
  isDev = false
) {
  logger.info('Reconciliation started', { windowMs, isDev })
  const scheduled = await NotificationRepo.listAllScheduled()

  // First pass: reconcile existing scheduled rows
  for (const row of scheduled) {
    const note = await getNoteById(row.noteId)

    // If the notes storage isn't available (note === null), skip reconciliation for this row.
    if (note === null) {
      logger.info('Reconciling: note not available in storage; skipping', { noteId: row.noteId })
      continue
    }

    // Note is done or expired -> cancel scheduled
    if (note.status === 'DONE' || (note.dueDate && note.dueDate <= Date.now())) {
      logger.info('Reconciling: cancelling schedule because note done/expired', { row, noteStatus: note.status })
      try {
        await ExpoNotifications.cancelNotification(row.notificationId)
        await NotificationRepo.deleteByNotificationId(row.notificationId)
      } catch (e) {
        logger.error('Error cancelling during reconcile', { err: e })
      }
      continue
    }

    // If there are no schedules for note in the upcoming window, schedule more.
    const upcoming = (await NotificationRepo.getScheduledByNote(row.noteId)).filter((r) => r.scheduledAt >= Date.now())
    if (upcoming.length === 0) {
      logger.info('Reconciling: scheduling more notifications for note', { noteId: row.noteId })
      if (note.category === 'HAVE') await scheduleForHave(note)
      else if (note.category === 'URGENT') await scheduleForUrgent(note, windowMs, isDev)
    }
  }

  // Second pass: if getAllNotes provided, check for notes with no schedules and seed schedules
  if (getAllNotes) {
    const allNotes = await getAllNotes()
    for (const note of allNotes) {
      // skip deleted or done or expired
      if (!note || note.status === 'DONE' || (note.dueDate && note.dueDate <= Date.now())) continue

      const rowsForNote = await NotificationRepo.getScheduledByNote(note.id)
      const upcoming = rowsForNote.filter((r) => r.scheduledAt >= Date.now())
      if (upcoming.length === 0) {
        logger.info('Reconciling: seeding schedules for note', { noteId: note.id })
        if (note.category === 'HAVE') await scheduleForHave(note)
        else if (note.category === 'URGENT') await scheduleForUrgent(note, windowMs, isDev)
      }
    }
  }

  logger.info('Reconciliation finished')
}

export const NotificationManager = {
  initNotificationSystem,
  scheduleForHave,
  scheduleForUrgent,
  cancelForNote,
  reconcile,
}
