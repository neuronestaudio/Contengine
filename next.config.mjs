/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@sparticuz/chromium", "playwright-core"],
    // Client-side router cache. Dynamic routes default to 0s here, so every tab
    // switch re-fetches from the server. Keep visited pages for 30s so
    // switching back to a recently-seen tab is instant (served from memory).
    // Mutations still call router.refresh(), which busts this cache, so you
    // never act on stale data after approving/scheduling/deleting.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
