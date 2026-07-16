"use client";

import { useEffect, useState } from "react";

const STEPS = [
  {
    n: 1,
    title: "Add your client once",
    body: (
      <>
        Go to <strong>Client Settings</strong> and add the Facebook Page ID, Instagram user ID and
        Page access token. Set the posting days and times you want — that&apos;s what auto-schedule
        uses later. You only do this once per client.
      </>
    ),
  },
  {
    n: 2,
    title: "Drop in your HTML",
    body: (
      <>
        Go to <strong>Import Posts</strong>, pick the client, and drag in your HTML file. Every
        slide becomes a 1080×1350 image. Tick <em>facebook</em> / <em>instagram</em> and
        <em> Render immediately</em> to see the pictures right away.
      </>
    ),
  },
  {
    n: 3,
    title: "Check it and approve",
    body: (
      <>
        The post lands in <strong>Awaiting Approval</strong>. Read the caption, fix anything you
        don&apos;t like, then hit approve. <strong>Nothing can go out until you approve it</strong> —
        that&apos;s a hard rule in the code, not a setting.
      </>
    ),
  },
  {
    n: 4,
    title: "Give it a time",
    body: (
      <>
        In <strong>Scheduled Content</strong>, either pick a date and time yourself or use
        auto-schedule to drop it into the client&apos;s next free slot. Check the{" "}
        <strong>Calendar</strong> to see everything laid out.
      </>
    ),
  },
  {
    n: 5,
    title: "It posts itself",
    body: (
      <>
        A scheduler pings the app every 5 minutes and publishes anything that is approved and due.
        It moves to <strong>Published Content</strong> with a link. Anything that breaks lands in{" "}
        <strong>Failed Posts</strong> with the reason, and you can retry it.
      </>
    ),
  },
];

export default function HelpModal() {
  const [open, setOpen] = useState(false);

  // Escape to close — matches the caption modal's behaviour.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button className="help-trigger" onClick={() => setOpen(true)}>
        ? &nbsp;How to use
      </button>

      {open ? (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-head">
              <div>
                <h2 className="help-title">How to use Contengine</h2>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  HTML in, scheduled Facebook and Instagram posts out.
                </p>
              </div>
              <button className="secondary" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <div className="help-body">
              {STEPS.map((s) => (
                <div className="help-step" key={s.n}>
                  <div className="help-num">{s.n}</div>
                  <div>
                    <div className="help-step-title">{s.title}</div>
                    <p className="help-step-body">{s.body}</p>
                  </div>
                </div>
              ))}

              <div className="help-note">
                <div className="help-note-title">What your HTML should look like</div>
                <p className="help-step-body">
                  Two carousel layouts are detected automatically. A{" "}
                  <strong>multi-carousel sheet</strong> — several <code>.frame</code> blocks, each
                  holding <code>.slide</code> images — becomes one post per frame, taking its title
                  from <code>.set-label</code> and caption from a nearby <code>.caption</code>. A{" "}
                  <strong>single-deck file</strong> — one carousel viewer with a run of{" "}
                  <code>.slide</code> panels shown one at a time — becomes one post with all those
                  slides. Drop in a plain HTML file with neither and you get a single one-image post.
                </p>
                <p className="help-step-body">
                  Slides are designed at <strong>640px wide, 4:5</strong> and scaled up to
                  1080×1350. If your design uses a different width, change{" "}
                  <em>Design width</em> on the import page to match. Put fonts and images inline or
                  on a public URL — the renderer opens the file on its own, so anything loaded from
                  your computer won&apos;t show up.
                </p>
              </div>

              <div className="help-note">
                <div className="help-note-title">Posting from somewhere else</div>
                <p className="help-step-body">
                  You don&apos;t have to use this dashboard. Anything that can send an HTTP request
                  can push a post in — send it to <code>/api/ingest</code> with your API key in an{" "}
                  <code>x-api-key</code> header:
                </p>
                <pre className="help-code">{`POST /api/ingest
x-api-key: <your TOOLS_API_KEY>

{
  "client_id": "...",
  "caption": "Your caption",
  "platforms": ["facebook", "instagram"],
  "slides": [{ "html": "<!doctype html>..." }],
  "render_now": true
}`}</pre>
                <p className="help-step-body">
                  It arrives exactly like a drag-and-drop import — and still needs your approval
                  before it can publish.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
