import { existsSync } from "fs";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface HealthCheck {
  name: string;
  ok: boolean;
  detail: string;
  fix?: string;
}

export async function runHealthChecks(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];

  // 1. Environment variables
  const envVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CRON_SECRET",
    "TOOLS_API_KEY",
  ];
  const missing = envVars.filter((v) => !process.env[v] || process.env[v]!.includes("YOUR-"));
  checks.push({
    name: "Environment variables",
    ok: missing.length === 0,
    detail: missing.length ? `Missing/placeholder: ${missing.join(", ")}` : "All set",
    fix: missing.length ? "Fill in .env.local and restart the dev server" : undefined,
  });

  // 2. Database connection + tables (fetch actual rows, not just counts,
  // so this page and the app pages can never disagree)
  try {
    const { data: clientRows, error: cErr } = await supabaseAdmin()
      .from("clients")
      .select("id, name, created_at")
      .order("name");
    if (cErr) throw new Error(cErr.message);
    const { error: pErr, count: postCount } = await supabaseAdmin()
      .from("posts")
      .select("*", { count: "exact", head: true });
    if (pErr) throw new Error(pErr.message);
    const names = (clientRows || []).map((c) => c.name || "(unnamed)").join(", ");
    checks.push({
      name: "Database (clients + posts tables)",
      ok: true,
      detail: `Connected to ${process.env.NEXT_PUBLIC_SUPABASE_URL} — ${clientRows?.length ?? 0} client(s)${names ? `: ${names}` : ""} · ${postCount ?? 0} post(s)`,
    });
  } catch (e: any) {
    checks.push({
      name: "Database (clients + posts tables)",
      ok: false,
      detail: e?.message || String(e),
      fix: "Run supabase/migrations/0001_init.sql in the Supabase SQL Editor",
    });
  }

  // 3. Storage bucket
  try {
    const { data, error } = await supabaseAdmin().storage.listBuckets();
    if (error) throw new Error(error.message);
    const has = (data || []).some((b) => b.name === "renders");
    checks.push({
      name: "Storage bucket 'renders'",
      ok: has,
      detail: has ? "Exists (public)" : "Bucket not found",
      fix: has
        ? undefined
        : "Run the storage section of 0001_init.sql, or create a public bucket named 'renders' in Supabase → Storage",
    });
  } catch (e: any) {
    checks.push({
      name: "Storage bucket 'renders'",
      ok: false,
      detail: e?.message || String(e),
    });
  }

  // 4. Rendering engine
  const onVercel = !!process.env.VERCEL;
  if (onVercel) {
    checks.push({
      name: "Renderer (serverless Chromium)",
      ok: true,
      detail: "Running on Vercel — @sparticuz/chromium is used automatically",
    });
  } else {
    const p = process.env.LOCAL_CHROME_PATH;
    const ok = !!p && existsSync(p);
    checks.push({
      name: "Renderer (local Chrome)",
      ok,
      detail: !p
        ? "LOCAL_CHROME_PATH not set"
        : ok
          ? `Chrome found at ${p}`
          : `No file at ${p}`,
      fix: ok
        ? undefined
        : "Set LOCAL_CHROME_PATH in .env.local to your Chrome executable (or install Chrome), then restart the dev server",
    });
  }

  return checks;
}
