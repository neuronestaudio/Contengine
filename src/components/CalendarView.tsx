"use client";

import { useState } from "react";

export interface CalEvent {
  id: string;
  when: string; // ISO instant
  status: string;
  label: string;
  caption: string;
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * All date math runs in the browser's timezone. Doing it server-side (now UTC
 * on Vercel) while the user is in Sydney bucketed month-boundary posts into a
 * different day than the client did, which caused a hydration mismatch and
 * crashed the page around August. Month navigation is local state, so it is
 * also instant — no server round-trip per month.
 */
export default function CalendarView({ events }: { events: CalEvent[] }) {
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() }); // m: 0-11

  const { y, m } = view;
  const first = new Date(y, m, 1);
  const monthName = first.toLocaleString("en", { month: "long", year: "numeric" });

  const byDay = new Map<number, CalEvent[]>();
  for (const e of events) {
    const d = new Date(e.when);
    if (Number.isNaN(d.getTime())) continue;
    if (d.getFullYear() !== y || d.getMonth() !== m) continue;
    byDay.set(d.getDate(), [...(byDay.get(d.getDate()) || []), e]);
  }

  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: number[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(0);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(0);

  const step = (delta: number) => {
    const d = new Date(y, m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  const isToday = (day: number) =>
    day === today.getDate() && m === today.getMonth() && y === today.getFullYear();

  return (
    <>
      <div className="row" style={{ marginBottom: 16 }}>
        <button className="secondary" onClick={() => step(-1)}>
          ← Prev
        </button>
        <strong style={{ fontSize: 16 }}>{monthName}</strong>
        <button className="secondary" onClick={() => step(1)}>
          Next →
        </button>
        <button className="secondary" onClick={() => setView({ y: today.getFullYear(), m: today.getMonth() })}>
          Today
        </button>
      </div>

      <div className="calendar">
        {DOW.map((d) => (
          <div key={d} className="dow">
            {d}
          </div>
        ))}
        {cells.map((day, i) => (
          <div key={i} className={`day${day === 0 ? " other" : ""}`}>
            {day > 0 && (
              <>
                <div className="num" style={isToday(day) ? { color: "var(--accent)", fontWeight: 700 } : undefined}>
                  {day}
                </div>
                {(byDay.get(day) || []).map((e) => {
                  const t = new Date(e.when);
                  const cls =
                    e.status === "published" ? " published" : e.status === "failed" ? " failed" : "";
                  return (
                    <div
                      key={e.id}
                      className={`event${cls}`}
                      title={`${e.label} — ${e.caption.slice(0, 120)}`}
                    >
                      {t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {e.label}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
