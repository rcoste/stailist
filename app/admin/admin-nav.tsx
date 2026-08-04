"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/catalogo", label: "Catálogo" },
  { href: "/admin/looks", label: "Looks" },
  { href: "/admin/destilador", label: "Destilador" },
  { href: "/admin/recetas", label: "Recetas" },
  { href: "/admin/barrido", label: "Barrido" },
  { href: "/admin/ab", label: "A/B" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/allowlist", label: "Allowlist" },
  { href: "/admin/waitlist", label: "Waitlist" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    // Una sola fila con scroll: en el celular, envolver a dos filas empujaba el
    // contenido del destilador abajo del fold y había que hacer scroll para
    // llegar a los botones.
    <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {LINKS.map((l) => {
        const active =
          l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
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
