import PostCard from "./PostCard";
import type { Post } from "@/lib/types";

export default function PostGrid({ posts, emptyText }: { posts: Post[]; emptyText: string }) {
  if (!posts.length) return <div className="empty">{emptyText}</div>;
  return (
    <div className="grid">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}
