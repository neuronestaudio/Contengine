import Shell from "@/components/Shell";
import PostsView from "@/components/PostsView";
import { list_posts } from "@/lib/tools";

export const dynamic = "force-dynamic";

export default async function PublishedPage() {
  const posts = await list_posts({ status: "published" });
  return (
    <Shell title="Published Content" subtitle="Live posts with platform links.">
      <PostsView
        posts={posts}
        storageKey="view-published"
        actions={[
          {
            label: "Delete selected records",
            tool: "delete_post",
            className: "danger",
            confirm:
              "Delete these records from Contengine? The live posts on Facebook/Instagram will NOT be removed.",
          },
        ]}
        emptyText="Nothing published yet."
      />
    </Shell>
  );
}
