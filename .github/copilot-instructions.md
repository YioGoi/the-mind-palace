Project: My Mind Palace (iOS-first personal cognitive organizer)

========================================
PRODUCT RULES (CORE BEHAVIOR)
========================================

1. Categories (top-level, chosen by user)
- Categories are fixed and shown on separate screens:
  - URGENT
  - HAVE
  - NICE
- Each category screen has a "Create New" button.
- AI NEVER changes the category.

2. Contexts (AI-managed mental drawers)
- AI assigns CONTEXT to each note.
- If an existing context fits → assign to it.
- If none fits → create a new context and assign.
- Users can:
  - rename contexts
  - move notes between contexts
- Every manual change (rename or move) is logged as AI feedback.

3. Notes
- Notes belong to:
  - one category
  - one context
- Notes may have alarms depending on category.

4. First-Time User Context Seeding

On first app launch, before using the app, the user is prompted to create 3 initial contexts.

Purpose:
- These act as the user's first "mental drawers".
- They help AI understand the user's personal structure from the start.

Behavior:
- Show a simple screen: "Create your first 3 contexts"
- Each context:
  - single text field
  - free naming by user
- These contexts are stored under category = HAVE by default.
- AI must prioritize these contexts when classifying early notes.

After creation:
- User proceeds to main app.
- AI uses these as initial context vocabulary.

========================================
ALARM & NOTIFICATION ENGINE (CRITICAL)
========================================

The app includes a local notification engine. This must be deterministic and testable.

GENERAL:
- Notifications use expo-notifications.
- Scheduled notification IDs must be stored in SQLite.
- All alarm state lives locally (no server dependency).
- Use pure functions for time interval calculations.

HAVE NOTES:
- May have a single alarmAt timestamp.
- One notification only.

URGENT NOTES:
- Must have:
  - initialAlarmAt
  - dueDate
- Behavior:
  - First notification at initialAlarmAt.
  - After that, repeated reminders until:
    - user marks Done → stop all notifications
    - dueDate passes → status = EXPIRED

REPEAT INTERVAL RULES (PRODUCTION LOGIC):
Let remaining time = dueDate - now

- If remaining > 48h → interval = 6h
- If 48h–12h → interval = 2h
- If <12h → interval = 30m

DEV / TEST MODE:
Intervals must be scaled down (seconds instead of hours) for simulator testing.

SCHEDULING STRATEGY:
- Do NOT schedule infinite notifications.
- Use batch scheduling (window-based).
- On app open / resume → reconciliation:
  - Ensure notifications are scheduled up to a future window.
  - Cancel notifications if note is DONE or EXPIRED.

USER ACTIONS:
- "Done" → cancel all scheduled notifications.
- "Later" does NOT stop engine; scheduling continues.

========================================
TECH STACK
========================================
- Expo (managed)
- TypeScript
- Local DB: expo-sqlite
- Notifications: expo-notifications
- State management: zustand
- iOS-first

========================================
CODING EXPECTATIONS
========================================
- Keep modules small and composable.
- Use repository pattern for DB access.
- Pure functions for scheduling logic.
- Always log:
  - schedule events
  - cancel events
  - state transitions
- Avoid adding new dependencies unless necessary.
