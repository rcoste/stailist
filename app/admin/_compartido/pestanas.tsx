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
    <nav className="flex flex-wrap gap-1.5">
      {pestanas.map((p) => (
        <Link
          key={p.href}
          href={`${p.href}${sufijo}`}
          // Como los botones del menú: Roberto no reconocía la pestaña
          // subrayada como algo que se pica (2026-10-12).
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
            p.href === activa ? "border-ink bg-ink text-on-accent" : "border-line bg-surface text-ink hover:border-ink"
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

// Actividad primero: es la vista que más se usa.
export const PESTANAS_PERSONAS = [
  { href: "/admin/actividad", label: "Actividad" },
  { href: "/admin/usuarios", label: "Lista" },
];
