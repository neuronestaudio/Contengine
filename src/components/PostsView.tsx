"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PostCard from "./PostCard";
import type { Post } from "@/lib/types";

export interface BulkAction {
  label: string;
  tool: string; // tool name, called as POST /api/tools/<tool> { post_id }
  className?: string;
  confirm?: string;
}

async function callTool(tool: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/tools/${tool}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || "Request failed");
  return json.result;
}

export default function PostsView({
  posts,
  actions = [],
  emptyText,
  storageKey = "contengine-view",
}: {
  posts: (Post & { clients?: { name: string } })[];
  actions?: BulkAction[];
  emptyText: string;
  storageKey?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"cards" | "list">("cards");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved === "list" || saved === "cards") setMode(saved);
  }, [storageKey]);

  const switchMode = (m: "cards" | "list") => {
    setMode(m);
    localStorage.setItem(storageKey, m);
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allSelected = posts.length > 0 && selected.size === posts.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(posts.map((p) => p.id)));

  const runBulk = async (action: BulkAction) => {
    const ids = posts.filter((p) => selected.has(p.id)).map((p) => p.id);
    if (!ids.length) return;
    if (action.confirm && !confirm(`${action.confirm} (${ids.length} post${ids.length === 1 ? "" : "s"})`))
      return;

    setErrors([]);
    const errs: string[] = [];
    // Sequential on purpose: scheduling must see each prior booking, and
    // rendering/publishing shouldn't stampede the server.
    for (let i = 0; i < ids.length; i++) {
      setProgress(`${action.label}: ${i + 1}/${ids.length}…`);
      try {
        await callTool(action.tool, { post_id: ids[i] });
      } catch (e: any) {
        errs.push(e?.message || String(e));
      }
    }
    setProgress(null);
    setErrors(errs);
    setSelected(new Set());
    router.refresh();
  };

  if (!posts.length) return <div className="empty">{emptyText}</div>;

  return (
    <div>
      <div className="toolbar">
        <div className="row">
          <button
            className={mode === "cards" ? "" : "secondary"}
            onClick={() => switchMode("cards")}
          >
            ▦ Cards
          </button>
          <button
            className={mode === "list" ? "" : "secondary"}
            onClick={() => switchMode("list")}
          >
            ☰ List
          </button>
        </div>

        {actions.length > 0 && (
          <div className="row">
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              <span className="muted">
                {selected.size ? `${selected.size} selected` : "Select all"}
              </span>
            </label>
            {actions.map((a) => (
              <button
                key={a.tool + a.label}
                className={a.className || ""}
                disabled={!selected.size || !!progress}
                onClick={() => runBulk(a)}
              >
                {a.label}
              </button>
            ))}
            {progress && <span className="muted">{progress}</span>}
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div className="error-text" style={{ marginBottom: 12 }}>
          {errors.length} failed: {errors[0]}
          {errors.length > 1 ? ` (+${errors.length - 1} more)` : ""}
        </div>
      )}

      {mode === "cards" ? (
        <div className="grid">
          {posts.map((p) => (
            <div key={p.id} style={{ position: "relative" }}>
              {actions.length > 0 && (
                <input
                  type="checkbox"
                  className="card-check"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
              )}
              <PostCard post={p} />
            </div>
          ))}
        </div>
      ) : (
        <table className="list-table">
          <thead>
            <tr>
              {actions.length > 0 && <th style={{ width: 30 }}></th>}
              <th style={{ width: 64 }}>Media</th>
              <th>Post</th>
              <th>Client</th>
              <th>Status</th>
              <th>Scheduled</th>
              <th>Platforms</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr
                key={p.id}
                className={selected.has(p.id) ? "row-selected" : ""}
                onClick={() => actions.length && toggle(p.id)}
              >
                {actions.length > 0 && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                  </td>
                )}
                <td>
                  {p.rendered_media?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="list-thumb" src={p.rendered_media[0].url} alt="" />
                  ) : (
                    <span className="muted">{p.slides?.length || 0} slides</span>
                  )}
                </td>
                <td>
                  <strong>{p.title || p.category || "Untitled"}</strong>
                  <div className="muted list-caption">{(p.caption || "").slice(0, 90)}</div>
                </td>
                <td>{p.clients?.name || "—"}</td>
                <td>
                  <span className={`badge ${p.status}`}>{p.status.replace("_", " ")}</span>
                  {p.error_message && (
                    <div className="error-text" style={{ fontSize: 11, maxWidth: 220 }}>
                      {p.error_message.slice(0, 80)}
                    </div>
                  )}
                </td>
                <td className="muted">
                  {p.scheduled_at ? new Date(p.scheduled_at).toLocaleString() : "—"}
                </td>
                <td className="muted">{(p.platforms || []).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
