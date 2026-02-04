import * as Notifications from 'expo-notifications'
import { logger } from '../utils/logger'

export async function requestPermissions() {
  const { status } = await Notifications.requestPermissionsAsync()
  logger.info('Notification permission status', { status })
  return status
}

export async function scheduleNotification(
  content: { title: string; body?: string },
  trigger: { date: number } | Notifications.NotificationTriggerInput
) {
  logger.debug('Scheduling notification', { content, trigger })

  // Normalize simple { date: number } → { type: 'date', date: new Date(number) }
  let triggerArg: Notifications.NotificationTriggerInput
  if ((trigger as any).date && typeof (trigger as any).date === 'number') {
    triggerArg = { type: 'date', date: new Date((trigger as any).date) } as any
  } else {
    triggerArg = trigger as Notifications.NotificationTriggerInput
  }

  const id = await Notifications.scheduleNotificationAsync({ content, trigger: triggerArg })
  logger.info('Scheduled notification', { id, triggerDate: triggerArg })
  return id
}

export async function cancelNotification(notificationId: string) {
  logger.debug('Cancel notification', { notificationId })
  await Notifications.cancelScheduledNotificationAsync(notificationId)
  logger.info('Cancelled notification', { notificationId })
}

export async function getAllScheduledNotifications() {
  const list = await Notifications.getAllScheduledNotificationsAsync()
  logger.debug('Fetched scheduled notifications', { count: list.length })
  return list
}

export const ExpoNotifications = {
  requestPermissions,
  scheduleNotification,
  cancelNotification,
  getAllScheduledNotifications,
}
