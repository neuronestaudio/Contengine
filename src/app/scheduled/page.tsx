import Shell from "@/components/Shell";
import PostsView from "@/components/PostsView";
import { list_posts } from "@/lib/tools";

export const dynamic = "force-dynamic";

export default async function ScheduledPage() {
  const [scheduled, publishing] = await Promise.all([
    list_posts({ status: "scheduled" }),
    list_posts({ status: "publishing" }),
  ]);
  const posts = [...publishing, ...scheduled];
  return (
    <Shell
      title="Scheduled Content"
      subtitle="Queued for publishing. On Vercel the publisher runs every 5 minutes; locally use Publish now."
    >
      <PostsView
        posts={posts}
        storageKey="view-scheduled"
        actions={[
          {
            label: "Publish selected now",
            tool: "publish_post",
            className: "success",
            confirm: "Publish these posts to their platforms RIGHT NOW?",
          },
          {
            label: "Delete selected",
            tool: "delete_post",
            className: "danger",
            confirm: "Delete these posts? They will NOT be published.",
          },
        ]}
        emptyText="Nothing scheduled yet."
      />
    </Shell>
  );
}
