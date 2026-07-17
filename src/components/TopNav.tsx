"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import HelpModal from "./HelpModal";

// Primary workflow tabs, left to right in the order you work through a post.
const TABS = [
  { href: "/import", label: "Import & Approve" },
  { href: "/", label: "Schedule" },
  { href: "/scheduled", label: "Scheduled" },
  { href: "/published", label: "Published" },
];

// Everything else, kept out of the main row.
const MORE = [
  { href: "/calendar", label: "Calendar" },
  { href: "/failed", label: "Failed" },
  { href: "/clients", label: "Clients" },
  { href: "/health", label: "Health" },
];

export default function TopNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="topnav">
      <div className="topnav-brand">⚡ Contengine</div>
      <nav className="topnav-tabs">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={`topnav-tab${isActive(t.href) ? " active" : ""}`}>
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="topnav-right">
        {MORE.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className={`topnav-more${isActive(m.href) ? " active" : ""}`}
          >
            {m.label}
          </Link>
        ))}
        <HelpModal />
      </div>
    </header>
  );
}
