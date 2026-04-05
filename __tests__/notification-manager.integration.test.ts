jest.mock('expo-notifications')
jest.mock('expo-crypto')
import { NotificationRepo } from '../lib/db/notification-repo'
import { NotesRepo } from '../lib/db/notes-repo'
import { ExpoNotifications } from '../lib/services/notifications'
import { NotificationManager } from '../lib/services/notification-manager'

const now = Date.now()

describe('NotificationManager integration', () => {
  beforeEach(async () => {
    await NotesRepo.init()
    await NotificationRepo.init()
  })

  test('schedules notifications for HAVE note', async () => {
    const note = await NotesRepo.insert({
      title: 'Have note',
      category: 'HAVE',
      classificationStatus: 'manual',
    })

    await NotesRepo.updateReminder(note.id, now + 1000)

    await NotificationManager.scheduleSingleReminder(note.id, now + 1000)

    const expoScheduled = await ExpoNotifications.getAllScheduledNotifications()
    expect(expoScheduled.length).toBeGreaterThan(0)
  })

  test('cancelAllReminders completes even when repo has no linked rows yet', async () => {
    const note = await NotesRepo.insert({
      title: 'Cancel test',
      category: 'HAVE',
      classificationStatus: 'manual',
    })

    await NotesRepo.updateReminder(note.id, now + 1000)
    await NotificationManager.scheduleSingleReminder(note.id, now + 1000)
    let expoScheduled = await ExpoNotifications.getAllScheduledNotifications()
    expect(expoScheduled.length).toBeGreaterThan(0)

    await expect(NotificationManager.cancelAllReminders(note.id)).resolves.toBeUndefined()
  })
})
