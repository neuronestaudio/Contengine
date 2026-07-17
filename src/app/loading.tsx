import Sidebar from "@/components/Sidebar";

/**
 * Route-level loading UI. In the App Router this streams to the browser the
 * instant a navigation starts, so pages feel immediate instead of hanging on a
 * white screen while the (force-dynamic) server component fetches from
 * Supabase. The sidebar stays put; only the content area shows a skeleton.
 */
export default function Loading() {
  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        <div className="skel skel-title" />
        <div className="skel skel-subtitle" />
        <div className="grid" style={{ marginTop: 24 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card">
              <div className="skel skel-line" style={{ width: "40%" }} />
              <div className="skel skel-thumb" />
              <div className="skel skel-line" />
              <div className="skel skel-line" style={{ width: "80%" }} />
              <div className="row" style={{ marginTop: 4 }}>
                <div className="skel skel-btn" />
                <div className="skel skel-btn" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
