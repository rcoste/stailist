"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// El menú del admin, agrupado por PARA QUÉ entras — no por orden de llegada.
// Antes eran 17 chips iguales en una fila y había que saberse de memoria qué
// hacía cada uno; la reorganización de 2026-08-17 los dejó en 3 grupos:
//
// - Pulso: cómo va el experimento y quién lo usa. Lo que se mira seguido.
// - Motor: el laboratorio de IA — decidir cambios (comparador), vigilar el
//   nivel (evales) y curar lo que alimenta al motor (destilador → recetas).
// - Contenido: las prendas y looks que la app enseña, y la limpieza del clóset.
//
// Se fueron del menú (2026-08-17): Barrido, A/B e Inspo — leían JSONs
// congelados de la semana del 4 de agosto y sus preguntas ya estaban
// respondidas (el historial de git las guarda). Allowlist + Waitlist se
// fusionaron en Acceso; Revisar + Repetidas en Limpieza.
const GROUPS: { label: string; links: { href: string; label: string }[] }[] = [
  {
    label: "Pulso",
    links: [
      { href: "/admin", label: "Dashboard" },
      { href: "/admin/ia", label: "IA" },
      { href: "/admin/usuarios", label: "Usuarias" },
      { href: "/admin/acceso", label: "Acceso" },
    ],
  },
  {
    label: "Motor",
    links: [
      { href: "/admin/comparador", label: "Comparador" },
      { href: "/admin/evales", label: "Evales" },
      { href: "/admin/destilador", label: "Destilador" },
      { href: "/admin/recetas", label: "Recetas" },
    ],
  },
  {
    label: "Contenido",
    links: [
      { href: "/admin/catalogo", label: "Catálogo" },
      { href: "/admin/basicos", label: "Onboarding" },
      { href: "/admin/looks", label: "Looks" },
      { href: "/admin/limpieza", label: "Limpieza" },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    // Una sola fila con scroll: en el celular, envolver a dos filas empujaba el
    // contenido de las pantallas abajo del fold. Los títulos de grupo van
    // inline, apagados, y el separador marca dónde termina cada grupo.
    <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {GROUPS.map((group, gi) => (
        <div key={group.label} className="flex shrink-0 items-center gap-1">
          {gi > 0 ? <span className="mx-2 h-4 w-px bg-line" aria-hidden /> : null}
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted">
            {group.label}
          </span>
          {group.links.map((l) => {
            const active =
              l.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(l.href);
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
        </div>
      ))}
    </nav>
  );
}
