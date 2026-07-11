import Shell from "@/components/Shell";
import { runHealthChecks } from "@/lib/health";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const checks = await runHealthChecks();
  const allOk = checks.every((c) => c.ok);

  return (
    <Shell
      title="System Health"
      subtitle={
        allOk
          ? "All systems operational."
          : "Something is misconfigured — fixes listed below."
      }
    >
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Check</th>
            <th>Status</th>
            <th>Fix</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.name}>
              <td style={{ fontSize: 18 }}>{c.ok ? "✅" : "❌"}</td>
              <td>{c.name}</td>
              <td className={c.ok ? "muted" : "error-text"}>{c.detail}</td>
              <td className="muted">{c.fix || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  );
}
