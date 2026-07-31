"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Segmented control del clóset (mismo patrón que los mini-tabs de Perfil), para
// movernos entre las sub-secciones: prendas (tu ropa), esenciales (la meta) y
// wishlist (lo que evalúas comprar). Navega por ruta — cada sub-sección conserva
// su propio loader. La cartera de colores ya NO vive aquí: es identidad de
// estilo y vive en Perfil → Estilo (junto al pasaporte).
const TABS: { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: "/closet", label: "prendas", match: (p) => p === "/closet" },
  {
    href: "/closet/capsula",
    label: "esenciales",
    match: (p) => p.startsWith("/closet/capsula"),
  },
  { href: "/wishlist", label: "wishlist", match: (p) => p.startsWith("/wishlist") },
];

export function ClosetNav() {
  const pathname = usePathname();
  return (
    <div
      role="tablist"
      aria-label="Secciones del clóset"
      data-hint-target="closet-tabs"
      className="flex gap-1.5 rounded-sm border border-line bg-bg p-1"
    >
      {TABS.map((t) => {
        const on = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={on}
            className={`flex-1 rounded-[2px] py-2 text-center text-[13px] font-semibold transition-colors duration-200 ${
              on
                ? "bg-surface text-ink shadow-[var(--shadow-hairline)]"
                : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
