"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Las dos preguntas de limpiar el clóset, como pestañas de una misma sección.
// "Revisar" (¿esta prenda existe?) y "Repetidas" (¿estas dos son la misma?)
// nacieron como pantallas separadas el mismo día, con la misma mecánica y la
// misma justificación — desde 2026-08-17 viven juntas bajo /admin/limpieza.
const TABS = [
  { href: "/admin/limpieza/revisar", label: "¿Existe?" },
  { href: "/admin/limpieza/repetidas", label: "¿Repetida?" },
];

export function LimpiezaTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
              active
                ? "bg-accent text-on-accent"
                : "text-muted hover:bg-bg hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
