/**
 * Contengine internal tool layer.
 *
 * Every operation the app performs goes through these functions, so they can
 * later be exposed 1:1 through an MCP server. All functions are deterministic
 * given their inputs + database state.
 *
 * SAFETY INVARIANT: only approved posts can be scheduled, and only scheduled
 * (approved) posts can be published. Claude may edit captions and recommend
 * schedules, but cannot cause an unapproved post to publish.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { renderSlides } from "@/lib/render";
import { publishToFacebook, publishToInstagram } from "@/lib/meta";
import { nextAvailableSlot, orderByPillarRotation } from "@/lib/scheduling";
import type { Client, Platform, Post, PostStatus } from "@/lib/types";

const POST_SELECT = "*, clients(id, name, timezone, preferred_times, preferred_days)";

function db() {
  return supabaseAdmin();
}

async function getPostOrThrow(postId: string): Promise<Post> {
  const { data, error } = await db().from("posts").select(POST_SELECT).eq("id", postId).single();
  if (error || !data) throw new Error(`Post not found: ${postId}`);
  return data as unknown as Post;
}

async function getClientOrThrow(clientId: string): Promise<Client> {
  const { data, error } = await db().from("clients").select("*").eq("id", clientId).single();
  if (error || !data) throw new Error(`Client not found: ${clientId}`);
  return data as Client;
}

async function updatePost(postId: string, patch: Record<string, unknown>): Promise<Post> {
  const { data, error } = await db()
    .from("posts")
    .update(patch)
    .eq("id", postId)
    .select(POST_SELECT)
    .single();
  if (error || !data) throw new Error(`Failed to update post ${postId}: ${error?.message}`);
  return data as unknown as Post;
}

/** Instants already booked for a client (used for slot computation). */
async function takenSlots(clientId: string, excludePostId?: string): Promise<string[]> {
  let q = db()
    .from("posts")
    .select("id, scheduled_at")
    .eq("client_id", clientId)
    .in("status", ["scheduled", "publishing", "published"])
    .not("scheduled_at", "is", null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || [])
    .filter((p) => p.id !== excludePostId)
    .map((p) => p.scheduled_at as string);
}

// ---------------------------------------------------------------------------
// Listing / reading
// ---------------------------------------------------------------------------

