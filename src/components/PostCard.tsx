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

export default function PostCard({ post }: { post: Post & { clients?: { name: string } } }) {
  const router = useRouter();
  const [caption, setCaption] = useState(post.caption);
  const [platforms, setPlatforms] = useState<Platform[]>(post.platforms || []);
  const [when, setWhen] = useState<string>(
    post.scheduled_at ? post.scheduled_at.slice(0, 16) : ""
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

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
            <input
              type="datetime-local"
              style={{ width: 200 }}
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
            <button
              onClick={() =>
                run("schedule", () =>
                  callTool(status === "scheduled" ? "reschedule_post" : "schedule_post", {
                    post_id: post.id,
                    scheduled_at: new Date(when).toISOString(),
                    platforms,
                  })
                )
              }
              disabled={!!busy || !when}
            >
              {busy === "schedule" ? "Scheduling…" : status === "scheduled" ? "Reschedule" : "Schedule"}
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
