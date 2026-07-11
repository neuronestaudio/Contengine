import Shell from "@/components/Shell";
import PostGrid from "@/components/PostGrid";
import AutoScheduleBar from "@/components/AutoScheduleBar";
import { list_posts, list_clients } from "@/lib/tools";

export const dynamic = "force-dynamic";

export default async function ApprovalPage() {
  const [awaiting, approved, clients] = await Promise.all([
    list_posts({ status: "awaiting_approval" }),
    list_posts({ status: "approved" }),
    list_clients(),
  ]);

  return (
    <Shell
      title="Awaiting Approval"
      subtitle="Review rendered posts, edit captions, approve, then schedule."
    >
      <PostGrid posts={awaiting} emptyText="Nothing awaiting approval." />

      <h1 style={{ marginTop: 40 }}>Approved — ready to schedule</h1>
      <p className="subtitle">
        Schedule individually, use the next available slot, or auto-schedule everything for a
        client.
      </p>
      {clients.length > 0 && <AutoScheduleBar clients={clients} />}
      <PostGrid posts={approved} emptyText="No approved posts waiting for a slot." />
    </Shell>
  );
}
