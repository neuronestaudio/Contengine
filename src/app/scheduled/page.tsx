import Shell from "@/components/Shell";
import PostGrid from "@/components/PostGrid";
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
      subtitle="Queued for publishing. The publisher runs every 5 minutes."
    >
      <PostGrid posts={posts} emptyText="Nothing scheduled yet." />
    </Shell>
  );
}
