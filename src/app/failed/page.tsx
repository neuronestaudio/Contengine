import Shell from "@/components/Shell";
import PostGrid from "@/components/PostGrid";
import { list_failed_posts } from "@/lib/tools";

export const dynamic = "force-dynamic";

export default async function FailedPage() {
  const posts = await list_failed_posts();
  return (
    <Shell
      title="Failed Posts"
      subtitle="Publishing errors with retry. Successful platforms are not re-published on retry."
    >
      <PostGrid posts={posts} emptyText="No failures. 🎉" />
    </Shell>
  );
}
