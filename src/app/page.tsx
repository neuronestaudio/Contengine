import Shell from "@/components/Shell";
import PostsView from "@/components/PostsView";
import AutoScheduleBar from "@/components/AutoScheduleBar";
import { list_ready_posts, list_posts, list_clients } from "@/lib/tools";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const [ready, approved, clients] = await Promise.all([
    list_ready_posts(),
    list_posts({ status: "approved" }),
    list_clients(),
  ]);

  return (
    <Shell
      title="Schedule"
      subtitle="Approved posts ready for a date, plus anything still waiting to be rendered."
    >
      <h1 style={{ marginTop: 0 }}>Approved — ready to schedule</h1>
      <p className="subtitle">
        Pick a date on each post (the time pre-fills to the client&apos;s preferred time),
        bulk-schedule into the next free slots, or auto-schedule a whole client.
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
        emptyText="No approved posts waiting for a slot. Approve some on the Import & Approve tab."
      />

      <h1 style={{ marginTop: 40 }}>Not yet rendered</h1>
      <p className="subtitle">
        Posts received from the pipeline that still need rendering before they can be approved.
      </p>
      <PostsView
        posts={ready}
        storageKey="view-ready"
        actions={[
          { label: "Render selected", tool: "render_post" },
          {
            label: "Delete selected",
            tool: "delete_post",
            className: "danger",
            confirm: "Delete these posts and their rendered images?",
          },
        ]}
        emptyText="Nothing waiting to render."
      />
    </Shell>
  );
}
