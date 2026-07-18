import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publish_post, retry_failed_post } from "@/lib/tools";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Bounded batch per run: a carousel to both platforms measures ~90s, so a
// larger batch could exceed maxDuration and strand a post mid-loop.
const BATCH = 2;
const MAX_RETRIES = 5;

interface PublishResult {
  post_id: string;
  status: string;
  error?: string;
}

interface WorkItem {
  id: string;
  retry: boolean; // true = a previously-failed post we're re-attempting
}

/**
 * Find the work for this run: posts that are due to publish, plus any that
 * FAILED a previous attempt and are still eligible to retry.
 *
 * The retry sweep is the safety net that matters most: without it, a single
 * transient Meta error (rate limit, timeout) left a due post stuck in 'failed'
 * until a human clicked Retry — so a post could silently miss its date. Now the
 * scheduler re-attempts it automatically (publish_post skips any platform that
 * already succeeded, so there's no double-post), backing off one attempt per
 * run up to MAX_RETRIES before it gives up and waits for manual attention.
 * Fresh due posts take priority; failed retries only use leftover batch slots.
 */
async function findWork(): Promise<WorkItem[]> {
  const admin = supabaseAdmin();
  const now = new Date().toISOString();

  const { data: sched, error: e1 } = await admin
    .from("posts")
    .select("id")
    .eq("status", "scheduled")
    .not("approved_at", "is", null)
    .lte("scheduled_at", now)
    .order("scheduled_at")
    .limit(BATCH);
  if (e1) throw new Error(e1.message);

  const work: WorkItem[] = (sched || []).map((r) => ({ id: r.id, retry: false }));

  const remaining = BATCH - work.length;
  if (remaining > 0) {
    const { data: failed, error: e2 } = await admin
      .from("posts")
      .select("id")
      .eq("status", "failed")
      .not("approved_at", "is", null)
      .lt("retry_count", MAX_RETRIES)
      .lte("scheduled_at", now)
      .order("scheduled_at")
      .limit(remaining);
    if (e2) throw new Error(e2.message);
    for (const r of failed || []) work.push({ id: r.id, retry: true });
  }

  return work;
}

async function processAll(items: WorkItem[]): Promise<PublishResult[]> {
  const results: PublishResult[] = [];
  for (const item of items) {
    try {
      const post = item.retry
        ? await retry_failed_post({ post_id: item.id })
        : await publish_post({ post_id: item.id });
      results.push({
        post_id: item.id,
        status: post.status,
        error: post.error_message ?? undefined,
      });
    } catch (e: any) {
      results.push({ post_id: item.id, status: "error", error: e?.message || String(e) });
    }
  }
  return results;
}

/**
 * GET /api/cron/publish — publishes every post whose scheduled_at is due.
 *
 * Only posts that are status='scheduled' AND approved are ever selected, and
 * publish_post re-checks both invariants.
 *
 * Publishing a carousel takes ~90s, which is longer than a typical scheduler
 * will wait (cron-job.org gives up at 30s). A timed-out call still completes
 * server-side, but the scheduler records it as a failure — and enough recorded
 * failures gets the job auto-disabled, silently stopping all publishing. So by
 * default this acknowledges immediately and finishes the work in the
 * background via waitUntil, which keeps the function alive until the promise
 * settles (bounded by maxDuration).
 *
 * Pass ?wait=1 to block until publishing finishes and get per-post results
 * back. Only use it from a caller with a long timeout — the GitHub Actions
 * manual trigger does this so it can surface per-post failures.
 */
/**
 * The shared secret may arrive as `Authorization: Bearer <secret>` (what
 * Vercel Cron sends), as the bare secret, or as ?key=<secret>.
 *
 * The "Bearer" prefix is a convention, not a security control — the secret is
 * what authenticates. Matching the header byte-for-byte meant a value pasted
 * into a scheduler's header box without the space after "Bearer" produced a
 * 401, which reads as "the endpoint is down" and silently stops all
 * publishing. Accept the reasonable variants instead.
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("authorization")?.trim() ?? "";
  if (header.replace(/^bearer\s*/i, "") === secret) return true;

  return req.nextUrl.searchParams.get("key") === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized: send 'Authorization: Bearer <CRON_SECRET>' or ?key=<CRON_SECRET>" },
      { status: 401 }
    );
  }

  let work: WorkItem[];
  try {
    work = await findWork();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }

  const wait = req.nextUrl.searchParams.get("wait") === "1";

  // Nothing to do, or the caller asked to wait: answer synchronously. The idle
  // case is the common one and returns in well under a second.
  if (wait || work.length === 0) {
    const results = await processAll(work);
    return NextResponse.json({ ok: true, due: work.length, processed: results.length, results });
  }

  // waitUntil is a no-op outside Vercel's runtime, which would drop the work
  // silently on `next dev` — await it there instead.
  if (process.env.VERCEL) {
    waitUntil(processAll(work));
  } else {
    await processAll(work);
  }

  // Deliberately 200 rather than a semantically-nicer 202: schedulers vary in
  // what they count as success, and one that flags 202 would mark every real
  // publish as a failure — the exact thing the background hand-off avoids.
  return NextResponse.json({ ok: true, due: work.length, started: true, results: [] });
}
