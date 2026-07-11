import { NextRequest, NextResponse } from "next/server";
import { TOOLS, type ToolName } from "@/lib/tools";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 60; // rendering + publishing can take a while
export const dynamic = "force-dynamic";

/**
 * Generic tool dispatcher: POST /api/tools/<tool_name> with a JSON body.
 * Auth: a logged-in dashboard session OR the x-api-key header (for MCP /
 * automation use).
 */
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const key = req.headers.get("x-api-key");
  if (key && process.env.TOOLS_API_KEY && key === process.env.TOOLS_API_KEY) return true;

  const supabase = supabaseServer();
  const { data } = await supabase.auth.getUser();
  return !!data.user;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { tool: string } }
) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = params.tool as ToolName;
  const fn = TOOLS[name];
  if (!fn) {
    return NextResponse.json({ error: `Unknown tool: ${params.tool}` }, { status: 404 });
  }

  let body: any = {};
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await (fn as (args: any) => Promise<unknown>)(body);
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 422 });
  }
}
