"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Client, Platform } from "@/lib/types";

const W = 1080;
const H = 1350;
const PREVIEW_SCALE = 0.2;

interface ExtractedPost {
  title: string;
  caption: string;
  slides: string[]; // standalone HTML docs, each renders to exactly 1080x1350
  sourceInfo: string; // file name + last-modified, to catch stale-file mistakes
}

/**
 * Wrap one slide element as a standalone 1080x1350 document.
 * The slide is laid out at its design width (e.g. 640px wide, 4:5), then
 * scaled up to fill 1080x1350 — so it renders exactly like the preview page.
 */
function wrapSlide(
  head: string,
  slideHtml: string,
  designW: number,
  sharedAssets = ""
): string {
  const designH = designW * 1.25; // 4:5
  const scale = W / designW;
  return `<!doctype html><html><head>${head}<style>
html,body{margin:0!important;padding:0!important;width:${W}px;height:${H}px;overflow:hidden;background:#0d0c0b;}
#__stage{width:${designW}px;height:${designH}px;transform:scale(${scale});transform-origin:top left;position:relative;}
#__stage .frame{width:100%;height:100%;max-width:none;aspect-ratio:auto;border:0!important;border-radius:0!important;}
#__stage .slide{display:flex!important;}
/* Photo treatment: keep text-protection at the bottom but let colour through.
   Overrides the template's heavy desaturation/darkening. */
#__stage .hero-img{filter:saturate(.95) brightness(.8) contrast(1.05)!important;}
#__stage .slide.photo .hero::after{background:linear-gradient(180deg,rgba(10,10,12,.25) 0%,rgba(10,10,12,.18) 16%,rgba(10,10,12,.5) 48%,rgba(10,10,12,.9) 80%,#0a0a0c 100%)!important;}
</style></head><body>${sharedAssets}<div id="__stage"><div class="frame">${slideHtml}</div></div></body></html>`;
}

/**
 * Extract posts from an HTML file.
 * Preview-page format (like ALVOLUTION carousels): each .frame = one carousel
 * post, its .slide children = the images, sibling .caption = suggested
 * caption, .set-label = title. Falls back to treating the whole file as a
 * single one-slide post.
 */
function extractPosts(
  fileName: string,
  raw: string,
  designW: number
): Omit<ExtractedPost, "sourceInfo">[] {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(raw, "text/html");
  } catch {
    return [{ title: fileName, caption: "", slides: [raw] }];
  }
  // Scripts are never needed in a static 1080x1350 render and can hang the
  // renderer (e.g. editor-injected blob: scripts) — strip them everywhere.
  doc.querySelectorAll("script").forEach((s) => s.remove());

  // Carry EVERY stylesheet in the document, in document order — WYSIWYG
  // editors append updated styles at the END OF THE BODY, not the head.
  // Only taking head styles is how gradients/typography silently go missing.
  const head =
    `<meta charset="utf-8">` +
    Array.from(doc.querySelectorAll("style, link[rel='stylesheet']"))
      .map((el) => el.outerHTML)
      .join("");

  // Shared SVG asset blocks (gradients/filters/symbols defined once at page
  // level and referenced by every slide via url(#id) / <use href="#id">).
  // These MUST travel with each extracted slide or gradients render black.
  const sharedAssets = Array.from(doc.querySelectorAll("svg"))
    .filter((s) => s.querySelector("defs, symbol") && !s.closest(".frame"))
    .map((s) => s.outerHTML)
    .join("");

  const frames = Array.from(doc.querySelectorAll(".frame"));

  if (frames.length && doc.querySelector(".frame .slide")) {
    return frames.map((frame, fi) => {
      const set = frame.closest(".set") || frame.parentElement;
      const label =
        set?.querySelector(".set-label")?.textContent?.trim() ||
        set?.querySelector(".set-title")?.textContent?.trim() ||
        `${fileName} · post ${fi + 1}`;
      const caption = set?.querySelector(".caption p")?.textContent?.trim() ?? "";
      const slides = Array.from(frame.querySelectorAll(".slide")).map((el) =>
        wrapSlide(head, el.outerHTML, designW, sharedAssets)
      );
      return { title: label, caption, slides };
    });
  }

  // Generic multi-slide file (elements marked as slides at top level).
  const generic = Array.from(doc.querySelectorAll("[data-slide], .artboard"));
  if (generic.length > 1) {
    return [
      {
        title: fileName,
        caption: "",
        slides: generic.map((el) => wrapSlide(head, el.outerHTML, designW, sharedAssets)),
      },
    ];
  }

  // Single self-contained slide designed at 1080x1350 — use as-is.
  return [{ title: fileName, caption: "", slides: [raw] }];
}

