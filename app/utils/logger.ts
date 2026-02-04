export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const MAX_LOG_BUFFER = 500
const LOG_BUFFER: any[] = []

function safeStringify(obj: any) {
  const seen = new WeakSet();
  return JSON.stringify(obj, function (key, value) {
    if (value instanceof Error) {
      return { __isError: true, name: value.name, message: value.message, stack: value.stack };
    }
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    if (typeof value === 'undefined') return '[undefined]';
    if (typeof value === 'function') return '[Function]';
    return value;
  }, 2);
}

export function log(level: LogLevel, message: string, meta?: Record<string, any>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    meta: meta ?? null,
  }
  // Write to the in-memory buffer (capped) for in-app viewing and tests
  try {
    LOG_BUFFER.push(payload)
    if (LOG_BUFFER.length > MAX_LOG_BUFFER) LOG_BUFFER.shift()
  } catch (e) {
    // ignore buffer errors
  }

  // Precise, machine-readable logging for deterministic testability.
  try {
    let s = '';
    if (payload === undefined) {
      s = '[logger] No payload provided';
    } else if (payload === null) {
      s = '[logger] Null payload';
    } else {
      try {
        s = safeStringify(payload);
      } catch (err) {
        s = '[logger] Unserializable payload';
      }
    }
    if (level === 'error') {
      console.error(s);
    } else {
      console.log(s);
    }
  } catch (e) {
    // Fallback: ensure logging never throws
    try {
      if (level === 'error') console.error('logger serialization failed', message);
      else console.log('logger serialization failed', message);
    } catch (e2) {
      // swallow
    }
  }
}

export function getLogs(filter?: (l: any) => boolean, limit = 200) {
  const items = filter ? LOG_BUFFER.filter(filter) : LOG_BUFFER.slice()
  return items.slice(Math.max(0, items.length - limit))
}

export function clearLogs() {
  LOG_BUFFER.length = 0
}

export const logger = {
  debug: (m: string, meta?: Record<string, any>) => log('debug', m, meta),
  info: (m: string, meta?: Record<string, any>) => log('info', m, meta),
  warn: (m: string, meta?: Record<string, any>) => log('warn', m, meta),
  error: (m: string, meta?: Record<string, any>) => log('error', m, meta),
  getLogs,
  clearLogs,
}

