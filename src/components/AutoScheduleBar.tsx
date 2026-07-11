"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Client } from "@/lib/types";

export default function AutoScheduleBar({ clients }: { clients: Pick<Client, "id" | "name">[] }) {
  const router = useRouter();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const autoSchedule = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/tools/auto_schedule_posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed");
      const n = json.result.scheduled.length;
      setMsg(`Scheduled ${n} post${n === 1 ? "" : "s"} across available slots.`);
      router.refresh();
    } catch (e: any) {
      setMsg(`Error: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="row" style={{ marginBottom: 20 }}>
      <select style={{ width: 240 }} value={clientId} onChange={(e) => setClientId(e.target.value)}>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button onClick={autoSchedule} disabled={busy || !clientId}>
        {busy ? "Auto-scheduling…" : "Auto-schedule approved posts"}
      </button>
      {msg && <span className="muted">{msg}</span>}
    </div>
  );
}
