import Shell from "@/components/Shell";
import PostGrid from "@/components/PostGrid";
import { list_posts } from "@/lib/tools";

export const dynamic = "force-dynamic";

export default async function PublishedPage() {
  const posts = await list_posts({ status: "published" });
  return (
    <Shell title="Published Content" subtitle="Live posts with platform links.">
      <PostGrid posts={posts} emptyText="Nothing published yet." />
    </Shell>
  );
}
