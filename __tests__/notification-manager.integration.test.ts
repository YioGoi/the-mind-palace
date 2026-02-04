jest.mock('expo-notifications')
jest.mock('expo-crypto')
import * as notifications from 'expo-notifications'
import { NotificationRepo } from '../app/db/notification-repo'
import type { Note } from '../app/services/notification-manager'
import { cancelForNote, scheduleForHave } from '../app/services/notification-manager'

const now = Date.now()

describe('NotificationManager integration', () => {
  beforeEach(async () => {
    await NotificationRepo.init()
  })

  test('schedules notifications for HAVE note', async () => {
    const note: Note = {
      id: 'have-test-1',
      title: 'Have note',
      category: 'HAVE',
      alarmAt: now + 1000,
    }

    await scheduleForHave(note)

    const scheduledRows = await NotificationRepo.getScheduledByNote(note.id)
    expect(scheduledRows.length).toBeGreaterThan(0)

    const expoScheduled = await notifications.getAllScheduledNotificationsAsync()
    expect(expoScheduled.length).toBeGreaterThan(0)
  })

  test('cancels scheduled notifications', async () => {
    const noteId = 'have-cancel-1'
    const note: Note = {
      id: noteId,
      title: 'Cancel test',
      category: 'HAVE',
      alarmAt: now + 1000,
    }
    
    await scheduleForHave(note)
    let rows = await NotificationRepo.getScheduledByNote(noteId)
    expect(rows.length).toBeGreaterThan(0)

    await cancelForNote(noteId)
    rows = await NotificationRepo.getScheduledByNote(noteId)
    expect(rows.length).toBe(0)
  })
})
