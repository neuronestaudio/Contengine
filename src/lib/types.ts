export const POST_STATUSES = [
  "draft",
  "ready",
  "awaiting_approval",
  "approved",
  "scheduled",
  "publishing",
  "published",
  "failed",
] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

export type Platform = "facebook" | "instagram";

export interface Slide {
  html: string;
}

export interface RenderedMedia {
  url: string; // public URL in Supabase Storage
  path: string; // storage path
  width: number;
  height: number;
}

export interface PlatformResult {
  post_id?: string;
  url?: string;
  error?: string | null;
  published_at?: string;
}

export interface Client {
  id: string;
  name: string;
  fb_page_id: string | null;
  fb_page_access_token: string | null;
  ig_user_id: string | null;
  preferred_days: number[]; // 0=Sun .. 6=Sat
  preferred_times: string[]; // "HH:MM" in client timezone
  weekly_frequency: number;
  timezone: string;
  default_platforms: Platform[];
  brand_instructions: string | null;
  pillar_rotation: string[];
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  client_id: string;
  title: string | null;
  caption: string;
  category: string | null;
  platforms: Platform[];
  campaign: Record<string, unknown>;
  status: PostStatus;
  slides: Slide[];
  rendered_media: RenderedMedia[];
  scheduled_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  published_at: string | null;
  platform_results: Partial<Record<Platform, PlatformResult>>;
  error_message: string | null;
  retry_count: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export type PostWithClient = Post & { clients: Pick<Client, "id" | "name" | "timezone"> };
