// Minimal Jest setup to avoid importing ESM setup from react-native
// Keep it CommonJS so Jest can load it without transformation.

// Polyfills
try {
  require('@react-native/js-polyfills/error-guard')
} catch (e) {
  // Might not be present in non-RN environments in CI; ignore gracefully.
  // Log to help debugging.
  // eslint-disable-next-line no-console
  console.warn('Could not load @react-native/js-polyfills/error-guard', e.message)
}

// Globals used by react-native setup
global.IS_REACT_ACT_ENVIRONMENT = true
global.IS_REACT_NATIVE_TEST_ENVIRONMENT = true

if (typeof global.__DEV__ === 'undefined') global.__DEV__ = true

// Basic timers / animation frame polyfill
if (typeof global.requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0)
}
if (typeof global.cancelAnimationFrame === 'undefined') {
  global.cancelAnimationFrame = (id) => clearTimeout(id)
}

// Minimal performance.now mock
if (typeof global.performance === 'undefined') {
  global.performance = { now: () => Date.now() }
}
