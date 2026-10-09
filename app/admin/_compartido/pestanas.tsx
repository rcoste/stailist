import Link from "next/link";

// LAS PESTAÑAS DE UNA SECCIÓN DEL ADMIN (replanteo del 2026-10-09). Una entrada
// del menú puede tener dos vistas de la misma pregunta: Embudo y retención
// (¿dónde se pierden y quién vuelve?), Personas (la lista y la actividad). Son
// enlaces, sin JavaScript: cada pestaña es una URL que se puede guardar.
export function Pestanas({
  pestanas,
  activa,
  sufijo = "",
}: {
  pestanas: { href: string; label: string }[];
  activa: string;
  /** Los filtros vigentes ("?dias=30&origen=…"), para que cambiar de pestaña no los pierda. */
  sufijo?: string;
}) {
  return (
    <nav className="flex gap-1 border-b border-line">
      {pestanas.map((p) => (
        <Link
          key={p.href}
          href={`${p.href}${sufijo}`}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-200 ${
            p.href === activa ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}

export const PESTANAS_EMBUDO = [
  { href: "/admin/embudo", label: "Embudo" },
  { href: "/admin/retencion", label: "Retención" },
];

export const PESTANAS_PERSONAS = [
  { href: "/admin/usuarios", label: "Lista" },
  { href: "/admin/actividad", label: "Actividad" },
];
