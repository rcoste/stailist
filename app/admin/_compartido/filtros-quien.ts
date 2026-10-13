import { banderaDe, paisEnPalabras } from "@/lib/lugar";

// LOS GRUPOS DE FILTRO DE "QUIÉN" (origen, país, onboarding), en la forma que
// pide `Filtros` del kit (app/admin/_ui). Embudo y Retención los pintan
// idénticos: una sola copia para que la lista de opciones no derive entre las
// dos pantallas, igual que `pasaFiltro` es una sola en lib/admin/filtro-personas.
// Es una función pura, no un componente: el kit es el único que pinta.

export type GrupoFiltro = { titulo: string; opciones: { href: string; label: string; activo: boolean }[] };

export function gruposDeQuien({
  origen,
  pais,
  onboarding,
  campanas,
  paises,
  href,
}: {
  origen: string;
  pais: string;
  /** La prueba A/B del onboarding con fotos (desde el 2026-10-12). */
  onboarding: string;
  campanas: string[];
  paises: string[];
  href: (cambio: { origen?: string; pais?: string; onboarding?: string }) => string;
}): GrupoFiltro[] {
  return [
    {
      titulo: "origen",
      opciones: [
        { valor: "todas", label: "todas" },
        { valor: "anuncios", label: "anuncios" },
        { valor: "organico", label: "sin anuncio" },
        ...campanas.map((c) => ({ valor: c, label: c })),
      ].map((o) => ({ href: href({ origen: o.valor }), label: o.label, activo: origen === o.valor })),
    },
    {
      titulo: "país",
      opciones: [
        { valor: "todos", label: "todos" },
        ...paises.map((p) => ({ valor: p, label: `${banderaDe(p) ?? ""} ${paisEnPalabras(p)}`.trim() })),
        { valor: "sin", label: "sin dato" },
      ].map((o) => ({ href: href({ pais: o.valor }), label: o.label, activo: pais === o.valor })),
    },
    {
      titulo: "onboarding",
      opciones: [
        { valor: "todas", label: "todas" },
        { valor: "basicos", label: "lista de básicos" },
        { valor: "fotos", label: "3 fotos" },
      ].map((o) => ({ href: href({ onboarding: o.valor }), label: o.label, activo: onboarding === o.valor })),
    },
  ];
}
