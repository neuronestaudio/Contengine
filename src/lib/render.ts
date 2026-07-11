import type { Browser } from "playwright-core";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { RenderedMedia, Slide } from "@/lib/types";

export const RENDER_WIDTH = 1080;
export const RENDER_HEIGHT = 1350;

async function launchBrowser(): Promise<Browser> {
  const { chromium: pw } = await import("playwright-core");

  // Local dev: point LOCAL_CHROME_PATH at an installed Chrome.
  if (process.env.LOCAL_CHROME_PATH) {
    return pw.launch({ executablePath: process.env.LOCAL_CHROME_PATH, headless: true });
  }

  // Not on Vercel and no local Chrome configured — fail with a clear message
  // instead of letting @sparticuz/chromium (Linux-only) error cryptically.
  if (!process.env.VERCEL) {
    throw new Error(
      "No renderer available: set LOCAL_CHROME_PATH in .env.local to your Chrome executable and restart the dev server (see /health)."
    );
  }

  // Vercel / AWS Lambda: serverless chromium build.
  const chromium = (await import("@sparticuz/chromium")).default;
  return pw.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

/**
 * Render each HTML slide to a 1080x1350 PNG and upload to Supabase Storage.
 * Returns the rendered media descriptors (public URLs).
 */
export async function renderSlides(postId: string, slides: Slide[]): Promise<RenderedMedia[]> {
  if (!slides.length) throw new Error("Post has no slides to render");

  const browser = await launchBrowser();
  const media: RenderedMedia[] = [];

  // Cache-busting token for this render pass. Re-rendering a post overwrites
  // the same storage path (upsert), so the public URL is unchanged and the
  // browser/CDN would keep serving the OLD image. Appending a fresh ?v= makes
  // every render produce a unique URL, guaranteeing the preview updates.
  const version = Date.now();

  try {
    const supabase = supabaseAdmin();
    const context = await browser.newContext({
      viewport: { width: RENDER_WIDTH, height: RENDER_HEIGHT },
      deviceScaleFactor: 1,
    });

    for (let i = 0; i < slides.length; i++) {
      const page = await context.newPage();
      await page.setContent(slides[i].html, { waitUntil: "networkidle", timeout: 30000 });
      // Give web fonts / animations a beat to settle.
      await page.waitForTimeout(300);

      const png = await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: RENDER_WIDTH, height: RENDER_HEIGHT },
      });
      await page.close();

      const path = `${postId}/slide-${String(i + 1).padStart(2, "0")}.png`;
      const { error } = await supabase.storage
        .from("renders")
        .upload(path, png, {
          contentType: "image/png",
          upsert: true,
          // Don't let the CDN/browser hold a stale copy across re-renders.
          cacheControl: "no-cache, max-age=0",
        });
      if (error) throw new Error(`Storage upload failed (${path}): ${error.message}`);

      const { data } = supabase.storage.from("renders").getPublicUrl(path);
      // ?v=<render time> busts any cached copy of this (stable) path.
      const url = `${data.publicUrl}?v=${version}`;
      media.push({ url, path, width: RENDER_WIDTH, height: RENDER_HEIGHT });
    }
  } finally {
    await browser.close();
  }

  return media;
}
