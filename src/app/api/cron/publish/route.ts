import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publish_post } from "@/lib/tools";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface PublishResult {
  post_id: string;
  status: string;
  error?: string;
}

/**
 * Find the posts that are due right now.
 *
 * Bounded batch per run: a carousel to both platforms measures ~90s, so a
 * large batch would exceed maxDuration and strand posts mid-loop in
 * 'publishing' — a state this query never picks back up. At 2/run even a
 * 15-minute schedule clears 8 posts/hour.
 */
async function findDuePosts(): Promise<string[]> {
  const { data, error } = await supabaseAdmin()
    .from("posts")
    .select("id")
    .eq("status", "scheduled")
    .not("approved_at", "is", null)
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(2);

  if (error) throw new Error(error.message);
  return (data || []).map((r) => r.id);
}

async function publishAll(ids: string[]): Promise<PublishResult[]> {
  const results: PublishResult[] = [];
  for (const id of ids) {
    try {
      const post = await publish_post({ post_id: id });
      results.push({ post_id: id, status: post.status, error: post.error_message ?? undefined });
    } catch (e: any) {
      results.push({ post_id: id, status: "error", error: e?.message || String(e) });
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
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let due: string[];
  try {
    due = await findDuePosts();
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }

  const wait = req.nextUrl.searchParams.get("wait") === "1";

  // Nothing to do, or the caller asked to wait: answer synchronously. The idle
  // case is the common one and returns in well under a second.
  if (wait || due.length === 0) {
    const results = await publishAll(due);
    return NextResponse.json({ ok: true, due: due.length, processed: results.length, results });
  }

  // waitUntil is a no-op outside Vercel's runtime, which would drop the work
  // silently on `next dev` — await it there instead.
  if (process.env.VERCEL) {
    waitUntil(publishAll(due));
  } else {
    await publishAll(due);
  }

  return NextResponse.json(
    { ok: true, due: due.length, started: true, results: [] },
    { status: 202 }
  );
}
