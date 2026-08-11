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
  | "chevron"
  | "expandir"
  | "persona"
  | "lupa"
  | "sliders"
  | "libro"
  | "hoja"
  | "luna"
  | "lapiz"
  | "globo"
  | "calendario"
  | "termo"
  | "ciudad"
  | "mochila"
  | "maleta"
  | "playa"
  | "descargar"
  | "enlace"
  | "filtro"
  | "flecha"
  | "menos"
  | "paleta"
  | "vestido"
  | "camisa"
  | "bookmark"
  | "bookmarkFill"
  | "microfono"
  | "paraguas"
  | "techo"
  | "cubiertos"
  | "copa"
  | "anillos"
  | "puntos";

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
  paleta: (
    <>
      <circle cx="9" cy="9" r="1.9" />
      <circle cx="15" cy="9" r="1.9" />
      <circle cx="9" cy="15" r="1.9" />
      <circle cx="15" cy="15" r="1.9" />
    </>
  ),
  sobre: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="M3.5 6.5L12 13l8.5-6.5" />
    </>
  ),
  mas: <path d="M12 5v14M5 12h14" />,
  // "Más opciones" del 4º slot de la tab bar. Puntos rellenos (no aro) para que
  // se lean a 24px; mismo tamaño que los círculos de `paleta`.
  puntos: (
    <>
      <circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
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
  expandir: <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />,
  persona: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  lupa: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-3.6-3.6" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  libro: (
    <>
      <path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5z" />
      <path d="M5 19.5A1.5 1.5 0 0 1 6.5 18H19v2H6.5A1.5 1.5 0 0 1 5 19.5z" />
    </>
  ),
  hoja: (
    <>
      <path d="M5 19c0-8 6-13 14-13 0 8-5 14-14 14z" />
      <path d="M5 19c2-5 5-7 9-9" />
    </>
  ),
  luna: <path d="M20 14.3A8 8 0 1 1 9.7 4a6.3 6.3 0 0 0 10.3 10.3z" />,
  lapiz: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </>
  ),
  menos: <path d="M5 12h14" />,
  globo: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.4 2.3 2.4 14.7 0 17M12 3.5c-2.4 2.3-2.4 14.7 0 17" />
    </>
  ),
  calendario: (
    <>
      <rect x="4" y="5.5" width="16" height="15" rx="1.5" />
      <path d="M4 10h16M8 3.5v4M16 3.5v4" />
    </>
  ),
  termo: <path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z" />,
  ciudad: (
    <>
      <path d="M3 20h18" />
      <path d="M5 20V9l5-2.5V20" />
      <path d="M10 20V11l6 2V20" />
      <path d="M7 12h0M7 15.5h0M13 15h0" />
    </>
  ),
  mochila: (
    <>
      <path d="M7 9a5 5 0 0 1 10 0v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" />
      <path d="M9.5 9V7.5a2.5 2.5 0 0 1 5 0V9" />
      <path d="M9 13h6" />
    </>
  ),
  maleta: (
    <>
      <rect x="5.5" y="8" width="13" height="12" rx="1.5" />
      <path d="M9.5 8V6.5A1.5 1.5 0 0 1 11 5h2a1.5 1.5 0 0 1 1.5 1.5V8" />
      <path d="M9.5 11.5v5M14.5 11.5v5" />
    </>
  ),
  playa: (
    <>
      <path d="M12 4a8 8 0 0 1 8 8H4a8 8 0 0 1 8-8z" />
      <path d="M12 12v7" />
      <path d="M12 19a2.2 2.2 0 0 0 3.2 0" />
    </>
  ),
  // "Guardar imagen" del Pasaporte: disquete con lente (no confundir con
  // `guardar`, que es el marcador de favoritos del historial).
  descargar: (
    <>
      <path d="M5 3h11l3 3v15H5z" />
      <path d="M8 3v6h7" />
      <circle cx="12" cy="15" r="2.5" />
    </>
  ),
  // "Copiar link": eslabones de cadena.
  enlace: (
    <>
      <path d="M10 13a4 4 0 0 0 5.7.4l2.3-2.3a4 4 0 0 0-5.7-5.7L11 6.5" />
      <path d="M14 11a4 4 0 0 0-5.7-.4L6 12.9a4 4 0 0 0 5.7 5.7L13 17.5" />
    </>
  ),
  // Embudo de filtros (fila de filtros del Historial).
  filtro: <path d="M3 5h18l-7 8v5l-4 2v-7z" />,
  // Flecha a la derecha (ruta del viaje: Tokio → Kioto → Osaka).
  flecha: <path d="M5 12h14M13 6l6 6-6 6" />,
  // Género (onboarding): vestido (mujer) y camisa (hombre).
  vestido: <path d="M12 3a3 3 0 0 1 3 3c0 1.5-1 2.5-1.5 4l3.5 8H7l3.5-8C10 8.5 9 7.5 9 6a3 3 0 0 1 3-3z" />,
  camisa: (
    <>
      <path d="M8 4h8v6l-1 11H9L8 10z" />
      <path d="M8 4l-1 4M16 4l1 4" />
    </>
  ),
  bookmark: <path d="M6 4h12v16l-6-4-6 4z" />,
  bookmarkFill: <path d="M6 4h12v16l-6-4-6 4z" fill="currentColor" />,
  // Dictado del wizard: el mic propio del campo abierto y su hoja "te escucho…".
  microfono: (
    <>
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5 11.5a7 7 0 0 0 14 0M12 18.5V21.5" />
    </>
  ),
  // "¿llevas paraguas?" — la lluvia que sí toca.
  paraguas: (
    <>
      <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5h-17A8.5 8.5 0 0 1 12 3.5z" />
      <path d="M12 12v6a2 2 0 0 0 4 0M12 3.5V2" />
    </>
  ),
  // "¿la lluvia te toca?" → techado: el plan transcurre bajo techo.
  techo: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5.5 9.5V20h13V9.5" />
    </>
  ),
  // Chips de plan social: cena, cita, boda (comida familiar reusa "techo" como
  // casa; trabajo reusa "maletin"; fiesta reusa "destello").
  cubiertos: (
    <>
      <path d="M7 2.5v6a2 2 0 0 0 2 2v11M9 2.5v5.5M5 2.5v5.5" />
      <path d="M17 2.5c-1.8 0-3 2.2-3 5.5v3.5h3v10" />
    </>
  ),
  copa: (
    <>
      <path d="M7 3h10c0 5.2-2.2 8.5-5 8.5S7 8.2 7 3z" />
      <path d="M12 11.5V20M8 20h8" />
    </>
  ),
  anillos: (
    <>
      <circle cx="9" cy="14" r="5.5" />
      <circle cx="15" cy="11" r="5.5" />
    </>
  ),
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
