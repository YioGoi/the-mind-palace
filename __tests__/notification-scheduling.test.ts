import { generateUrgentSchedule, getRepeatIntervalMs } from '../app/utils/notification-scheduling'

describe('getRepeatIntervalMs', () => {
  const HOUR = 60 * 60 * 1000
  test('remaining > 48h -> 6h', () => {
    expect(getRepeatIntervalMs(49 * HOUR, false)).toBe(6 * HOUR)
  })
  test('48h–12h -> 2h', () => {
    expect(getRepeatIntervalMs(24 * HOUR, false)).toBe(2 * HOUR)
  })
  test('<12h -> 30m', () => {
    expect(getRepeatIntervalMs(6 * HOUR, false)).toBe(30 * 60 * 1000)
  })
  test('dev mode scales down to seconds', () => {
    expect(getRepeatIntervalMs(49 * HOUR, true)).toBe(6 * 1000)
    expect(getRepeatIntervalMs(24 * HOUR, true)).toBe(2 * 1000)
    expect(getRepeatIntervalMs(6 * HOUR, true)).toBe(30 * 1000)
  })
})

describe('generateUrgentSchedule', () => {
  test('returns empty when start > end', () => {
    const now = Date.now()
    const initial = now + 1000
    const due = now + 500
    const windowMs = 1000000
    const result = generateUrgentSchedule(initial, due, windowMs, now, true)
    expect(result.length).toBe(0)
  })
})

describe('getRepeatIntervalMs with ratio', () => {
  const HOUR = 60 * 60 * 1000
  const MINUTE = 60 * 1000

  test('interpolates between mid and max for 30h remaining (=> 4h)', () => {
    const remaining = 30 * HOUR
    const interval = getRepeatIntervalMs(remaining, false, true)
    expect(interval).toBe(4 * HOUR) // midpoint between 2h and 6h
  })

  test('interpolates between min and mid for 6h remaining (=> 1h15m)', () => {
    const remaining = 6 * HOUR
    const interval = getRepeatIntervalMs(remaining, false, true)
    expect(interval).toBe(75 * MINUTE) // 1h15m
  })

  test('dev mode interpolation uses seconds', () => {
    const remaining = 30 * HOUR
    const interval = getRepeatIntervalMs(remaining, true, true)
    expect(interval).toBe(4 * 1000)
  })
})