export async function list_ready_posts(params: { client_id?: string } = {}): Promise<Post[]> {
  let q = db().from("posts").select(POST_SELECT).eq("status", "ready").order("created_at");
  if (params.client_id) q = q.eq("client_id", params.client_id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as unknown as Post[];
}

export async function list_posts(params: {
  status?: PostStatus;
  client_id?: string;
  limit?: number;
} = {}): Promise<Post[]> {
  let q = db()
    .from("posts")
    .select(POST_SELECT)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 200);
  if (params.status) q = q.eq("status", params.status);
  if (params.client_id) q = q.eq("client_id", params.client_id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as unknown as Post[];
}

export async function get_post(params: { post_id: string }): Promise<Post> {
  return getPostOrThrow(params.post_id);
}

export async function list_failed_posts(params: { client_id?: string } = {}): Promise<Post[]> {
  let q = db()
    .from("posts")
    .select(POST_SELECT)
    .eq("status", "failed")
    .order("updated_at", { ascending: false });
  if (params.client_id) q = q.eq("client_id", params.client_id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []) as unknown as Post[];
}

// ---------------------------------------------------------------------------
// Editing / approval
// ---------------------------------------------------------------------------

export async function update_caption(params: {
  post_id: string;
  caption: string;
}): Promise<Post> {
  const post = await getPostOrThrow(params.post_id);
  if (["publishing", "published"].includes(post.status)) {
    throw new Error(`Cannot edit caption of a ${post.status} post`);
  }
  return updatePost(params.post_id, { caption: params.caption });
}

export async function approve_post(params: {
  post_id: string;
  approved_by?: string;
  platforms?: Platform[];
}): Promise<Post> {
  const post = await getPostOrThrow(params.post_id);
  if (!["ready", "awaiting_approval"].includes(post.status)) {
    throw new Error(`Post must be ready or awaiting_approval to approve (is: ${post.status})`);
  }
  if (!post.rendered_media?.length) {
    throw new Error("Post has no rendered media — run render_post first");
  }
  const patch: Record<string, unknown> = {
    status: "approved" satisfies PostStatus,
    approved_at: new Date().toISOString(),
    approved_by: params.approved_by ?? "dashboard",
  };
  if (params.platforms?.length) patch.platforms = params.platforms;
  return updatePost(params.post_id, patch);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export async function render_post(params: { post_id: string }): Promise<Post> {
  const post = await getPostOrThrow(params.post_id);
  if (!post.slides?.length) throw new Error("Post has no slides");

  const media = await renderSlides(post.id, post.slides);
  const patch: Record<string, unknown> = { rendered_media: media };
  // Fresh ready posts move to awaiting_approval once rendered.
  if (post.status === "ready" || post.status === "draft") {
    patch.status = "awaiting_approval" satisfies PostStatus;
  }
  return updatePost(post.id, patch);
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

function assertSchedulable(post: Post) {
  if (!["approved", "scheduled", "failed"].includes(post.status)) {
    throw new Error(`Only approved posts can be scheduled (post is: ${post.status})`);
  }
  if (!post.approved_at) throw new Error("Post has never been approved");
}

export async function schedule_post(params: {
  post_id: string;
  scheduled_at: string; // ISO instant
  platforms?: Platform[];
}): Promise<Post> {
  const post = await getPostOrThrow(params.post_id);
  assertSchedulable(post);
  const when = new Date(params.scheduled_at);
  if (Number.isNaN(when.getTime())) throw new Error("Invalid scheduled_at");
  if (when.getTime() < Date.now() - 60_000) throw new Error("scheduled_at is in the past");

  const patch: Record<string, unknown> = {
    status: "scheduled" satisfies PostStatus,
    scheduled_at: when.toISOString(),
    error_message: null,
  };
  if (params.platforms?.length) patch.platforms = params.platforms;
  return updatePost(post.id, patch);
}

export async function schedule_next_available_slot(params: {
  post_id: string;
}): Promise<Post> {
  const post = await getPostOrThrow(params.post_id);
  assertSchedulable(post);
  const client = await getClientOrThrow(post.client_id);
  const taken = await takenSlots(client.id, post.id);
  const slot = nextAvailableSlot(client, { taken });
  if (!slot) throw new Error("No available slot found within 90 days");
  return schedule_post({ post_id: post.id, scheduled_at: slot.toISOString() });
}

export async function auto_schedule_posts(params: {
  client_id: string;
}): Promise<{ scheduled: { post_id: string; scheduled_at: string }[]; skipped: string[] }> {
  const client = await getClientOrThrow(params.client_id);
  const approved = await list_posts({ status: "approved", client_id: client.id });
  const ordered = orderByPillarRotation(client, approved);

  const taken = await takenSlots(client.id);
  const scheduled: { post_id: string; scheduled_at: string }[] = [];
  const skipped: string[] = [];

  for (const post of ordered) {
    const slot = nextAvailableSlot(client, { taken });
    if (!slot) {
      skipped.push(post.id);
      continue;
    }
    const iso = slot.toISOString();
    await schedule_post({ post_id: post.id, scheduled_at: iso });
    taken.push(iso);
    scheduled.push({ post_id: post.id, scheduled_at: iso });
  }
  return { scheduled, skipped };
}

export async function reschedule_post(params: {
  post_id: string;
  scheduled_at: string;
}): Promise<Post> {
  const post = await getPostOrThrow(params.post_id);
  if (!["scheduled", "approved", "failed"].includes(post.status)) {
    throw new Error(`Cannot reschedule a ${post.status} post`);
  }
  return schedule_post({ post_id: params.post_id, scheduled_at: params.scheduled_at });
}

// ---------------------------------------------------------------------------
// Publishing (deterministic — only approved + scheduled posts)
// ---------------------------------------------------------------------------

export async function publish_post(params: { post_id: string }): Promise<Post> {
  const post = await getPostOrThrow(params.post_id);

  // Hard guards — these make publishing deterministic and safe.
  if (post.status !== "scheduled" && post.status !== "publishing") {
    throw new Error(`Post must be scheduled to publish (is: ${post.status})`);
  }
  if (!post.approved_at) throw new Error("Refusing to publish: post was never approved");
  if (!post.rendered_media?.length) throw new Error("Refusing to publish: no rendered media");
  if (!post.platforms?.length) throw new Error("Refusing to publish: no platforms selected");

  const client = await getClientOrThrow(post.client_id);
  await updatePost(post.id, { status: "publishing" satisfies PostStatus });

  const imageUrls = post.rendered_media.map((m) => m.url);
  const results: Record<string, unknown> = { ...post.platform_results };
  const errors: string[] = [];

  for (const platform of post.platforms) {
    // Skip platforms that already succeeded (retry safety).
    const prior = (post.platform_results as any)?.[platform];
    if (prior?.post_id && !prior?.error) continue;

    try {
      if (platform === "facebook") {
        if (!client.fb_page_id || !client.fb_page_access_token) {
          throw new Error("Client has no Facebook Page connected");
        }
        results.facebook = await publishToFacebook(
          client.fb_page_id,
          client.fb_page_access_token,
          imageUrls,
          post.caption
        );
      } else if (platform === "instagram") {
        if (!client.ig_user_id || !client.fb_page_access_token) {
          throw new Error("Client has no Instagram account connected");
        }
        results.instagram = await publishToInstagram(
          client.ig_user_id,
          client.fb_page_access_token,
          imageUrls,
          post.caption
        );
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      results[platform] = { ...(results[platform] as object), error: msg };
      errors.push(`${platform}: ${msg}`);
    }
  }

  if (errors.length) {
    return updatePost(post.id, {
      status: "failed" satisfies PostStatus,
      platform_results: results,
      error_message: errors.join(" | "),
      retry_count: post.retry_count + 1,
    });
  }

  return updatePost(post.id, {
    status: "published" satisfies PostStatus,
    platform_results: results,
    published_at: new Date().toISOString(),
    error_message: null,
  });
}

export async function retry_failed_post(params: { post_id: string }): Promise<Post> {
  const post = await getPostOrThrow(params.post_id);
  if (post.status !== "failed") throw new Error(`Post is not failed (is: ${post.status})`);
  if (!post.approved_at) throw new Error("Refusing to retry: post was never approved");
  if (post.retry_count >= 5) throw new Error("Retry limit reached (5) — investigate manually");

  await updatePost(post.id, {
    status: "scheduled" satisfies PostStatus,
    scheduled_at: new Date().toISOString(),
  });
  return publish_post({ post_id: post.id });
}

export async function delete_post(params: { post_id: string }): Promise<{ deleted: string }> {
  const post = await getPostOrThrow(params.post_id);
  if (post.status === "publishing") {
    throw new Error("Post is mid-publish — wait for it to finish, then delete");
  }
  // Clean up rendered PNGs from storage (best-effort).
  const paths = (post.rendered_media || []).map((m) => m.path).filter(Boolean);
  if (paths.length) {
    try {
      await db().storage.from("renders").remove(paths);
    } catch {
      /* orphaned files are harmless */
    }
  }
  const { error } = await db().from("posts").delete().eq("id", post.id);
  if (error) throw new Error(`Failed to delete post: ${error.message}`);
  return { deleted: post.id };
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export async function list_clients(): Promise<Client[]> {
  const { data, error } = await db().from("clients").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data || []) as Client[];
}

export async function upsert_client(params: Partial<Client> & { name: string }): Promise<Client> {
  const { id, created_at, updated_at, ...fields } = params as any;
  const query = id
    ? db().from("clients").update(fields).eq("id", id).select("*").single()
    : db().from("clients").insert(fields).select("*").single();
  const { data, error } = await query;
  if (error || !data) throw new Error(`Failed to save client: ${error?.message}`);
  return data as Client;
}

// ---------------------------------------------------------------------------
// Ingest (from the content endpoint / Import page)
// ---------------------------------------------------------------------------

export interface IngestPostInput {
  client_id: string;
  title?: string;
  caption: string;
  category?: string;
  platforms?: Platform[];
  campaign?: Record<string, unknown>;
  slides: { html: string }[]; // one or more HTML slides
  source?: string;
}

export async function ingest_post(input: IngestPostInput): Promise<Post> {
  const client = await getClientOrThrow(input.client_id);
  if (!input.slides?.length) throw new Error("At least one slide is required");

  const { data, error } = await db()
    .from("posts")
    .insert({
      client_id: client.id,
      title: input.title ?? null,
      caption: input.caption ?? "",
      category: input.category ?? null,
      platforms: input.platforms?.length ? input.platforms : client.default_platforms,
      campaign: input.campaign ?? {},
      slides: input.slides,
      status: "ready" satisfies PostStatus,
      source: input.source ?? "ingest_api",
    })
    .select(POST_SELECT)
    .single();
  if (error || !data) throw new Error(`Failed to ingest post: ${error?.message}`);
  return data as unknown as Post;
}

// ---------------------------------------------------------------------------
// Tool registry — the surface a future MCP server will expose.
// ---------------------------------------------------------------------------

export const TOOLS = {
  list_ready_posts,
  list_posts,
  get_post,
  update_caption,
  approve_post,
  render_post,
  schedule_post,
  schedule_next_available_slot,
  auto_schedule_posts,
  reschedule_post,
  publish_post,
  list_failed_posts,
  retry_failed_post,
  delete_post,
  list_clients,
  upsert_client,
  ingest_post,
} as const;

export type ToolName = keyof typeof TOOLS;
