Project TODOs (short-term, actionable)

1. UI / Layout
- [ ] Make SafeAreaView consistent across all tab pages (Urgent / Have / Nice / Settings / Home).  — DONE for Urgent/Have/Nice/Settings. Remaining: Home (wrap ParallaxScrollView) ✅
- [ ] Fix Settings header spacing and margins. ✅
- [ ] Add Contexts view and navigation (list, create, rename, delete)

2. Context & AI
- [ ] Improve `pickOrCreateContext` logic with confidence scoring
- [ ] Add `AI_FEEDBACK` user override flow (accept/rename context) and capture feedback

3. Repo & Initialization
- [ ] Investigate repeated repo initialization; avoid redundant init() on rerenders

4. Developer UX
- [ ] Log viewer: add export (done), clipboard copy (optional)
- [ ] Apply `Palette` consistently across components (buttons, links, cards, icons) — in progress (FAB, LogViewer applied)
- [ ] Add e2e test for creating note and asserting logs

5. Tests
- [ ] Add integration tests for note+context flows

6. Release checklist
- [ ] Debug log cleanup before release / TestFlight
- [ ] Remove DEV plan override implementation before release
- [ ] Re-test free/premium gating, Home teaser reveal, and upsell thresholds after removing DEV plan override

Reminders:
- Review the above list during your next session. To view this file run: `pnpm run todo`.
- **Reminder task:** Check TODO list at start of next sprint and verify `Contexts` and `Repo init` items.
