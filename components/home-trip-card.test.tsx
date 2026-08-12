// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { HomeTripCard } from "@/components/home-trip-card";
import type { HomeTrip } from "@/lib/home-trip";

// next/image y next/link piden infraestructura de Next que en jsdom no existe;
// aquí solo importa QUÉ imagen y QUÉ destino salen, no cómo los sirve el framework.
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill: _fill, sizes: _sizes, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

// Lo que este test blinda no es el markup: es la PROMESA que la card le hace a
// la persona antes del tap. Tres decisiones de producto, y las tres se leen
// distinto según el dato:
// 1. Sin maleta la card invita a armarla; con maleta dice cuánto falta.
// 2. El plural ("te falta 1 artículo" vs "faltan 3 artículos") — la card sale
//    todos los días y un "faltan 1 artículos" se ve barato.
// 3. El plazo de compra: a un viaje que es mañana no se le dice "antes del
//    viernes"; se le dice hoy.

// El texto de la card, normalizado en dos ejes, porque los dos dan falsos rojos
// (y en las aserciones negativas, falsos VERDES, que es peor):
// · nbsp → espacio: la card pega la acción con espacios duros a propósito
//   ("consíguelos hoy →") para que el plazo y la flecha no caigan
//   solos en el segundo renglón. En pantalla se ve un espacio; para JS no lo es.
// · NFC: un acento compuesto y uno descompuesto se ven idénticos y no son
//   iguales.
const texto = (c: HTMLElement) =>
  (c.textContent ?? "").normalize("NFC").replace(/\u00a0/g, " ");
const n = (s: string) => s.normalize("NFC");

const base: HomeTrip = {
  lugar: "Cancún",
  dias: 3,
  href: "/viaje/lista",
  maletaLista: false,
  faltan: 0,
  fechaInicio: "2026-08-14", // viernes
  ocasiones: ["playa"],
};

describe("HomeTripCard", () => {
  it("sin maleta invita a armarla y lleva a la lista", () => {
    // Sin ocasiones: si la foto sale bien, es porque se leyó el NOMBRE.
    const { container } = render(<HomeTripCard trip={{ ...base, ocasiones: [] }} />);
    expect(within(container).getByText(/arma la maleta/i)).toBeTruthy();
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/viaje/lista");
    // Sin maleta no hay nada que contar: no se anuncia ningún faltante.
    expect(texto(container)).not.toMatch(/falta/i);
    // La foto sale del NOMBRE del lugar (Cancún → la playa genérica). Que
    // destino-imagen elija bien no sirve si la card no le pasa el lugar.
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/destinos/playa.webp"
    );
  });

  it("con UN faltante habla en singular", () => {
    const { container } = render(
      <HomeTripCard
        trip={{ ...base, href: "/viaje/t1", maletaLista: true, faltan: 1 }}
      />
    );
    expect(texto(container)).toContain(n("te falta 1 artículo"));
    expect(texto(container)).toContain(n("consíguelo"));
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/viaje/t1");
  });

  it("con varios faltantes habla en plural y pone plazo al día del viaje", () => {
    const { container } = render(
      <HomeTripCard
        trip={{ ...base, href: "/viaje/t1", maletaLista: true, faltan: 3 }}
      />
    );
    expect(texto(container)).toContain(n("faltan 3 artículos"));
    // El plazo sale de fechaInicio (viernes 14), no del día de hoy.
    expect(texto(container)).toContain(n("consíguelos antes del viernes"));
  });

  it("maleta cubierta: ya no pide nada, solo ofrece verla", () => {
    const { container } = render(
      <HomeTripCard
        trip={{
          ...base,
          href: "/viaje/t1",
          maletaLista: true,
          faltan: 0,
          // Un destino que no está en el set: la foto tiene que salir de las
          // ocasiones, no del genérico de ciudad.
          lugar: "Chiapas",
        }}
      />
    );
    expect(texto(container)).toContain("todo cubierto");
    expect(texto(container)).toContain("ver tu maleta");
    // Nombre desconocido: la foto cae en las ocasiones que la persona marcó.
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/destinos/playa.webp"
    );
    expect(texto(container)).not.toMatch(new RegExp(n("consígue"), "i"));
  });

  it("la cercanía cambia el encabezado y mata el plazo imposible", () => {
    const conMaleta = { ...base, href: "/viaje/t1", maletaLista: true, faltan: 2 };
    // La cuenta sale de `fechaInicio` con el reloj del DISPOSITIVO, no del prop
    // `dias` (que viene del server en UTC y a las 18:00 de CDMX ya se adelantó
    // un día). Por eso los casos se arman con fechas locales reales: pasar
    // `dias: 0` con una fecha de la próxima semana ya no engaña al componente.
    const enLocal = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      const p = (x: number) => String(x).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };

    const enCurso = render(
      <HomeTripCard trip={{ ...conMaleta, dias: 0, fechaInicio: enLocal(0) }} />
    );
    expect(texto(enCurso.container)).toContain("viaje · en curso");
    expect(texto(enCurso.container)).toContain(n("consíguelos hoy"));
    enCurso.unmount();

    const manana = render(
      <HomeTripCard trip={{ ...conMaleta, dias: 1, fechaInicio: enLocal(1) }} />
    );
    expect(texto(manana.container)).toContain(n("viaje · mañana"));
    // "antes del viernes" para un viaje que sale mañana es un regaño imposible.
    expect(texto(manana.container)).toContain(n("consíguelos hoy"));
    manana.unmount();

    const lejos = render(
      <HomeTripCard trip={{ ...conMaleta, dias: 5, fechaInicio: enLocal(5) }} />
    );
    expect(texto(lejos.container)).toContain(n("viaje · en 5 días"));
    expect(texto(lejos.container)).toContain("antes del");
    lejos.unmount();

    // Fuera de ventana con la fecha REAL: el colchón del server dejó pasar un
    // viaje a 8 días y aquí NO se anuncia (la card entera desaparece).
    const fuera = render(
      <HomeTripCard trip={{ ...conMaleta, dias: 7, fechaInicio: enLocal(8) }} />
    );
    expect(texto(fuera.container)).toBe("");
  });
});
