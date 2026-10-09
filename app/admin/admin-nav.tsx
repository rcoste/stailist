"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// EL MENÚ DEL ADMIN, POR PREGUNTA (replanteado el 2026-10-09).
//
// Antes eran 17 entradas en 3 grupos, y la misma pregunta vivía en cuatro o
// cinco pantallas con nombres distintos ("¿quién volvió?" estaba en Dashboard,
// Campaña, Adquisición, Actividad y Retención). Roberto: "lo veo complejo,
// todo all over the place". Ahora hay cinco entradas, una por pregunta:
//
//   Hoy                ¿cómo va?
//   Campañas           ¿sirven los anuncios?
//   Embudo y retención ¿dónde se pierden y quién vuelve?
//   Personas           ¿quién es cada quien y qué hace?
//   Taller             las herramientas de construir, apartadas
//
// Cada entrada "es dueña" de varias rutas: la de Personas se queda marcada en
// la ficha de alguien, la del Taller en cualquiera de sus herramientas.
const ENTRADAS: { href: string; label: string; rutas: string[] }[] = [
  { href: "/admin", label: "Hoy", rutas: ["/admin"] },
  { href: "/admin/campanas", label: "Campañas", rutas: ["/admin/campanas", "/admin/campana", "/admin/adquisicion"] },
  { href: "/admin/embudo", label: "Embudo y retención", rutas: ["/admin/embudo", "/admin/retencion"] },
  { href: "/admin/personas", label: "Personas", rutas: ["/admin/personas", "/admin/usuarios", "/admin/actividad", "/admin/ver-como"] },
  { href: "/admin/taller", label: "Taller", rutas: [] },
];

/** A qué entrada pertenece una ruta; lo que no es de nadie es del Taller. */
export function entradaDe(pathname: string): string {
  for (const e of ENTRADAS) {
    if (e.rutas.some((r) => (r === "/admin" ? pathname === r : pathname === r || pathname.startsWith(r + "/")))) return e.href;
  }
  return "/admin/taller";
}

export function AdminNav() {
  const activa = entradaDe(usePathname());
  return (
    <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ENTRADAS.map((e) => (
        <Link
          key={e.href}
          href={e.href}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-200 ${
            activa === e.href ? "bg-ink text-on-accent" : "text-muted hover:bg-bg hover:text-ink"
          }`}
        >
          {e.label}
        </Link>
      ))}
    </nav>
  );
}
