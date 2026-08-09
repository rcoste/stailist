"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { MoreSheet } from "@/components/more-sheet";
import type { TripContext } from "@/lib/trip-context";

// Tres destinos + "Más" + un botón central de ACCIÓN (Generar). El centro no es
// una pestaña: es el botón estrella que dispara la generación de outfit.
// Perfil salió de aquí a un ícono en el header. "Hoy" es tu home (lugar), el
// botón central es la acción — no se pisan.
//
// El 4º slot dejó de ser Viaje y pasó a "Más" (hoja de acciones + lugares): la
// medición mostró que modo tienda estaba a 4 taps y Cartera a 3, detrás de una
// pestaña de Perfil llamada "estilo" que no las nombra. Viaje se mudó adentro
// de la hoja, con estado vivo y aviso en el botón cuando hay viaje cerca.
// `match` (opcional) = prefijo para marcar la pestaña activa, cuando difiere del
// destino.
const TABS: {
  href: string;
  label: string;
  icon: IconName;
  match?: string;
  extra?: string[];
}[] = [
  { href: "/hoy", label: "Hoy", icon: "sol" },
  // Wishlist es una sub-sección del clóset (tab), así que la pestaña Clóset se
  // queda activa también en /wishlist.
  { href: "/closet", label: "Clóset", icon: "gancho", extra: ["/wishlist"] },
  { href: "/historial", label: "Historial", icon: "reloj" },
];

// Rutas que viven dentro de la hoja "Más": estando en ellas, el slot se pinta
// activo (si no, la barra no marcaría nada y se siente fuera de lugar).
const EN_MAS = ["/viaje", "/cartera"];

export function TabBar({ userId, trip }: { userId: string; trip: TripContext | null }) {
  const pathname = usePathname();
  const router = useRouter();

  // Dos pestañas a la izquierda; una + "Más" a la derecha del botón central.
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);
  const masActivo = EN_MAS.some((p) => pathname.startsWith(p));

  const tab = (
    href: string,
    label: string,
    icon: IconName,
    match?: string,
    extra?: string[]
  ) => {
    const active =
      pathname.startsWith(match ?? href) ||
      (extra?.some((e) => pathname.startsWith(e)) ?? false);
    // TOCAR LA PESTAÑA ACTIVA VUELVE A LA RAÍZ DE LA SECCIÓN — la convención
    // que todo el mundo intenta por instinto. En /hoy importa de verdad: con
    // look del día la pantalla entra directa al look y tocar "Hoy" no hacía
    // NADA (misma URL, mismo estado), así que la home quedaba inalcanzable.
    // El parámetro es lo que deja pedirla: hoy-client lo lee y abre la home en
    // vez del look.
    const destino = active && href === "/hoy" ? "/hoy?inicio=1" : href;
    return (
      <Link
        key={href}
        href={destino}
        className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors duration-200 ${
          active ? "text-accent" : "text-muted hover:text-ink"
        }`}
      >
        <Icon name={icon} active={active} />
        {label}
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="flex items-stretch">
        {left.map((t) => tab(t.href, t.label, t.icon, t.match, t.extra))}

        {/* Botón central: la acción estrella (Generar). Elevado sobre la barra.
            Es un botón (no Link) con timestamp para que SIEMPRE re-dispare el
            form, aun si ya estás en /hoy?generar (la URL cambia → remonta). */}
        <div className="flex w-16 shrink-0 items-start justify-center">
          <button
            type="button"
            onClick={() => router.push(`/hoy?generar=${Date.now()}`)}
            aria-label="Generar un outfit"
            data-hint-target="fab-generar"
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_6px_18px_-6px_rgba(10,10,10,0.5)] ring-4 ring-bg transition-colors duration-200 hover:bg-accent-deep"
          >
            <Icon name="destello" size={24} />
          </button>
        </div>

        {right.map((t) => tab(t.href, t.label, t.icon, t.match, t.extra))}
        <MoreSheet userId={userId} trip={trip} active={masActivo} />
      </div>
    </nav>
  );
}
