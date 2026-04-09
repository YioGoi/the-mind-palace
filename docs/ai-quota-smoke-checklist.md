# AI Quota Smoke Checklist

Use this checklist after deploying the Cloudflare AI gateway and switching the test device to `quotaProfile=test_low`.

## 1. Bootstrap

1. Confirm `.env` points to the Worker:
   - `EXPO_PUBLIC_AI_GATEWAY_URL=https://<worker-domain>/api/ai/chat`
2. Confirm the device install ID from Settings:
   - `Settings > AI setup > AI install ID`
3. Put the install into premium + low quota:

```bash
curl -X POST https://<worker-domain>/api/admin/users/plan \
  -H "content-type: application/json" \
  -H "x-admin-secret: <ADMIN_SECRET>" \
  -d '{"installId":"<INSTALL_ID>","plan":"premium","quotaProfile":"test_low"}'
```

4. Confirm remote usage:

```bash
curl "https://<worker-domain>/api/ai/usage?installId=<INSTALL_ID>"
```

Expected:
- `plan: premium`
- `quotaProfile: test_low`
- low limits visible
- usage counters start near `0`

## 2. Assistant Capture

1. Open AI Assistant.
2. Send a natural-language capture prompt.
   - Example: `Yarin 3'te disci`
3. Confirm the assistant returns a successful action summary.
4. Refresh `Settings > AI setup > Remote AI usage`.

Expected:
- `requestCount` increments
- token counters increment

When low quota is exceeded:
- UI should show a quota-specific failure
- it should not silently degrade into plain note-save behavior

## 3. Cleanup

1. Prepare a few notes/contexts.
2. Open AI Assistant.
3. Send a cleanup-style prompt.
   - Example: `Clean up my contexts`
4. Confirm cleanup plan/review UI appears.
5. Refresh remote usage.

Expected:
- `feature=assistant_cleanup` request consumes quota
- cleanup plan still requires user confirmation
- over-quota shows the quota error path

## 4. Classification

1. Create or edit a note that triggers AI classification.
2. Confirm it routes through the AI gateway.
3. Refresh remote usage.

Expected:
- remote request count increments
- this exercises `feature=context_assignment`
- over-quota should stop classification and surface a clear failure path

## 5. Rate Limit

With `test_low`, issue multiple AI requests quickly.

Expected:
- after the configured burst, Worker returns `rate_limited`
- app should show a retry-later style message
- usage logs should not overcount blocked requests

## 6. Reset Back To Standard

After smoke testing, restore the device to normal premium limits:

```bash
curl -X POST https://<worker-domain>/api/admin/users/plan \
  -H "content-type: application/json" \
  -H "x-admin-secret: <ADMIN_SECRET>" \
  -d '{"installId":"<INSTALL_ID>","plan":"premium","quotaProfile":"standard"}'
```
