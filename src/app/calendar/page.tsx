import Link from "next/link";
import Shell from "@/components/Shell";
import { list_posts } from "@/lib/tools";
import type { Post } from "@/lib/types";

export const dynamic = "force-dynamic";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const now = new Date();
  const [y, m] = (searchParams.m || monthKey(now)).split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const prev = new Date(y, m - 2, 1);
  const next = new Date(y, m, 1);

  const all = (
    await Promise.all([
      list_posts({ status: "scheduled", limit: 500 }),
      list_posts({ status: "publishing", limit: 500 }),
      list_posts({ status: "published", limit: 500 }),
      list_posts({ status: "failed", limit: 500 }),
    ])
  ).flat();

  const byDay = new Map<string, Post[]>();
  for (const p of all) {
    const t = p.scheduled_at || p.published_at;
    if (!t) continue;
    const d = new Date(t);
    if (d.getFullYear() !== y || d.getMonth() !== m - 1) continue;
    const key = String(d.getDate());
    byDay.set(key, [...(byDay.get(key) || []), p]);
  }

  // Build a Monday-first grid.
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: { day: number; other: boolean }[] = [];
  for (let i = 0; i < startOffset; i++) cells.push({ day: 0, other: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, other: false });
  while (cells.length % 7 !== 0) cells.push({ day: 0, other: true });

  const monthName = first.toLocaleString("en", { month: "long", year: "numeric" });

  return (
    <Shell title="Calendar" subtitle="All scheduled and published posts by date (your local time).">
      <div className="row" style={{ marginBottom: 16 }}>
        <Link href={`/calendar?m=${monthKey(prev)}`}>
          <button className="secondary">← Prev</button>
        </Link>
        <strong style={{ fontSize: 16 }}>{monthName}</strong>
        <Link href={`/calendar?m=${monthKey(next)}`}>
          <button className="secondary">Next →</button>
        </Link>
      </div>

      <div className="calendar">
        {DOW.map((d) => (
          <div key={d} className="dow">
            {d}
          </div>
        ))}
        {cells.map((c, i) => (
          <div key={i} className={`day${c.other ? " other" : ""}`}>
            {c.day > 0 && (
              <>
                <div className="num">{c.day}</div>
                {(byDay.get(String(c.day)) || []).map((p) => {
                  const t = new Date(p.scheduled_at || p.published_at!);
                  const cls =
                    p.status === "published" ? " published" : p.status === "failed" ? " failed" : "";
                  return (
                    <div
                      key={p.id}
                      className={`event${cls}`}
                      title={`${(p as any).clients?.name ?? ""} — ${p.caption?.slice(0, 120)}`}
                    >
                      {t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{" "}
                      {(p as any).clients?.name ?? p.title ?? p.category ?? "post"}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}
