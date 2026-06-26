"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";

// Cuatro destinos + un botón central de ACCIÓN (Generar). El centro no es una
// pestaña: es el botón estrella que dispara la generación de outfit (hoy/ocasión).
// Perfil salió de aquí a un ícono en el header. "Hoy" es tu home (lugar), el
// botón central es la acción — no se pisan.
// `match` (opcional) = prefijo para marcar la pestaña activa, cuando difiere del
// destino. Viaje aterriza en el home (/viaje/lista: nueva maleta + historial),
// pero sigue activa en todo /viaje* (wizard, detalle).
const TABS: { href: string; label: string; icon: IconName; match?: string }[] = [
  { href: "/hoy", label: "Hoy", icon: "sol" },
  { href: "/closet", label: "Clóset", icon: "gancho" },
  // Orden por frecuencia de uso: Historial (revisar/re-usar looks) va antes que
  // Viaje (episódico, solo al viajar) → Historial en el slot interior, Viaje en la esquina.
  { href: "/historial", label: "Historial", icon: "reloj" },
  { href: "/viaje/lista", label: "Viaje", icon: "maletin", match: "/viaje" },
];

export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();

  // Dos pestañas a cada lado del botón central.
  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  const tab = (href: string, label: string, icon: IconName, match?: string) => {
    const active = pathname.startsWith(match ?? href);
    return (
      <Link
        key={href}
        href={href}
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
    <nav className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch">
        {left.map((t) => tab(t.href, t.label, t.icon, t.match))}

        {/* Botón central: la acción estrella (Generar). Elevado sobre la barra.
            Es un botón (no Link) con timestamp para que SIEMPRE re-dispare el
            form, aun si ya estás en /hoy?generar (la URL cambia → remonta). */}
        <div className="flex w-16 shrink-0 items-start justify-center">
          <button
            type="button"
            onClick={() => router.push(`/hoy?generar=${Date.now()}`)}
            aria-label="Generar un outfit"
            className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_6px_18px_-6px_rgba(10,10,10,0.5)] ring-4 ring-bg transition-colors duration-200 hover:bg-accent-deep"
          >
            <Icon name="destello" size={24} />
          </button>
        </div>

        {right.map((t) => tab(t.href, t.label, t.icon, t.match))}
      </div>
    </nav>
  );
}
