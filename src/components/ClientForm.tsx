"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Client, Platform } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EMPTY: Partial<Client> = {
  name: "",
  fb_page_id: "",
  fb_page_access_token: "",
  ig_user_id: "",
  preferred_days: [1, 3, 5],
  preferred_times: ["09:00"],
  weekly_frequency: 3,
  timezone: "Australia/Sydney",
  default_platforms: ["facebook", "instagram"],
  brand_instructions: "",
  pillar_rotation: [],
};

export default function ClientForm({ client }: { client?: Client }) {
  const router = useRouter();
  const [c, setC] = useState<Partial<Client>>(client ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = (k: keyof Client, v: unknown) => setC((prev) => ({ ...prev, [k]: v }));

  const toggleDay = (d: number) => {
    const days = c.preferred_days || [];
    set("preferred_days", days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort());
  };

  const togglePlatform = (p: Platform) => {
    const ps = (c.default_platforms || []) as Platform[];
    set("default_platforms", ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p]);
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/tools/upsert_client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Save failed");
      setMsg("Saved.");
      if (!client) setC(EMPTY);
      router.refresh();
    } catch (e: any) {
      setMsg(`Error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <strong>{client ? client.name : "New client"}</strong>

      <label>Client name</label>
      <input value={c.name || ""} onChange={(e) => set("name", e.target.value)} />

      <div className="row">
        <div style={{ flex: 1 }}>
          <label>Facebook Page ID</label>
          {/* Meta IDs are digits only. Strip anything else on input so a stray
              paste (e.g. "asd17841…") can't corrupt the ID and silently fail
              every publish. */}
          <input
            inputMode="numeric"
            value={c.fb_page_id || ""}
            onChange={(e) => set("fb_page_id", e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label>Instagram user ID</label>
          <input
            inputMode="numeric"
            value={c.ig_user_id || ""}
            onChange={(e) => set("ig_user_id", e.target.value.replace(/\D/g, ""))}
          />
        </div>
      </div>
      {(() => {
        const ig = c.ig_user_id || "";
        const fb = c.fb_page_id || "";
        const warn: string[] = [];
        if (ig && ig.length < 15) warn.push(`Instagram ID looks short (${ig.length} digits; expect ~17)`);
        if (fb && fb.length < 10) warn.push(`Facebook Page ID looks short (${fb.length} digits)`);
        return warn.length ? <span className="error-text">⚠ {warn.join("; ")}</span> : null;
      })()}

      <label>Page access token (long-lived; used for both FB and IG)</label>
      <input
        type="password"
        value={c.fb_page_access_token || ""}
        onChange={(e) =>
          // strip whitespace/newlines and stray quotes that break the token
          set("fb_page_access_token", e.target.value.replace(/["'\s]/g, ""))
        }
      />
      {(() => {
        const t = c.fb_page_access_token || "";
        if (!t) return null;
        const problems: string[] = [];
        if (!t.startsWith("EA")) problems.push("doesn't start with EA… — is this the right value?");
        if (t.length < 100) problems.push(`only ${t.length} characters — likely truncated (expect 150+)`);
        if (t.includes("…") || t.includes("...")) problems.push("contains an ellipsis — partial copy");
        return problems.length ? (
          <span className="error-text">⚠ Token {problems.join("; ")}</span>
        ) : (
          <span className="muted" style={{ fontSize: 12 }}>
            ✓ Token format looks right ({t.length} characters)
          </span>
        );
      })()}

      <label>Preferred publishing days</label>
      <div className="day-row">
        {DAYS.map((d, i) => (
          <button
            key={d}
            type="button"
            className={`day-btn${(c.preferred_days || []).includes(i) ? " on" : ""}`}
            onClick={() => toggleDay(i)}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="row">
        <div style={{ flex: 2 }}>
          <label>Preferred times (24h HH:MM, comma-separated)</label>
          <input
            value={(c.preferred_times || []).join(", ")}
            onChange={(e) =>
              set(
                "preferred_times",
                e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
              )
            }
          />
        </div>
        <div style={{ flex: 1 }}>
          <label>Posts per week</label>
          <input
            type="number"
            min={1}
            max={21}
            value={c.weekly_frequency ?? 3}
            onChange={(e) => set("weekly_frequency", Number(e.target.value))}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label>Time zone (IANA)</label>
          <input value={c.timezone || ""} onChange={(e) => set("timezone", e.target.value)} />
        </div>
      </div>

      <label>Default platforms</label>
      <div className="checks">
        {(["facebook", "instagram"] as Platform[]).map((p) => (
          <label key={p}>
            <input
              type="checkbox"
              checked={((c.default_platforms || []) as Platform[]).includes(p)}
              onChange={() => togglePlatform(p)}
            />
            {p}
          </label>
        ))}
      </div>

      <label>Content pillar rotation (comma-separated, in order)</label>
      <input
        placeholder="education, social_proof, offer"
        value={(c.pillar_rotation || []).join(", ")}
        onChange={(e) =>
          set(
            "pillar_rotation",
            e.target.value
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          )
        }
      />

      <label>Brand instructions</label>
      <textarea
        value={c.brand_instructions || ""}
        onChange={(e) => set("brand_instructions", e.target.value)}
        placeholder="Tone of voice, hashtags, emoji policy, CTA preferences…"
      />

      <div className="row">
        <button onClick={save} disabled={busy || !c.name}>
          {busy ? "Saving…" : client ? "Save changes" : "Create client"}
        </button>
        {msg && <span className="muted">{msg}</span>}
      </div>
    </div>
  );
}
