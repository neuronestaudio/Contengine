"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import HelpModal from "./HelpModal";

const PRIMARY = [
  { href: "/import", label: "Import Posts", color: "var(--accent)" },
  { href: "/approval", label: "Awaiting Approval", color: "var(--amber)" },
  { href: "/scheduled", label: "Scheduled Content", color: "var(--green)" },
];

const SECONDARY = [
  { href: "/", label: "Ready Content" },
  { href: "/calendar", label: "Calendar" },
  { href: "/published", label: "Published Content" },
  { href: "/failed", label: "Failed Posts" },
  { href: "/clients", label: "Client Settings" },
  { href: "/health", label: "System Health" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="logo">⚡ Contengine</div>
      <nav>
        {PRIMARY.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`primary-link${pathname === l.href ? " active" : ""}`}
            style={{ borderLeft: `3px solid ${l.color}` }}
          >
            {l.label}
          </Link>
        ))}
        <div className="nav-divider" />
        {SECONDARY.map((l) => (
          <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
            {l.label}
          </Link>
        ))}
      </nav>
      <HelpModal />
    </aside>
  );
}