function SlidePreview({ html }: { html: string }) {
  // Blob URL instead of srcDoc: handles multi-MB documents (embedded photos)
  // and avoids SVG url(#id) resolution quirks inside srcdoc iframes.
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [html]);

  return (
    <div
      style={{
        width: W * PREVIEW_SCALE,
        height: H * PREVIEW_SCALE,
        overflow: "hidden",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "#000",
        flexShrink: 0,
      }}
    >
      {url && (
        <iframe
          title="slide preview"
          src={url}
          style={{
            width: W,
            height: H,
            border: 0,
            transform: `scale(${PREVIEW_SCALE})`,
            transformOrigin: "top left",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

const LAST_CLIENT_KEY = "contengine:lastClientId";

export default function ImportForm({ clients }: { clients: Pick<Client, "id" | "name">[] }) {
  const router = useRouter();
  // Clients come back ordered by name, so whoever sorts first would otherwise
  // be the default on every import. Start there, then restore the last client
  // this browser actually used.
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");

  useEffect(() => {
    const saved = window.localStorage.getItem(LAST_CLIENT_KEY);
    // Ignore a saved id whose client has since been deleted.
    if (saved && clients.some((c) => c.id === saved)) setClientId(saved);
  }, [clients]);

  const chooseClient = (id: string) => {
    setClientId(id);
    window.localStorage.setItem(LAST_CLIENT_KEY, id);
  };
  const [category, setCategory] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>(["facebook", "instagram"]);
  const [renderNow, setRenderNow] = useState(true);
  const [designW, setDesignW] = useState(640);
  const [posts, setPosts] = useState<ExtractedPost[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const onFiles = async (list: FileList | null, width = designW) => {
    const files = Array.from(list || []);
    const all: ExtractedPost[] = [];
    for (const f of files) {
      const info = `${f.name} · saved ${new Date(f.lastModified).toLocaleString()}`;
      all.push(
        ...extractPosts(f.name, await f.text(), width).map((p) => ({ ...p, sourceInfo: info }))
      );
    }
    setPosts(all);
    setMsg(null);
  };

  const togglePlatform = (p: Platform) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const setPost = (i: number, patch: Partial<ExtractedPost>) =>
    setPosts((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const removePost = (i: number) => setPosts((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const renderErrors: string[] = [];
      for (const p of posts) {
        const res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            title: p.title,
            caption: p.caption,
            category: category || undefined,
            platforms,
            slides: p.slides.map((html) => ({ html })),
            render_now: renderNow,
            source: "import_page",
          }),
        });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(`${p.title}: ${json.error || "import failed"}`);
        if (json.render_error) renderErrors.push(json.render_error);
      }
      setMsg(
        renderErrors.length
          ? `Imported ${posts.length} post(s), but rendering failed: ${renderErrors[0]} — posts are saved in Ready Content; fix the issue (see System Health) and hit Render there.`
          : `Imported ${posts.length} post${posts.length === 1 ? "" : "s"}${renderNow ? " — rendering now, check Awaiting Approval in a minute" : " — see Ready Content"}.`
      );
      setPosts([]);
      router.refresh();
    } catch (e: any) {
      setMsg(`Error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  if (!clients.length) {
    return (
      <div className="card" style={{ maxWidth: 640 }}>
        <strong>No clients yet</strong>
        <p className="muted">
          Posts belong to a client. Create one in <a href="/clients">Client Settings</a> (just a
          name is enough to start), then come back here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="card">
        <div className="row">
          <div style={{ flex: 2 }}>
            <label>Client</label>
            <select value={clientId} onChange={(e) => chooseClient(e.target.value)}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Category / pillar</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="education" />
          </div>
          <div style={{ flex: 1 }}>
            <label>Design width (px)</label>
            <input
              type="number"
              value={designW}
              onChange={(e) => setDesignW(Number(e.target.value) || 640)}
            />
          </div>
        </div>

        <label>
          HTML file(s) — carousel preview pages are detected automatically (each frame becomes one
          post, captions extracted)
        </label>
        <div
          className={`dropzone${dragging ? " drag" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFiles(e.dataTransfer.files);
          }}
          onClick={() => document.getElementById("html-file-input")?.click()}
        >
          <strong>Drag &amp; drop your HTML file(s) here</strong>
          <span className="muted">or click to browse</span>
        </div>
        <input
          id="html-file-input"
          type="file"
          accept=".html,.htm"
          multiple
          style={{ display: "none" }}
          onChange={async (e) => {
            const el = e.currentTarget;
            await onFiles(el.files);
            // Reset so re-selecting the SAME file re-reads it from disk.
            // Without this, browsers skip the change event and you get stale content.
            el.value = "";
          }}
        />

        <div className="checks">
          {(["facebook", "instagram"] as Platform[]).map((p) => (
            <label key={p}>
              <input type="checkbox" checked={platforms.includes(p)} onChange={() => togglePlatform(p)} />
              {p}
            </label>
          ))}
          <label>
            <input type="checkbox" checked={renderNow} onChange={() => setRenderNow(!renderNow)} />
            Render immediately
          </label>
        </div>
      </div>

      {posts.map((p, i) => (
        <div className="card" key={i} style={{ marginTop: 16 }}>
          <div className="meta">
            <span className="badge">post {i + 1}</span>
            <span className="muted">
              {p.slides.length} slide{p.slides.length === 1 ? "" : "s"} · {p.sourceInfo}
            </span>
            <button
              className="secondary"
              style={{ marginLeft: "auto" }}
              onClick={() => removePost(i)}
            >
              Remove
            </button>
          </div>

          <div className="slides" style={{ paddingBottom: 6 }}>
            {p.slides.map((s, si) => (
              <SlidePreview key={si} html={s} />
            ))}
          </div>

          <label>Title (internal)</label>
          <input value={p.title} onChange={(e) => setPost(i, { title: e.target.value })} />

          <label>Caption {p.caption ? "(extracted from the file — edit freely)" : ""}</label>
          <textarea value={p.caption} onChange={(e) => setPost(i, { caption: e.target.value })} />
        </div>
      ))}

      {posts.length > 0 && (
        <div className="row" style={{ marginTop: 16 }}>
          <button onClick={submit} disabled={busy || !clientId}>
            {busy
              ? "Importing…"
              : `Import ${posts.length} post${posts.length === 1 ? "" : "s"}`}
          </button>
          {msg && <span className="muted">{msg}</span>}
        </div>
      )}
      {posts.length === 0 && msg && <p className="muted" style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
