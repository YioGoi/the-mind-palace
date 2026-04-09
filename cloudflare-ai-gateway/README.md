# Mind Palace AI Gateway

Cloudflare Worker that sits in front of OpenAI and enforces:

- anonymous install-based identity
- premium-only access
- monthly AI quotas
- short-term rate limits
- usage logging in D1

## Setup

1. Create a D1 database and KV namespace.
2. Update `wrangler.toml` bindings.
3. Apply the migrations:

```bash
wrangler d1 execute mind-palace-ai-gateway --remote --file ./migrations/001_initial.sql
wrangler d1 execute mind-palace-ai-gateway --remote --file ./migrations/002_add_quota_profile.sql
```

4. Set secrets:

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put ADMIN_SECRET
```

5. Deploy:

```bash
wrangler deploy
```

## App endpoint

Point the app to:

```text
https://<worker-domain>/api/ai/chat
```

## Test bootstrap

Use the admin endpoint to grant a device premium during testing:

```bash
curl -X POST https://<worker-domain>/api/admin/users/plan \
  -H "content-type: application/json" \
  -H "x-admin-secret: <ADMIN_SECRET>" \
  -d '{"installId":"<INSTALL_ID>","plan":"premium"}'
```

Use the low-quota test profile to force quota failures quickly:

```bash
curl -X POST https://<worker-domain>/api/admin/users/plan \
  -H "content-type: application/json" \
  -H "x-admin-secret: <ADMIN_SECRET>" \
  -d '{"installId":"<INSTALL_ID>","plan":"premium","quotaProfile":"test_low"}'
```

Then inspect usage:

```bash
curl "https://<worker-domain>/api/ai/usage?installId=<INSTALL_ID>"
```
