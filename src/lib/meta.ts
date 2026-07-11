/**
 * Meta Graph API publishing (Facebook Pages + Instagram professional accounts).
 *
 * Requirements per client:
 *  - fb_page_id + fb_page_access_token (long-lived Page token with
 *    pages_manage_posts, pages_read_engagement)
 *  - ig_user_id (IG professional account linked to the Page; token also needs
 *    instagram_basic, instagram_content_publish)
 *
 * Media URLs must be publicly reachable — Supabase Storage public bucket works.
 */

import type { PlatformResult } from "@/lib/types";

const GRAPH = () =>
  `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v21.0"}`;

async function graphFetch(path: string, params: Record<string, string>): Promise<any> {
  const body = new URLSearchParams(params);
  const res = await fetch(`${GRAPH()}${path}`, { method: "POST", body });
  const json = await res.json();
  if (!res.ok || json.error) {
    const msg = json?.error?.message || `Graph API error (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

async function graphGet(path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${GRAPH()}${path}?${qs}`);
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json?.error?.message || `Graph API error (${res.status})`);
  }
  return json;
}

// ---------------------------------------------------------------------------
// Facebook
// ---------------------------------------------------------------------------
export async function publishToFacebook(
  pageId: string,
  pageToken: string,
  imageUrls: string[],
  caption: string
): Promise<PlatformResult> {
  if (imageUrls.length === 1) {
    const r = await graphFetch(`/${pageId}/photos`, {
      url: imageUrls[0],
      message: caption,
      access_token: pageToken,
    });
    const postId: string = r.post_id || r.id;
    return {
      post_id: postId,
      url: `https://www.facebook.com/${postId}`,
      published_at: new Date().toISOString(),
    };
  }

  // Multi-image: upload each photo unpublished, then attach to a feed post.
  const mediaIds: string[] = [];
  for (const url of imageUrls) {
    const r = await graphFetch(`/${pageId}/photos`, {
      url,
      published: "false",
      access_token: pageToken,
    });
    mediaIds.push(r.id);
  }

  const params: Record<string, string> = {
    message: caption,
    access_token: pageToken,
  };
  mediaIds.forEach((id, i) => {
    params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
  });

  const r = await graphFetch(`/${pageId}/feed`, params);
  return {
    post_id: r.id,
    url: `https://www.facebook.com/${r.id}`,
    published_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Instagram
// ---------------------------------------------------------------------------
async function waitForContainer(containerId: string, token: string): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const r = await graphGet(`/${containerId}`, {
      fields: "status_code",
      access_token: token,
    });
    if (r.status_code === "FINISHED") return;
    if (r.status_code === "ERROR") throw new Error("Instagram media container failed processing");
    await new Promise((res) => setTimeout(res, 1500));
  }
  throw new Error("Instagram media container timed out");
}

export async function publishToInstagram(
  igUserId: string,
  token: string,
  imageUrls: string[],
  caption: string
): Promise<PlatformResult> {
  let creationId: string;

  if (imageUrls.length === 1) {
    const r = await graphFetch(`/${igUserId}/media`, {
      image_url: imageUrls[0],
      caption,
      access_token: token,
    });
    creationId = r.id;
  } else {
    // Carousel: children first, then the carousel container.
    const children: string[] = [];
    for (const url of imageUrls.slice(0, 10)) {
      const r = await graphFetch(`/${igUserId}/media`, {
        image_url: url,
        is_carousel_item: "true",
        access_token: token,
      });
      children.push(r.id);
    }
    const r = await graphFetch(`/${igUserId}/media`, {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption,
      access_token: token,
    });
    creationId = r.id;
  }

  await waitForContainer(creationId, token);

  const pub = await graphFetch(`/${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: token,
  });

  // Fetch permalink for the published media.
  let url: string | undefined;
  try {
    const info = await graphGet(`/${pub.id}`, { fields: "permalink", access_token: token });
    url = info.permalink;
  } catch {
    /* permalink is best-effort */
  }

  return { post_id: pub.id, url, published_at: new Date().toISOString() };
}
