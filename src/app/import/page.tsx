import Shell from "@/components/Shell";
import ImportForm from "@/components/ImportForm";
import PostsView from "@/components/PostsView";
import { list_clients, list_posts } from "@/lib/tools";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const [clients, awaiting] = await Promise.all([
    list_clients(),
    list_posts({ status: "awaiting_approval" }),
  ]);

  return (
    <Shell
      title="Import & Approve"
      subtitle="Drop in completed HTML slides, then review and approve them below. Automations can POST the same payload to /api/ingest with an API key."
    >
      <ImportForm clients={clients} />

      <h1 style={{ marginTop: 40 }}>Awaiting approval</h1>
      <p className="subtitle">
        Review the rendered slides and caption, edit if needed, then approve. Approved posts move to
        the <strong>Schedule</strong> tab. Nothing publishes until you approve it.
      </p>
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
        emptyText="Nothing awaiting approval yet — imported posts show up here."
      />
    </Shell>
  );
}
