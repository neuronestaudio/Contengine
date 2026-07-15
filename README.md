# Contengine

Lightweight multi-client social media scheduler. Receives completed posts (HTML slides + caption + metadata), renders slides to 1080×1350 PNGs with Playwright, runs an approval workflow, schedules against each client's preferred cadence, and publishes to Facebook Pages and Instagram via the Meta Graph API.

**Stack:** Next.js 14 (App Router, TypeScript) · Supabase (Postgres, Auth, Storage) · Playwright + serverless Chromium · Vercel (hosting + cron).

## Post lifecycle

```
draft → ready → awaiting_approval → approved → scheduled → publishing → published
                                                              ↘ failed → (retry) → scheduled
```

Publishing is deterministic: only posts that are **approved** and **scheduled** are ever published. The cron publisher and `publish_post` both enforce this — automation (including Claude via MCP later) can edit captions and recommend schedules, but can never publish unapproved content.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run `supabase/migrations/0001_init.sql` (creates tables, enum, RLS, and the public `renders` storage bucket).
3. Authentication → Users → **Add user** (email + password) — this is your dashboard login.
4. Copy from Project Settings → API: project URL, `anon` key, `service_role` key.

### 2. Local dev

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

For local rendering, set `LOCAL_CHROME_PATH` in `.env.local` to your Chrome executable (serverless Chromium is used automatically on Vercel).

### 3. Push to GitHub + deploy on Vercel

```bash
git init
git add -A
git commit -m "Contengine initial build"
git remote add origin https://github.com/neuronestaudio/Contengine.git
git branch -M main
git push -u origin main
```

In Vercel: **Import** the repo, add every variable from `.env.example` as environment variables, and deploy. Do **not** set `LOCAL_CHROME_PATH` in Vercel — `render.ts` checks it first and it would bypass the serverless Chromium build.

### Scheduling the publisher

`vercel.json` deliberately declares **no cron**. A Hobby account rejects any schedule that runs more than once a day, and it fails the *whole deployment* rather than just the cron — so `"crons": [{"schedule": "*/5 * * * *"}]` means nothing deploys at all.

Instead, point an external scheduler (e.g. cron-job.org) at the publish endpoint every 5 minutes:

```
GET https://<your-app>/api/cron/publish
Authorization: Bearer <CRON_SECRET>
```

The endpoint 401s without that header. Publishing a carousel to both platforms takes ~90s, so a scheduler with a short response timeout may log the call as failed while it actually succeeds — confirm via **Published Content**, not the scheduler's log. `/api/cron/publish` publishes at most 2 posts per run to stay inside `maxDuration`; on a 5-minute schedule that clears 24 posts/hour.

On the Pro plan you can drop the external scheduler and restore `"crons": [{ "path": "/api/cron/publish", "schedule": "*/5 * * * *" }]` — Vercel then sends the `CRON_SECRET` bearer automatically.

### Node.js version

Pinned to **22.x** via `engines` in `package.json`. Vercel's project setting may still read 24.x; `engines` overrides it for the function runtime (the dashboard shows a "Node.js Version Override" badge). This matters because `@sparticuz/chromium` detects Lambda by string-matching `AWS_EXECUTION_ENV`, which Vercel never sets — see the comment in `src/lib/render.ts`.

### 4. Meta (Facebook + Instagram) per client

Each client row stores its own credentials — configure in **Client Settings**:

1. Create a Meta app (Business type) at developers.facebook.com with `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`.
2. Get a **long-lived Page access token** for the client's Facebook Page (Graph API Explorer → user token → exchange → `/{page-id}?fields=access_token`).
3. Instagram must be a **professional account linked to that Page**; its ID comes from `/{page-id}?fields=instagram_business_account`.
4. Enter Page ID, IG user ID, and the Page token in Client Settings.

Rendered PNGs live in a public Supabase bucket so Meta can fetch them by URL (required by the API).

## Ingesting posts

**Import page** — upload one or more HTML slide files, set caption/category/platforms, optionally render immediately.

**API** — `POST /api/ingest` with header `x-api-key: $TOOLS_API_KEY`:

```json
{
  "client_id": "uuid",
  "title": "optional",
  "caption": "Post caption…",
  "category": "education",
  "platforms": ["facebook", "instagram"],
  "campaign": { "series": "meditation-week-3" },
  "slides": [{ "html": "<!doctype html>…" }],
  "render_now": true
}
```

Slides render at exactly **1080×1350** — author your HTML against that viewport.

## Tool layer (MCP-ready)

All operations live in `src/lib/tools/index.ts` and are exposed over `POST /api/tools/<name>` (dashboard session **or** `x-api-key` header). An MCP server can later wrap these 1:1:

| Tool | Purpose |
|---|---|
| `list_ready_posts` | Posts received and awaiting render |
| `list_posts` | Filter by status / client |
| `get_post` | Full post record |
| `update_caption` | Edit caption (blocked once publishing) |
| `approve_post` | Requires rendered media; stamps approved_at |
| `render_post` | HTML slides → 1080×1350 PNGs → Storage |
| `schedule_post` | Approved posts only; explicit ISO time |
| `schedule_next_available_slot` | Client cadence-aware next slot |
| `auto_schedule_posts` | Distribute all approved posts across slots (pillar rotation-aware) |
| `reschedule_post` | Move a scheduled post |
| `publish_post` | Hard-guarded: scheduled + approved + rendered only |
| `list_failed_posts` | Failures with error + retry count |
| `retry_failed_post` | Re-publish (max 5 retries; successful platforms skipped) |
| `list_clients` / `upsert_client` | Client management |
| `ingest_post` | Programmatic post intake |

Example:

```bash
curl -X POST https://your-app.vercel.app/api/tools/list_ready_posts \
  -H "x-api-key: $TOOLS_API_KEY" -H "Content-Type: application/json" -d '{}'
```

## Scheduling model

Per client: preferred days (0=Sun…6=Sat), preferred times (HH:MM in the client's IANA timezone), weekly frequency cap, default platforms, brand instructions, and a content-pillar rotation. `schedule_next_available_slot` walks day×time candidates forward (90-day horizon), skipping past times, booked slots, and weeks at quota. `auto_schedule_posts` orders approved posts by the pillar rotation (matching post `category`), then fills slots sequentially. Both are pure functions of client settings + booked slots — deterministic and testable (`src/lib/scheduling.ts`).

## Views

Ready Content `/` · Awaiting Approval `/approval` · Scheduled `/scheduled` · Calendar `/calendar` · Published `/published` · Failed `/failed` · Import `/import` · Client Settings `/clients`.

## Failure handling

Per-platform results are stored in `platform_results` (post ID, permalink, error). A post is `failed` if any selected platform errored; retrying skips platforms that already succeeded. `error_message` and `retry_count` (max 5) are tracked on the post.
