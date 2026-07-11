import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Server-side only — never import from client components.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars (URL / SERVICE_ROLE_KEY)");
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      // CRITICAL: opt out of Next.js fetch caching. Without this, Next caches
      // Supabase REST responses in its Data Cache and pages serve stale data
      // (e.g. "no clients") forever — even across server restarts.
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
