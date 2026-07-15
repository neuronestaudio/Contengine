import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publish_post } from "@/lib/tools";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/publish — invoked by Vercel Cron every 5 minutes.
 * Publishes every post whose scheduled_at is due. Only posts that are
 * status='scheduled' AND approved ever reach publish_post, and publish_post
 * re-checks both invariants.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: due, error } = await supabaseAdmin()
    .from("posts")
    .select("id")
    .eq("status", "scheduled")
    .not("approved_at", "is", null)
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    // Bounded batch per run. A carousel to both platforms measures ~90s, so 10
    // would exceed maxDuration and strand posts mid-loop in 'publishing' — a
    // state the query above never picks back up. At 2/run on a 5-minute
    // schedule this still clears 24 posts/hour.
    .limit(2);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: { post_id: string; status: string; error?: string }[] = [];
  for (const row of due || []) {
    try {
      const post = await publish_post({ post_id: row.id });
      results.push({ post_id: row.id, status: post.status, error: post.error_message ?? undefined });
    } catch (e: any) {
      results.push({ post_id: row.id, status: "error", error: e?.message || String(e) });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
