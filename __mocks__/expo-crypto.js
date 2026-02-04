// Mock expo-crypto for Jest tests
let counter = 0

function randomUUID() {
  counter++
  return `test-uuid-${Date.now()}-${counter}`
}

// Export as namespace (for import * as Crypto)
exports.randomUUID = randomUUID

// Export named (for import { randomUUID })
module.exports.randomUUID = randomUUID
