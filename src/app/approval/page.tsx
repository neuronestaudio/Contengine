import Shell from "@/components/Shell";
import PostsView from "@/components/PostsView";
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
      <PostsView
        posts={awaiting}
        storageKey="view-approval"
        actions={[
          {
            label: "Approve selected",
            tool: "approve_post",
            className: "success",
            confirm: "Approve these posts for scheduling?",
          },
          {
            label: "Delete selected",
            tool: "delete_post",
            className: "danger",
            confirm: "Delete these posts and their rendered images?",
          },
        ]}
        emptyText="Nothing awaiting approval."
      />

      <h1 style={{ marginTop: 40 }}>Approved — ready to schedule</h1>
      <p className="subtitle">
        Schedule individually, bulk-schedule into the next available slots, or auto-schedule
        everything for a client.
      </p>
      {clients.length > 0 && <AutoScheduleBar clients={clients} />}
      <PostsView
        posts={approved}
        storageKey="view-approved"
        actions={[
          {
            label: "Schedule to next slots",
            tool: "schedule_next_available_slot",
            confirm: "Schedule these posts into each client's next available slots?",
          },
          {
            label: "Delete selected",
            tool: "delete_post",
            className: "danger",
            confirm: "Delete these posts and their rendered images?",
          },
        ]}
        emptyText="No approved posts waiting for a slot."
      />
    </Shell>
  );
}
