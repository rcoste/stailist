"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// EL MENÚ DEL ADMIN, POR PREGUNTA. Replanteado el 2026-10-09 (cinco entradas en
// vez de 17) y rediseñado el 2026-10-13: barra lateral en escritorio, barra
// horizontal en celular. Las entradas son preguntas:
//
//   Hoy          ¿cómo va?
//   Campañas     ¿sirven los anuncios?
//   Embudo       ¿dónde se pierden?
//   Retención    ¿quién vuelve?
//   Personas     ¿quién es cada quien y qué hace?
//   Errores      ¿a quién le salió algo mal? (globo rojo = tipos sin revisar)
//   Taller       las herramientas de construir, apartadas
//
// Cada entrada "es dueña" de varias rutas: Personas se queda marcada en la
// ficha de alguien, el Taller en cualquiera de sus herramientas.
export const ENTRADAS: { href: string; label: string; rutas: string[]; grupo: "leer" | "construir" }[] = [
  { href: "/admin", label: "Hoy", rutas: ["/admin"], grupo: "leer" },
  { href: "/admin/campanas", label: "Campañas", rutas: ["/admin/campanas", "/admin/campana", "/admin/adquisicion"], grupo: "leer" },
  { href: "/admin/embudo", label: "Embudo", rutas: ["/admin/embudo"], grupo: "leer" },
  { href: "/admin/retencion", label: "Retención", rutas: ["/admin/retencion"], grupo: "leer" },
  // Personas abre en Actividad: es la vista que más usa Roberto.
  { href: "/admin/actividad", label: "Personas", rutas: ["/admin/usuarios", "/admin/actividad", "/admin/ver-como"], grupo: "leer" },
  { href: "/admin/errores", label: "Errores", rutas: ["/admin/errores"], grupo: "leer" },
  { href: "/admin/taller", label: "Taller", rutas: [], grupo: "construir" },
];

/** A qué entrada pertenece una ruta; lo que no es de nadie es del Taller. */
export function entradaDe(pathname: string): string {
  if (pathname === "/admin/como-se-cuenta") return pathname;
  for (const e of ENTRADAS) {
    if (e.rutas.some((r) => (r === "/admin" ? pathname === r : pathname === r || pathname.startsWith(r + "/")))) return e.href;
  }
  return "/admin/taller";
}

/** El globo rojo de Errores: tipos de error sin revisar (lib/admin/errores.ts porRevisar). */
function Globo({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="ml-1.5 rounded-full bg-error px-1.5 text-[11px] font-bold leading-[18px] text-on-accent">{n}</span>
  );
}

/** La barra lateral (escritorio). */
export function AdminSidebar({ errores = 0 }: { errores?: number }) {
  const activa = entradaDe(usePathname());
  const item = (e: { href: string; label: string }) => (
    <Link
      key={e.href}
      href={e.href}
      className={`flex items-center justify-between rounded-md px-3 py-[7px] text-sm font-medium transition-colors duration-200 ${
        activa === e.href ? "bg-ink text-on-accent" : "text-ink2 hover:bg-tile hover:text-ink"
      }`}
    >
      {e.label}
      {e.href === "/admin/errores" ? <Globo n={errores} /> : null}
    </Link>
  );
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-line bg-surface px-3 py-5 lg:flex">
      <Link href="/admin" className="px-3 pb-4 text-base font-bold tracking-[-0.02em] text-ink">
        stailist <span className="font-normal text-muted">· admin</span>
      </Link>
      <span className="px-3 pb-1 pt-3 text-[11px] uppercase tracking-[0.04em] text-faint">Leer</span>
      {ENTRADAS.filter((e) => e.grupo === "leer").map(item)}
      <span className="px-3 pb-1 pt-3 text-[11px] uppercase tracking-[0.04em] text-faint">Construir</span>
      {ENTRADAS.filter((e) => e.grupo === "construir").map(item)}
      <div className="flex-1" />
      {item({ href: "/admin/como-se-cuenta", label: "Cómo se cuenta" })}
      <Link href="/hoy" className="mt-2 border-t border-line2 px-3 pt-3 text-xs text-muted hover:text-ink">
        ← a la app
      </Link>
    </aside>
  );
}

/** La barra de arriba (celular): el menú en una línea que se desliza. */
export function AdminNavMovil({ errores = 0 }: { errores?: number }) {
  const activa = entradaDe(usePathname());
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface lg:hidden">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <Link href="/admin" className="shrink-0 text-sm font-bold text-ink">
          stailist <span className="font-normal text-muted">· admin</span>
        </Link>
        <nav className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[...ENTRADAS, { href: "/admin/como-se-cuenta", label: "Cómo se cuenta" }].map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className={`shrink-0 rounded-sm px-2.5 py-1 text-[13px] font-medium transition-colors duration-200 ${
                activa === e.href ? "bg-ink text-on-accent" : "text-muted hover:text-ink"
              }`}
            >
              {e.label}
              {e.href === "/admin/errores" ? <Globo n={errores} /> : null}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
