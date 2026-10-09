import Link from "next/link";
import { banderaDe, paisEnPalabras } from "@/lib/lugar";

/** Una fila de filtros como enlaces: cada chip es una URL, sin JavaScript. */
export function Chips({
  titulo,
  opciones,
}: {
  titulo: string;
  opciones: { href: string; label: string; activo: boolean }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-14 shrink-0 text-xs text-muted">{titulo}</span>
      {opciones.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          className={`rounded-full border px-2.5 py-1 text-xs ${
            o.activo ? "border-ink bg-ink text-on-accent" : "border-line bg-surface text-ink hover:border-ink"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

/** Los chips de origen y país, iguales en el embudo y en la retención. */
export function ChipsQuien({
  origen,
  pais,
  campanas,
  paises,
  href,
}: {
  origen: string;
  pais: string;
  campanas: string[];
  paises: string[];
  href: (cambio: { origen?: string; pais?: string }) => string;
}) {
  return (
    <>
      <Chips
        titulo="origen"
        opciones={[
          { valor: "todas", label: "todas" },
          { valor: "anuncios", label: "anuncios" },
          { valor: "organico", label: "sin anuncio" },
          ...campanas.map((c) => ({ valor: c, label: c })),
        ].map((o) => ({ href: href({ origen: o.valor }), label: o.label, activo: origen === o.valor }))}
      />
      <Chips
        titulo="país"
        opciones={[
          { valor: "todos", label: "todos" },
          ...paises.map((p) => ({ valor: p, label: `${banderaDe(p) ?? ""} ${paisEnPalabras(p)}`.trim() })),
          { valor: "sin", label: "sin dato" },
        ].map((o) => ({ href: href({ pais: o.valor }), label: o.label, activo: pais === o.valor }))}
      />
    </>
  );
}
