import Shell from "@/components/Shell";
import CalendarView, { type CalEvent } from "@/components/CalendarView";
import { list_posts } from "@/lib/tools";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const all = (
    await Promise.all([
      list_posts({ status: "scheduled", limit: 500 }),
      list_posts({ status: "publishing", limit: 500 }),
      list_posts({ status: "published", limit: 500 }),
      list_posts({ status: "failed", limit: 500 }),
    ])
  ).flat();

  // Trim to what the client view needs; all date math happens in the browser
  // (the user's timezone) to avoid server/client hydration mismatches.
  const events: CalEvent[] = all
    .map((p) => ({
      id: p.id,
      when: p.scheduled_at || p.published_at || "",
      status: p.status,
      label: (p as any).clients?.name ?? p.title ?? p.category ?? "post",
      caption: p.caption ?? "",
    }))
    .filter((e) => e.when);

  return (
    <Shell title="Calendar" subtitle="All scheduled and published posts by date (your local time).">
      <CalendarView events={events} />
    </Shell>
  );
}
