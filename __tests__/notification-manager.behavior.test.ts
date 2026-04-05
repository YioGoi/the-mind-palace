jest.mock('expo-sqlite')
jest.mock('expo-crypto')
jest.mock('expo-notifications')
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}))
jest.mock('../lib/store/ai-assistant-store', () => ({
  useAiAssistantStore: {
    getState: () => ({
      open: jest.fn(),
    }),
  },
}))
jest.mock('../lib/store/notification-intent-store', () => ({
  useNotificationIntentStore: {
    getState: () => ({
      openFromNotification: jest.fn(),
    }),
  },
}))

describe('NotificationManager behavior', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  test('initNotificationSystem reuses existing listeners when called twice', async () => {
    const Notifications = require('expo-notifications')
    ;(Notifications as any).__resetMockNotifications?.()

    const receivedSpy = jest.spyOn(Notifications, 'addNotificationReceivedListener')
    const responseSpy = jest.spyOn(Notifications, 'addNotificationResponseReceivedListener')

    const { initNotificationSystem } = require('../lib/services/notification-manager')

    await initNotificationSystem()
    await initNotificationSystem()

    expect(receivedSpy).toHaveBeenCalledTimes(1)
    expect(responseSpy).toHaveBeenCalledTimes(1)
  })

  test('reconcileUrgentNotes reuses the active run for concurrent calls', async () => {
    const Notifications = require('expo-notifications')
    ;(Notifications as any).__resetMockNotifications?.()

    const { getDb } = require('../lib/db/database')
    const { NotesRepo } = require('../lib/db/notes-repo')
    const { NotificationRepo } = require('../lib/db/notification-repo')
    const { reconcileUrgentNotes } = require('../lib/services/notification-manager')

    await Promise.all([NotesRepo.init(), NotificationRepo.init()])

    const db = getDb() as { __tables?: Record<string, { rows: unknown[] }> }
    for (const table of Object.values(db.__tables ?? {})) {
      table.rows = []
    }

    const note = await NotesRepo.insert({
      title: 'Urgent deadline',
      category: 'URGENT',
      classificationStatus: 'manual',
    })
    await NotesRepo.updateUrgentReminders(note.id, Date.now() + 60_000, Date.now() + 120_000)

    const listAllSpy = jest.spyOn(NotesRepo, 'listAll')

    await Promise.all([reconcileUrgentNotes(true), reconcileUrgentNotes(true)])

    expect(listAllSpy).toHaveBeenCalledTimes(1)
  })
})
