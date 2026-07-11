import Shell from "@/components/Shell";
import ClientForm from "@/components/ClientForm";
import { list_clients } from "@/lib/tools";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await list_clients();
  return (
    <Shell
      title="Client Settings"
      subtitle="Meta connections, posting cadence, time zones and brand strategy per client."
    >
      <div className="grid">
        {clients.map((c) => (
          <ClientForm key={c.id} client={c} />
        ))}
        <ClientForm />
      </div>
    </Shell>
  );
}
