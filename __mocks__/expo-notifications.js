let nextId = 1
const scheduled = new Map()

async function scheduleNotificationAsync({ content, trigger }) {
  const id = `mock-notif-${nextId++}`
  scheduled.set(id, { content, trigger })
  return id
}

async function cancelScheduledNotificationAsync(id) {
  scheduled.delete(id)
}

async function getAllScheduledNotificationsAsync() {
  const arr = []
  for (const [id, { content, trigger }] of scheduled.entries()) {
    arr.push({ id, content, trigger })
  }
  return arr
}

async function requestPermissionsAsync() {
  return { status: 'granted' }
}

module.exports = {
  scheduleNotificationAsync,
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
  requestPermissionsAsync,
}
