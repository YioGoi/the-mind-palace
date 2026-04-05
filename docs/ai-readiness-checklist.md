# AI Readiness And QA Matrix

## Product channels

- `entitlement/access`
  - real premium access, or `__DEV__` plan override
  - unlocks AI assistant planning
  - unlocks note auto-classification
- `marketing/upsell`
  - teaser at 3 notes
  - teaser at 7 notes
  - reveal/paywall surface at 13 notes
  - must never unlock premium AI behavior by itself

## AI scope in v1

Supported:
- note auto-classification into an existing context
- new context proposal when no existing context is a clear fit
- AI assistant note creation from natural language
- AI assistant reminder and due-date planning

Explicitly not supported:
- bulk cleanup without user confirmation
- background autonomous maintenance
- cross-category moves
- silent deletion, merge, or rewrite of existing notes

## Core acceptance

### Free flow
- Create note without context.
- Create note with manual context selection.
- Rename context.
- Set HAVE reminder.
- Set NICE reminder.
- Set URGENT reminder and due date.
- Verify teaser behavior at 3 notes.
- Verify teaser behavior at 7 notes.
- Verify AI reveal/paywall behavior at 13 notes.
- Verify premium features do not unlock after upsell surfaces.

### Premium flow
- Create note with no context and verify auto-classification runs.
- Create note with no matching context and verify a same-category context is proposed/created.
- Use AI assistant to create a single note.
- Use AI assistant to create multiple notes from one message.
- Use AI assistant to create a note with a reminder.
- Use AI assistant to create an urgent note with due date and reminder.
- Tap a notification and verify the correct tab and note detail modal open.
- Mark note done and verify future reminders are cancelled.

## Edge cases

- Fresh install / DB reset.
- No contexts at all.
- Duplicate context names.
- Empty context rename.
- Very short note like `İş`.
- Very long note body.
- Turkish note text with English context names.
- Ambiguous reminder text.
- Invalid reminder plan from AI.
- Reminder scheduling failure after note creation.
- Category mismatch or orphan `contextId`.
- Collapsed sections with done tooltip visible.
- Simulator haptic warnings do not block note creation.

## AI-specific checks

- `İş` must never be assigned to a context from another category.
- Classification must only see contexts from the note's own category.
- Invalid AI assignment must leave the note visible in `Unsorted`.
- AI-generated dates must respect local timezone and avoid UTC `Z`.
- "Tomorrow at 12" with "4 hours before" should become local `12:00` due and local `08:00` reminder.
- If reminder scheduling fails, note creation must still succeed.

## DEV QA tools

- Settings → `DEV plan override`
- Settings → `Reset done tooltip`
- Settings → `Reset AI upsell milestones`
- Home → `Reset DB (DEV)`

## Release smoke test

1. Run free flow.
2. Run premium flow.
3. Run DB reset and re-seed.
4. Test one AI assistant reminder plan.
5. Test one notification tap routing flow.
6. Confirm no note can disappear because of invalid classification output.
