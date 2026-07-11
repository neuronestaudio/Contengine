import Shell from "@/components/Shell";
import PostsView from "@/components/PostsView";
import { list_ready_posts } from "@/lib/tools";

export const dynamic = "force-dynamic";

export default async function ReadyPage() {
  const posts = await list_ready_posts();
  return (
    <Shell
      title="Ready Content"
      subtitle="Posts received from the content pipeline. Render slides, then send for approval."
    >
      <PostsView
        posts={posts}
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
        emptyText="No ready posts. Import some from the Import page."
      />
    </Shell>
  );
}
