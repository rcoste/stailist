// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { UltimoLookCard } from "@/components/ultimo-look-card";
import type { UltimoLook } from "@/lib/ultimo-look";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill: _fill, sizes: _sizes, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

afterEach(cleanup);

// Las DOS funciones de fecha de la card (relativoCreado y subtitulo) no están
// exportadas —viven dentro del componente—, así que se ejercitan por render.
//
// Lo que blindan: la card es lo primero que se lee del home y sus fechas son
// LOCALES a propósito. `creadoEn` llega en UTC del server, y `fecha` es un
// YYYY-MM-DD que hay que leer como día PURO: parsearlo con new Date("2026-08-11")
// lo tomaría como medianoche UTC y, de tarde en México, el look de hoy diría
// "mañana". Los casos hoy/ayer/mañana son justo donde eso se nota.

// nbsp → espacio (la card separa el subtítulo del "ver el look" con espacios
// duros) y acentos en una sola forma.
const texto = (c: HTMLElement) =>
  (c.textContent ?? "").normalize("NFC").replace(/\u00a0/g, " ");
const n = (s: string) => s.normalize("NFC");

// Mediodía local: inmune al horario de verano al sumar o restar días.
const alMediodia = (offsetDias: number) => {
  const h = new Date();
  return new Date(h.getFullYear(), h.getMonth(), h.getDate() + offsetDias, 12);
};
const clave = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const base: UltimoLook = {
  id: "look-1",
  nombre: "Sastre Suelto de Noche",
  ocasion: "oficina",
  fecha: null,
  creadoEn: alMediodia(-1).toISOString(),
  retrato: null,
  prendas: [],
};

describe("la tira de prendas de UltimoLookCard", () => {
  // La decisión medida del fix de 2026-08-17: los 70px del handoff se
  // diseñaron con CINCO prendas (celdas casi cuadradas); con 3, la celda
  // quedaba 113×70 y el object-cover decapitaba la prenda (~40% de recorte).
  // Con ≤3 la tira crece a 96px (h-24) y el recorte baja a ~15%.
  const prendas = (n: number) => Array.from({ length: n }, (_, i) => `/p${i}.png`);

  it("con 3 prendas o menos, la celda es alta (h-24)", () => {
    const { container } = render(
      <UltimoLookCard look={{ ...base, prendas: prendas(3) }} onVer={() => {}} />
    );
    expect(container.querySelectorAll(".h-24").length).toBe(3);
    expect(container.querySelectorAll(".h-\\[70px\\]").length).toBe(0);
  });

  it("con 4 o más, la celda del handoff (70px)", () => {
    const { container } = render(
      <UltimoLookCard look={{ ...base, prendas: prendas(5) }} onVer={() => {}} />
    );
    expect(container.querySelectorAll(".h-\\[70px\\]").length).toBe(5);
    expect(container.querySelectorAll(".h-24").length).toBe(0);
  });
});

describe("las fechas de UltimoLookCard", () => {
  it("dice ayer cuando fue ayer, y el día del mes cuando fue antes", () => {
    const ayer = render(<UltimoLookCard look={base} onVer={() => {}} />);
    expect(texto(ayer.container)).toContain("creado ayer");
    ayer.unmount();

    // Cinco días atrás ya no es ni hoy ni ayer: nombra el día.
    const viejo = alMediodia(-5);
    const antes = render(
      <UltimoLookCard
        look={{ ...base, creadoEn: viejo.toISOString() }}
        onVer={() => {}}
      />
    );
    const t = texto(antes.container);
    expect(t).not.toContain("creado hoy");
    expect(t).not.toContain("creado ayer");
    expect(t).toMatch(new RegExp(`creado el \\S+ ${viejo.getDate()}(?!\\d)`));
  });

  it("sin fecha el subtítulo es solo la ocasión — no inventa ningún día", () => {
    const { container } = render(
      <UltimoLookCard look={{ ...base, fecha: null }} onVer={() => {}} />
    );
    const t = texto(container);
    // "oficina" es la clave del motor; la card habla en la voz del producto.
    expect(t).toContain("trabajo");
    expect(t).not.toContain("oficina");
    // Ni "hoy", ni "mañana", ni un número de día: no hay fecha que contar.
    expect(t).not.toContain("hoy");
    expect(t).not.toContain(n("mañana"));
    expect(t).not.toMatch(/\d/);
  });

  it("un look de hoy dice hoy, uno de mañana dice mañana, y otro su día", () => {
    const hoy = render(
      <UltimoLookCard look={{ ...base, fecha: clave(alMediodia(0)) }} onVer={() => {}} />
    );
    expect(texto(hoy.container)).toContain("trabajo · hoy");
    hoy.unmount();

    const manana = render(
      <UltimoLookCard look={{ ...base, fecha: clave(alMediodia(1)) }} onVer={() => {}} />
    );
    expect(texto(manana.container)).toContain(n("trabajo · mañana"));
    manana.unmount();

    const otroDia = alMediodia(4);
    const otro = render(
      <UltimoLookCard look={{ ...base, fecha: clave(otroDia) }} onVer={() => {}} />
    );
    expect(texto(otro.container)).toMatch(
      new RegExp(`trabajo · \\S+ ${otroDia.getDate()}(?!\\d)`)
    );
  });
});
