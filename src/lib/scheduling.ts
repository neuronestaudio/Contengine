import { addDays, startOfDay, startOfWeek, endOfWeek } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { Client, Post } from "@/lib/types";

/**
 * Deterministic slot computation from a client's preferences.
 * A slot = (preferred day, preferred time) in the client's timezone.
 */

export interface SlotOptions {
  /** Instants (ISO) already taken — scheduled/publishing/published posts. */
  taken: string[];
  /** Start searching from this instant (default: now). */
  from?: Date;
  /** How many days ahead to search (default 90). */
  horizonDays?: number;
}

function clientDayCandidates(client: Client, dayLocal: Date): Date[] {
  // dayLocal is a date in client-local wall time (midnight).
  if (!client.preferred_days.includes(dayLocal.getDay())) return [];
  return client.preferred_times
    .map((t) => {
      const [h, m] = t.split(":").map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      const local = new Date(dayLocal);
      local.setHours(h, m, 0, 0);
      return fromZonedTime(local, client.timezone); // -> UTC instant
    })
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
}

function postsInSameWeek(client: Client, slot: Date, taken: Date[]): number {
  const localSlot = toZonedTime(slot, client.timezone);
  const ws = startOfWeek(localSlot, { weekStartsOn: 1 });
  const we = endOfWeek(localSlot, { weekStartsOn: 1 });
  return taken.filter((t) => {
    const lt = toZonedTime(t, client.timezone);
    return lt >= ws && lt <= we;
  }).length;
}

/**
 * Find the next open slot for a client. Deterministic: same inputs, same output.
 */
export function nextAvailableSlot(client: Client, opts: SlotOptions): Date | null {
  const from = opts.from ?? new Date();
  const horizon = opts.horizonDays ?? 90;
  const takenDates = opts.taken.map((t) => new Date(t));
  const takenMs = new Set(takenDates.map((d) => d.getTime()));

  const localNow = toZonedTime(from, client.timezone);
  let dayLocal = startOfDay(localNow);

  for (let i = 0; i <= horizon; i++) {
    for (const slot of clientDayCandidates(client, dayLocal)) {
      if (slot.getTime() <= from.getTime()) continue; // in the past
      if (takenMs.has(slot.getTime())) continue; // already booked
      if (
        client.weekly_frequency > 0 &&
        postsInSameWeek(client, slot, takenDates) >= client.weekly_frequency
      )
        continue; // weekly quota reached
      return slot;
    }
    dayLocal = addDays(dayLocal, 1);
  }
  return null;
}

/**
 * Order approved posts to follow the client's content-pillar rotation.
 * Greedy: walk the rotation, pick the oldest approved post matching each
 * pillar; fall back to the oldest remaining post when no match exists.
 */
export function orderByPillarRotation(client: Client, posts: Post[]): Post[] {
  if (!client.pillar_rotation.length) return [...posts];

  const remaining = [...posts].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const ordered: Post[] = [];
  let pillarIdx = 0;

  while (remaining.length) {
    const pillar = client.pillar_rotation[pillarIdx % client.pillar_rotation.length];
    const matchIdx = remaining.findIndex(
      (p) => (p.category || "").toLowerCase() === pillar.toLowerCase()
    );
    const idx = matchIdx >= 0 ? matchIdx : 0;
    ordered.push(remaining.splice(idx, 1)[0]);
    pillarIdx++;
  }
  return ordered;
}
