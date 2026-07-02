"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/catalogo", label: "Catálogo" },
  { href: "/admin/looks", label: "Looks" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/allowlist", label: "Allowlist" },
  { href: "/admin/waitlist", label: "Waitlist" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {LINKS.map((l) => {
        const active =
          l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
              active
                ? "bg-accent text-on-accent"
                : "text-muted hover:bg-bg hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
