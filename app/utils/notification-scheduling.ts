import { logger } from './logger'

const MS = {
  second: 1000,
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
}

/**
 * Determine repeat interval based on remaining time until dueDate
 * Production: > 48h → 6h, 48-12h → 2h, < 12h → 30m
 * Dev mode: > 48h → 6s, 48-12h → 2s, < 12h → 30s
 */
export function getRepeatIntervalMs(
  remainingMs: number,
  isDev = false,
  useRatio = false
): number {
  const endpoints = isDev
    ? { max: 1 * MS.minute, mid: 1 * MS.minute, min: 1 * MS.minute }
    : { max: 6 * MS.hour, mid: 2 * MS.hour, min: 30 * MS.minute }

  logger.debug('getRepeatIntervalMs called', { remainingMs, isDev, useRatio, endpoints })

  if (!useRatio) {
    if (remainingMs > 48 * MS.hour) {
      logger.debug('Interval: >48h', { interval: endpoints.max })
      return endpoints.max
    }
    if (remainingMs > 12 * MS.hour) {
      logger.debug('Interval: 48h-12h', { interval: endpoints.mid })
      return endpoints.mid
    }
    logger.debug('Interval: <12h', { interval: endpoints.min })
    return endpoints.min
  }

  if (remainingMs >= 48 * MS.hour) {
    logger.debug('Interval: >=48h (ratio)', { interval: endpoints.max })
    return endpoints.max
  }

  if (remainingMs > 12 * MS.hour) {
    const low = 12 * MS.hour
    const high = 48 * MS.hour
    const ratio = (remainingMs - low) / (high - low)
    const interval = Math.round(endpoints.mid + ratio * (endpoints.max - endpoints.mid))
    logger.debug('Interval: 12h-48h (ratio)', { interval, ratio })
    return interval
  }

  const ratio = Math.max(0, remainingMs) / (12 * MS.hour)
  const interval = Math.round(endpoints.min + ratio * (endpoints.mid - endpoints.min))
  logger.debug('Interval: <=12h (ratio)', { interval, ratio })
  return interval
}

/**
 * Generate trigger times for URGENT note batch scheduling
 * Schedules from initialAlarmAt up to windowMs in future, but never past dueDate
 */
export function generateUrgentSchedule(
  initialAlarmAtMs: number,
  dueDateMs: number,
  windowMs: number,
  nowMs = Date.now(),
  isDev = false
): number[] {
  logger.debug('generateUrgentSchedule called', {
    initialAlarmAtMs,
    dueDateMs,
    windowMs,
    nowMs,
    isDev,
  })

  const start = Math.max(initialAlarmAtMs, nowMs)
  const end = Math.min(dueDateMs, nowMs + windowMs)

  logger.debug('Urgent schedule window', { start, end })

  if (start > end) {
    logger.info('No schedules: start > end', { start, end })
    return []
  }

  const schedules: number[] = []
  let t = start
  let last = -1
  while (t <= end) {
    if (t === last) break // safety
    logger.debug('Urgent schedule loop', { t, last, end })
    schedules.push(t)
    last = t
    const remaining = Math.max(0, dueDateMs - t)
    const interval = getRepeatIntervalMs(remaining, isDev)
    logger.debug('Urgent schedule interval', { t, remaining, interval })
    t = t + interval
  }

  logger.info('Generated schedules', { count: schedules.length, schedules: schedules.slice(0, 5) })
  return schedules
}

/**
 * Generate trigger time for HAVE/NICE single reminder
 */
export function generateHaveSchedule(alarmAtMs: number, nowMs = Date.now()): number[] {
  logger.debug('generateHaveSchedule called', { alarmAtMs, nowMs })
  if (alarmAtMs <= nowMs) {
    logger.info('No schedule: alarmAtMs <= nowMs', { alarmAtMs, nowMs })
    return []
  }
  logger.info('Generated HAVE schedule', { alarmAtMs })
  return [alarmAtMs]
}

/**
 * Check if note should be marked EXPIRED (dueDate passed)
 */
export function shouldExpire(dueDate: number, now: number = Date.now()): boolean {
  return now > dueDate
}

export const Scheduling = {
  getRepeatIntervalMs,
  generateUrgentSchedule,
  generateHaveSchedule,
  shouldExpire,
}
