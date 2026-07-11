import Shell from "@/components/Shell";
import PostsView from "@/components/PostsView";
import { list_failed_posts } from "@/lib/tools";

export const dynamic = "force-dynamic";

export default async function FailedPage() {
  const posts = await list_failed_posts();
  return (
    <Shell
      title="Failed Posts"
      subtitle="Publishing errors with retry. Successful platforms are not re-published on retry."
    >
      <PostsView
        posts={posts}
        storageKey="view-failed"
        actions={[
          {
            label: "Retry selected",
            tool: "retry_failed_post",
            confirm: "Retry publishing these posts?",
          },
          {
            label: "Delete selected",
            tool: "delete_post",
            className: "danger",
            confirm: "Delete these posts and their rendered images?",
          },
        ]}
        emptyText="No failures. 🎉"
      />
    </Shell>
  );
}
