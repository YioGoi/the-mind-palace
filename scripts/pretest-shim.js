const fs = require('fs')
const path = require('path')

const target = path.resolve(__dirname, '..', 'node_modules', 'react-native', 'jest', 'setup.js')
const backup = target + '.bak'
const shim = `// Auto-generated CommonJS shim to replace ESM setup during tests
try {
  require('@react-native/js-polyfills/error-guard')
} catch (e) {
  // ignore
}

global.IS_REACT_ACT_ENVIRONMENT = true
global.IS_REACT_NATIVE_TEST_ENVIRONMENT = true
if (typeof global.__DEV__ === 'undefined') global.__DEV__ = true
if (typeof global.requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0)
}
if (typeof global.cancelAnimationFrame === 'undefined') {
  global.cancelAnimationFrame = (id) => clearTimeout(id)
}
if (typeof global.performance === 'undefined') {
  global.performance = { now: () => Date.now() }
}
`

try {
  if (fs.existsSync(target)) {
    const content = fs.readFileSync(target, 'utf8')
    if (!fs.existsSync(backup)) fs.writeFileSync(backup, content, 'utf8')
    fs.writeFileSync(target, shim, 'utf8')
    console.log('Patched react-native jest setup to CommonJS shim')
  } else {
    console.warn('Target react-native setup.js not found, skipping shim')
  }
} catch (e) {
  console.error('Error creating shim:', e)
  process.exit(1)
}
