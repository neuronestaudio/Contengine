"use client";

import { useEffect, useMemo, useState } from "react";
import type { Post } from "@/lib/types";

type CardPost = Post & {
  clients?: { name?: string; timezone?: string; preferred_times?: string[]; preferred_days?: number[] };
};

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** A booking to show on the calendar (other posts already on the board). */
interface Booking {
  key: string; // YYYY-MM-DD
  time: string; // HH:mm
  label: string;
  status: string;
}

async function fetchBookings(excludeId: string): Promise<Booking[]> {
  const call = async (status: string) => {
    const res = await fetch(`/api/tools/list_posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, limit: 500 }),
    });
    const json = await res.json();
    return (json.result || []) as CardPost[];
  };
  // Scheduled = what's coming up; published = what already went out. Both are
  // useful context when choosing a day.
  const [scheduled, published] = await Promise.all([call("scheduled"), call("published")]);
  return [...scheduled, ...published]
    .filter((p) => p.id !== excludeId)
    .map((p) => {
      const t = p.scheduled_at || p.published_at;
      if (!t) return null;
      const d = new Date(t);
      return {
        key: dayKey(d),
        time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        label: p.clients?.name || p.title || p.category || "post",
        status: p.status,
      };
    })
    .filter(Boolean) as Booking[];
}

export default function ScheduleModal({
  post,
  initialWhen,
  onClose,
  onConfirm,
  busy,
}: {
  post: CardPost;
  initialWhen: string; // "YYYY-MM-DDTHH:mm" (local), preferred time already filled in
  onClose: () => void;
  onConfirm: (whenLocal: string) => void;
  busy: boolean;
}) {
  const [when, setWhen] = useState(initialWhen);
  const [view, setView] = useState(() => {
    const d = initialWhen ? new Date(initialWhen) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    fetchBookings(post.id)
      .then((b) => live && setBookings(b))
      .catch(() => live && setBookings([]))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [post.id]);

  const datePart = when.slice(0, 10);
  const timePart = when.slice(11, 16) || "09:00";
  const isReschedule = post.status === "scheduled";

  const byDay = useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const b of bookings) m.set(b.key, [...(m.get(b.key) || []), b]);
    for (const arr of m.values()) arr.sort((a, b) => a.time.localeCompare(b.time));
    return m;
  }, [bookings]);

  // Monday-first grid for the viewed month.
  const y = view.getFullYear();
  const mo = view.getMonth();
  const startOffset = (new Date(y, mo, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = dayKey(new Date());
  const selectedBookings = byDay.get(datePart) || [];

  const pickDay = (day: number) => {
    const k = dayKey(new Date(y, mo, day));
    setWhen(`${k}T${timePart}`);
  };

  const monthName = view.toLocaleString("en", { month: "long", year: "numeric" });
  const prettyDate = datePart
    ? new Date(`${datePart}T00:00`).toLocaleDateString("en", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "—";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal sched-modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <strong>{isReschedule ? "Reschedule post" : "Schedule post"}</strong>
          <span className="muted" style={{ fontSize: 12 }}>
            {post.clients?.name || "client"}
          </span>
        </div>

        <div className="sched-cal-head">
          <button className="secondary" onClick={() => setView(new Date(y, mo - 1, 1))}>
            ←
          </button>
          <strong>{monthName}</strong>
          <button className="secondary" onClick={() => setView(new Date(y, mo + 1, 1))}>
            →
          </button>
        </div>

        <div className="sched-cal">
          {DOW.map((d) => (
            <div key={d} className="sched-dow">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={i} className="sched-cell empty" />;
            const k = dayKey(new Date(y, mo, day));
            const dayBookings = byDay.get(k) || [];
            const isPast = k < todayKey;
            const isSelected = k === datePart;
            const isToday = k === todayKey;
            return (
              <button
                key={i}
                type="button"
                className={`sched-cell${isSelected ? " selected" : ""}${isPast ? " past" : ""}${
                  isToday ? " today" : ""
                }`}
                disabled={isPast}
                onClick={() => pickDay(day)}
                title={
                  dayBookings.length
                    ? dayBookings.map((b) => `${b.time} ${b.label}`).join("\n")
                    : "Nothing scheduled"
                }
              >
                <span className="sched-num">{day}</span>
                {dayBookings.length > 0 && (
                  <span className="sched-dots">
                    {dayBookings.slice(0, 4).map((b, j) => (
                      <span key={j} className={`sched-dot ${b.status}`} />
                    ))}
                    {dayBookings.length > 4 && <span className="sched-more">+</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="sched-detail">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <strong>{prettyDate}</strong>
            <label className="sched-time">
              <span className="muted">Time</span>
              <input
                type="time"
                value={timePart}
                onChange={(e) => setWhen(`${datePart}T${e.target.value || "09:00"}`)}
              />
            </label>
          </div>
          <div className="sched-onday">
            {loading ? (
              <span className="muted">Loading what&apos;s booked…</span>
            ) : selectedBookings.length ? (
              selectedBookings.map((b, i) => (
                <span key={i} className="sched-chip">
                  <span className={`sched-dot ${b.status}`} /> {b.time} · {b.label}
                </span>
              ))
            ) : (
              <span className="muted">Nothing else on this day.</span>
            )}
          </div>
          <span className="muted" style={{ fontSize: 11 }}>
            Time is pre-filled with {post.clients?.name || "the client"}&apos;s preferred time —
            change it only if you need to.
          </span>
        </div>

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button onClick={() => onConfirm(when)} disabled={busy || !datePart}>
            {isReschedule ? "Reschedule" : "Schedule"} for {prettyDate.split(",")[0]} · {timePart}
          </button>
        </div>
      </div>
    </div>
  );
}
