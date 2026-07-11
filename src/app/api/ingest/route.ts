import { NextRequest, NextResponse } from "next/server";
import { ingest_post, render_post } from "@/lib/tools";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const maxDuration = 120; // optional immediate render
export const dynamic = "force-dynamic";

/**
 * POST /api/ingest
 * Accepts completed posts from the content-generation pipeline or the Import
 * page. Body:
 * {
 *   "client_id": "...",
 *   "caption": "...",
 *   "title": "...",             // optional
 *   "category": "...",          // optional (content pillar)
 *   "platforms": ["facebook"],  // optional, defaults to client defaults
 *   "campaign": { ... },        // optional metadata
 *   "slides": [{ "html": "<!doctype html>..." }],
 *   "render_now": true          // optional: render immediately after ingest
 * }
 */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-api-key");
  const keyOk = key && process.env.TOOLS_API_KEY && key === process.env.TOOLS_API_KEY;
  if (!keyOk) {
    const supabase = supabaseServer();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let post;
  try {
    post = await ingest_post({
      client_id: body.client_id,
      title: body.title,
      caption: body.caption ?? "",
      category: body.category,
      platforms: body.platforms,
      campaign: body.campaign,
      slides: body.slides,
      source: body.source ?? "ingest_api",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 422 });
  }

  // Rendering is best-effort: a render failure must never lose the post.
  // On failure the post stays in Ready with the error recorded on it.
  let render_error: string | null = null;
  if (body.render_now) {
    try {
      post = await render_post({ post_id: post.id });
    } catch (e: any) {
      render_error = e?.message || String(e);
      try {
        await supabaseAdmin()
          .from("posts")
          .update({ error_message: `Render failed: ${render_error}` })
          .eq("id", post.id);
      } catch {
        /* keep the original error */
      }
    }
  }

  return NextResponse.json({ ok: true, post, render_error });
}
