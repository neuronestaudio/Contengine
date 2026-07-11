"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Post, Platform } from "@/lib/types";

async function callTool(name: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/tools/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || "Request failed");
  return json.result;
}

type CardPost = Post & {
  clients?: {
    name: string;
    timezone?: string;
    preferred_times?: string[];
    preferred_days?: number[];
  };
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Next occurrence of the client's preferred day + first preferred time. */
function defaultScheduleTime(post: CardPost): string {
  const times = post.clients?.preferred_times?.length ? post.clients.preferred_times : ["09:00"];
  const days = post.clients?.preferred_days ?? [];
  const [h, m] = (times[0] || "09:00").split(":").map(Number);
  const d = new Date();
  d.setHours(Number.isNaN(h) ? 9 : h, Number.isNaN(m) ? 0 : m, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  if (days.length) {
    let guard = 0;
    while (!days.includes(d.getDay()) && guard < 14) {
      d.setDate(d.getDate() + 1);
      guard++;
    }
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PostCard({ post }: { post: CardPost }) {
  const router = useRouter();
  const [caption, setCaption] = useState(post.caption);
  const [platforms, setPlatforms] = useState<Platform[]>(post.platforms || []);
  const [when, setWhen] = useState<string>(
    post.scheduled_at ? post.scheduled_at.slice(0, 16) : ""
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [schedOpen, setSchedOpen] = useState(false);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const togglePlatform = (p: Platform) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const saveCaption = () =>
    run("caption", () => callTool("update_caption", { post_id: post.id, caption }));

  const status = post.status;

  return (
    <div className="card">
      <div className="meta">
        <span className={`badge ${status}`}>{status.replace("_", " ")}</span>
        {post.clients?.name && <span className="muted">{post.clients.name}</span>}
        {post.category && <span className="muted">· {post.category}</span>}
        {post.scheduled_at && (
          <span className="muted">· {new Date(post.scheduled_at).toLocaleString()}</span>
        )}
      </div>

      <div className="slides">
        {post.rendered_media?.length ? (
          post.rendered_media.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.path} src={m.url} alt="slide" />
          ))
        ) : (
          <div className="slide-placeholder">
            {post.slides?.length || 0} slide{(post.slides?.length || 0) === 1 ? "" : "s"} — not
            rendered
          </div>
        )}
      </div>

      <div style={{ position: "relative" }}>
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} />
        <button
          className="secondary expand-btn"
          title="Open full-screen editor"
          onClick={() => setEditorOpen(true)}
        >
          ⤢ Expand
        </button>
      </div>
      {caption !== post.caption && (
        <button className="secondary" onClick={saveCaption} disabled={!!busy}>
          {busy === "caption" ? "Saving…" : "Save caption"}
        </button>
      )}

      {schedOpen && (
        <div className="modal-overlay" onClick={() => setSchedOpen(false)}>
          <div className="modal" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
            <strong>{status === "scheduled" ? "Reschedule post" : "Schedule post"}</strong>
            <span className="muted" style={{ fontSize: 12 }}>
              Pre-filled with {post.clients?.name || "the client"}&apos;s preferred posting time —
              adjust if needed.
            </span>
            <input
              type="datetime-local"
              autoFocus
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="secondary" onClick={() => setSchedOpen(false)}>
                Cancel
              </button>
              <button
                onClick={async () => {
                  setSchedOpen(false);
                  await run("schedule", () =>
                    callTool(status === "scheduled" ? "reschedule_post" : "schedule_post", {
                      post_id: post.id,
                      scheduled_at: new Date(when).toISOString(),
                      platforms,
                    })
                  );
                }}
                disabled={!!busy || !when}
              >
                OK — {status === "scheduled" ? "reschedule" : "schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editorOpen && (
        <div className="modal-overlay" onClick={() => setEditorOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>
                Edit caption {post.clients?.name ? `— ${post.clients.name}` : ""}
              </strong>
              <span className="muted">{caption.length} characters</span>
            </div>
            <textarea
              className="modal-textarea"
              autoFocus
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button
                className="secondary"
                onClick={() => {
                  setCaption(post.caption);
                  setEditorOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await saveCaption();
                  setEditorOpen(false);
                }}
                disabled={!!busy || caption === post.caption}
              >
                {busy === "caption" ? "Saving…" : "Save caption"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="checks">
        {(["facebook", "instagram"] as Platform[]).map((p) => (
          <label key={p}>
            <input
              type="checkbox"
              checked={platforms.includes(p)}
              onChange={() => togglePlatform(p)}
            />
            {p === "facebook" ? "Facebook" : "Instagram"}
          </label>
        ))}
      </div>

      <div className="row">
        {(status === "ready" || status === "draft") && (
          <button
            onClick={() => run("render", () => callTool("render_post", { post_id: post.id }))}
            disabled={!!busy}
          >
            {busy === "render" ? "Rendering…" : "Render slides"}
          </button>
        )}

        {(status === "ready" || status === "awaiting_approval") && (
          <button
            className="success"
            onClick={() =>
              run("approve", () => callTool("approve_post", { post_id: post.id, platforms }))
            }
            disabled={!!busy || !post.rendered_media?.length}
            title={!post.rendered_media?.length ? "Render first" : undefined}
          >
            {busy === "approve" ? "Approving…" : "Approve"}
          </button>
        )}

        {(status === "approved" || status === "scheduled") && (
          <>
            <button
              onClick={() => {
                if (!when) setWhen(defaultScheduleTime(post));
                setSchedOpen(true);
              }}
              disabled={!!busy}
            >
              📅 {status === "scheduled" ? "Reschedule…" : "Schedule…"}
            </button>
            <button
              className="secondary"
              onClick={() =>
                run("slot", () => callTool("schedule_next_available_slot", { post_id: post.id }))
              }
              disabled={!!busy}
            >
              {busy === "slot" ? "Finding slot…" : "Next available slot"}
            </button>
          </>
        )}

        {status === "scheduled" && (
          <button
            className="success"
            onClick={() => {
              if (!confirm("Publish this post to the selected platforms right now?")) return;
              run("publish", () => callTool("publish_post", { post_id: post.id }));
            }}
            disabled={!!busy}
          >
            {busy === "publish" ? "Publishing…" : "Publish now"}
          </button>
        )}

        {status === "failed" && (
          <button
            className="danger"
            onClick={() => run("retry", () => callTool("retry_failed_post", { post_id: post.id }))}
            disabled={!!busy}
          >
            {busy === "retry" ? "Retrying…" : `Retry (${post.retry_count}/5)`}
          </button>
        )}

        {status !== "publishing" && (
          <button
            className="secondary"
            style={{ marginLeft: "auto" }}
            title={status === "published" ? "Removes the record only — the live post stays on FB/IG" : "Delete this post"}
            onClick={() => {
              if (
                !confirm(
                  status === "published"
                    ? "Delete this record? The live post on Facebook/Instagram will NOT be removed."
                    : "Delete this post and its rendered images?"
                )
              )
                return;
              run("delete", () => callTool("delete_post", { post_id: post.id }));
            }}
            disabled={!!busy}
          >
            {busy === "delete" ? "Deleting…" : "🗑 Delete"}
          </button>
        )}
      </div>

      {post.status === "published" && (
        <div className="row">
          {Object.entries(post.platform_results || {}).map(([p, r]) =>
            r?.url ? (
              <a key={p} href={r.url} target="_blank" rel="noreferrer">
                View on {p} ↗
              </a>
            ) : null
          )}
        </div>
      )}

      {(error || post.error_message) && (
        <div className="error-text">{error || post.error_message}</div>
      )}
    </div>
  );
}
