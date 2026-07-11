"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Ready Content" },
  { href: "/approval", label: "Awaiting Approval" },
  { href: "/scheduled", label: "Scheduled Content" },
  { href: "/calendar", label: "Calendar" },
  { href: "/published", label: "Published Content" },
  { href: "/failed", label: "Failed Posts" },
  { href: "/import", label: "Import Posts" },
  { href: "/clients", label: "Client Settings" },
  { href: "/health", label: "System Health" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="logo">⚡ Contengine</div>
      <nav>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
            {l.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
