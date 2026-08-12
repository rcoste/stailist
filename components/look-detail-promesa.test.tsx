// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LookDetail } from "@/components/look-detail";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill: _f, sizes: _s, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));
// El corazón persiste con una server action; aquí solo estorba.
vi.mock("@/components/favorite-button", () => ({
  FavoriteButton: () => null,
}));

afterEach(cleanup);

// LA PROMESA DEL FIT CHECK es, desde el rediseño del home (2026-08-11), el
// único camino vivo hacia la señal de oro: la card "¿te lo pusiste ayer?" murió
// y la medición pasó a ser por cercanía (un fit check ≤24h después de un look).
// Si esta fila deja de dibujarse o de disparar el espejo, la métrica se va a
// cero en silencio — nada truena, simplemente deja de haber evidencia.
//
// Es OPCIONAL a propósito: el wow del onboarding y el historial pintan el mismo
// componente y ahí la oferta no aplica (en el wow todavía no hay app; en el
// historial el look ya pasó).

const base = {
  nombre: "Sastre Suelto de Noche",
  prendas: [{ id: "1", nombre: "camisa blanca", swatch: "#fff", imagen: null }],
  justificacion: "porque el gris carbón nunca falla cerca de tu cara",
  outfitId: "outfit-1",
  initialFavorited: false,
  voto: null,
  onVote: () => {},
  onOtroLook: () => {},
};

describe("LookDetail — la promesa del fit check", () => {
  it("ocupa la acción principal y dispara el espejo al tocarla", () => {
    const onFitCheck = vi.fn();
    render(<LookDetail {...base} onFitCheck={onFitCheck} />);
    fireEvent.click(screen.getByRole("button", { name: /te digo cómo te queda/i }));
    expect(onFitCheck).toHaveBeenCalledTimes(1);
  });

  it("es una OFERTA, no un favor: no pregunta si ya te lo pusiste", () => {
    // La card vieja preguntaba "¿te lo pusiste?" — un favor que casi nadie
    // contestaba, y encima justo al generar el look la respuesta ni existía.
    // El copy promete algo a cambio; si alguien lo revierte a pregunta o a
    // petición ("enséñame…"), esto truena.
    render(<LookDetail {...base} onFitCheck={() => {}} />);
    expect(screen.queryByText(/¿te lo pusiste/i)).toBeNull();
    expect(screen.getByText(/te digo cómo te queda/i)).toBeTruthy();
  });

  it("con fit check, 'otro look' cede su lugar", () => {
    // Regenerar no se pierde: el 👎 abre la hoja de razones que remata con
    // "Ver otro look", y el ✦ de la barra genera desde cualquier pantalla. Lo
    // que se quita es el atajo de pedir otro SIN decir por qué.
    render(<LookDetail {...base} onFitCheck={() => {}} />);
    expect(screen.queryByRole("button", { name: /otro look/i })).toBeNull();
    // El voto sigue en su sitio: es la otra mitad de la fila.
    expect(screen.getByRole("button", { name: /no me gusta este look/i })).toBeTruthy();
  });

  it("sin fit check (wow e historial) se conserva 'otro look'", () => {
    render(<LookDetail {...base} />);
    expect(screen.getByRole("button", { name: /otro look/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /te digo cómo te queda/i })).toBeNull();
  });
});

describe("LookDetail — el encabezado", () => {
  it("sin fecha, el nombre del look es el único titular", () => {
    // "hoy" sobre el look de hoy no le dice nada a nadie, y en 29px bold le
    // robaba el ancho al nombre hasta partirlo en dos líneas.
    render(<LookDetail {...base} />);
    expect(screen.getByRole("heading").textContent).toBe(base.nombre);
    expect(screen.queryByText(/^hoy$/i)).toBeNull();
  });

  it("con fecha, va como eyebrow — el titular sigue siendo el nombre", () => {
    render(<LookDetail {...base} seccionLabel="el jueves 13" />);
    expect(screen.getByRole("heading").textContent).toBe(base.nombre);
    expect(screen.getByText("el jueves 13")).toBeTruthy();
  });
});
