import { logger } from './logger'

const MS = {
  second: 1000,
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
}

export function getRepeatIntervalMs(
  remainingMs: number,
  isDev = false,
  useRatio = false
): number {
  // Production tier endpoints
  const endpoints = isDev
    ? { max: 6 * MS.second, mid: 2 * MS.second, min: 30 * MS.second }
    : { max: 6 * MS.hour, mid: 2 * MS.hour, min: 30 * MS.minute }

  // If not using ratio, keep discrete tier behavior for determinism
  if (!useRatio) {
    if (remainingMs > 48 * MS.hour) return endpoints.max
    if (remainingMs > 12 * MS.hour) return endpoints.mid
    return endpoints.min
  }

  // Use piecewise linear interpolation inside tiers for smoother interval spacing
  if (remainingMs >= 48 * MS.hour) return endpoints.max

  if (remainingMs > 12 * MS.hour) {
    // Map remaining in (12h,48h] -> interval in [mid, max]
    const low = 12 * MS.hour
    const high = 48 * MS.hour
    const ratio = (remainingMs - low) / (high - low)
    return Math.round(endpoints.mid + ratio * (endpoints.max - endpoints.mid))
  }

  // remaining <= 12h -> map [0,12h] -> [min, mid]
  const ratio = Math.max(0, remainingMs) / (12 * MS.hour)
  return Math.round(endpoints.min + ratio * (endpoints.mid - endpoints.min))
}

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

  if (start > end) {
    logger.info('No schedules: start > end', { start, end })
    return []
  }

  const schedules: number[] = []
  let t = start
  let last = -1
  while (t <= end) {
    if (t === last) break // safety
    schedules.push(t)
    last = t
    const remaining = Math.max(0, dueDateMs - t)
    const interval = getRepeatIntervalMs(remaining, isDev)
    t = t + interval
  }

  logger.info('Generated schedules', { count: schedules.length, schedules: schedules.slice(0, 5) })
  return schedules
}

export function generateHaveSchedule(alarmAtMs: number, nowMs = Date.now()): number[] {
  if (alarmAtMs <= nowMs) return []
  return [alarmAtMs]
}

export const Scheduling = {
  getRepeatIntervalMs,
  generateUrgentSchedule,
  generateHaveSchedule,
}
