"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./logo";
import { Icon } from "./icon";

// Header de app para desktop (lg+). Sustituye a la tab bar inferior en pantallas
// grandes: logo | tabs de texto | ✨ Generar + perfil. Editorial (cabecera de
// revista), coherente con el header de la landing. En móvil no existe (lg:block).
// El activo se marca con subrayado fino — mismo lenguaje que la landing.

const TABS: { href: string; label: string; match: string; extra?: string[] }[] = [
  { href: "/hoy", label: "Hoy", match: "/hoy" },
  { href: "/closet", label: "Clóset", match: "/closet", extra: ["/wishlist"] },
  { href: "/historial", label: "Historial", match: "/historial" },
  { href: "/viaje/lista", label: "Viaje", match: "/viaje" },
];

export function DesktopHeader() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-40 hidden border-b border-line bg-bg lg:block">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-8 px-6">
        <Link href="/hoy" aria-label="Ir a Hoy" className="shrink-0">
          <Logo className="h-6" />
        </Link>

        <nav aria-label="Secciones" className="flex items-center gap-6">
          {TABS.map((t) => {
            const active =
              pathname.startsWith(t.match) ||
              (t.extra ?? []).some((e) => pathname.startsWith(e));
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`text-sm transition-colors duration-200 ${
                  active
                    ? "font-semibold text-ink underline decoration-1 underline-offset-8"
                    : "font-medium text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {/* Misma semántica que el FAB móvil: re-dispara el wizard aunque ya
              estés en /hoy (timestamp → la URL cambia → remonta). */}
          <button
            type="button"
            onClick={() => router.push(`/hoy?generar=${Date.now()}`)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            <Icon name="destello" size={15} />
            Generar
          </button>
          <Link
            href="/perfil"
            aria-label="Tu perfil"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors duration-200 hover:text-ink"
          >
            <Icon name="persona" size={17} />
          </Link>
        </div>
      </div>
    </header>
  );
}
