// Set de íconos de línea propio (rebrand v2 — adiós emoji). viewBox 24, fill
// none, stroke currentColor, trazo 1.6 (2.2 activo), caps/joins redondeados.
// Glifos fieles al handoff (ui_kits/app/primitives.jsx). Hereda color del texto.
import type { JSX } from "react";

export type IconName =
  | "sol"
  | "gancho"
  | "reloj"
  | "equis"
  | "corazon"
  | "check"
  | "destello"
  | "sobre"
  | "mas"
  | "camara"
  | "pulgar"
  | "estrella"
  | "prohibido"
  | "repetir"
  | "guardar"
  | "compartir"
  | "candado"
  | "ubicacion"
  | "maletin"
  | "avion"
  | "copo"
  | "lluvia"
  | "chevron";

const GLYPHS: Record<IconName, JSX.Element> = {
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </>
  ),
  gancho: <path d="M12 7a2 2 0 1 1 2-2 M12 7l-9 8h18l-9-8z" />,
  reloj: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  equis: <path d="M6 6l12 12M18 6L6 18" />,
  corazon: <path d="M12 20s-7-4.4-7-9.4A3.6 3.6 0 0 1 12 7a3.6 3.6 0 0 1 7 3.6c0 5-7 9.4-7 9.4z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  destello: <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" />,
  sobre: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3.5 6.5L12 13l8.5-6.5" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
  camara: (
    <>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="13" r="3.2" />
    </>
  ),
  pulgar: <path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM7 11l4-7a2 2 0 0 1 2 1.3V9h5.2a1.8 1.8 0 0 1 1.8 2.2l-1.4 6.5A2 2 0 0 1 16.6 20H7z" />,
  estrella: <path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 .97 5.7L12 16.6 6.93 19.3l.97-5.7-4.1-4 5.7-.8z" />,
  prohibido: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </>
  ),
  repetir: (
    <>
      <path d="M4 12a8 8 0 0 1 13.7-5.7L20 8" />
      <path d="M20 4v4h-4" />
      <path d="M20 12a8 8 0 0 1-13.7 5.7L4 16" />
      <path d="M4 20v-4h4" />
    </>
  ),
  guardar: <path d="M6 4h12v16l-6-4-6 4z" />,
  compartir: (
    <>
      <path d="M12 14V4" />
      <path d="M8.5 7L12 3.5 15.5 7" />
      <path d="M7 11H5.5A1.5 1.5 0 0 0 4 12.5v6A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 18.5 11H17" />
    </>
  ),
  candado: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  ubicacion: (
    <>
      <path d="M12 21s7-5.6 7-11a7 7 0 0 0-14 0c0 5.4 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  maletin: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="1.5" />
      <path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8" />
      <path d="M3 13h18" />
    </>
  ),
  avion: <path d="M21 15.5l-7.5-3.7V5.2a1.5 1.5 0 0 0-3 0v6.6L3 15.5v2l7.5-2.3V19l-2 1.4V22l3.5-1 3.5 1v-1.6L13.5 19v-3.8l7.5 2.3z" />,
  copo: <path d="M12 3v18M3.6 7.5l16.8 9M20.4 7.5l-16.8 9" />,
  lluvia: (
    <>
      <path d="M7 15.5a4.2 4.2 0 0 1-.5-8.4 6 6 0 0 1 11.5 1.2A3.7 3.7 0 0 1 17.5 15.5z" />
      <path d="M8 18.5l-1 2M12 18.5l-1 2M16 18.5l-1 2" />
    </>
  ),
  chevron: <path d="M9 6l6 6-6 6" />,
};

export function Icon({
  name,
  size = 22,
  active = false,
  rotate = 0,
  strokeWidth,
  className,
}: {
  name: IconName;
  size?: number;
  active?: boolean;
  rotate?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? (active ? 2.2 : 1.6)}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
      className={className}
      aria-hidden="true"
    >
      {GLYPHS[name]}
    </svg>
  );
}
