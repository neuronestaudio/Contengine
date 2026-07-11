import Shell from "@/components/Shell";
import ImportForm from "@/components/ImportForm";
import { list_clients } from "@/lib/tools";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const clients = await list_clients();
  return (
    <Shell
      title="Import Posts"
      subtitle="Upload completed HTML slides from your content pipeline. Automations can POST the same payload to /api/ingest with an API key."
    >
      <ImportForm clients={clients} />
      <p className="muted" style={{ marginTop: 24, fontSize: 12 }}>
        Debug: loaded {clients.length} client(s) from{" "}
        {process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("https://", "").split(".")[0]} at{" "}
        {new Date().toLocaleTimeString()}
      </p>
    </Shell>
  );
}
