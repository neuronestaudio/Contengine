import Shell from "@/components/Shell";
import PostGrid from "@/components/PostGrid";
import { list_ready_posts } from "@/lib/tools";

export const dynamic = "force-dynamic";

export default async function ReadyPage() {
  const posts = await list_ready_posts();
  return (
    <Shell
      title="Ready Content"
      subtitle="Posts received from the content pipeline. Render slides, then send for approval."
    >
      <PostGrid posts={posts} emptyText="No ready posts. Import some from the Import page." />
    </Shell>
  );
}
