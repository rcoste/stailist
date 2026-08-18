// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checklist, type CatalogItem } from "./checklist";

afterEach(cleanup);

// EL CHECKLIST DEL ONBOARDING — lo que se blinda es QUÉ IDS VIAJAN a
// saveCloset y qué decide el CTA, no el markup.
//
// La pestaña "Trajes" (2026-08-17) metió tres decisiones de producto que un
// refactor puede romper sin que nada truene:
//  1. Un tap en la tarjeta del traje marca LAS DOS piezas (saco + pantalón) —
//     si solo viajara el saco, la regla `traje-desparejado` del motor volvería
//     a prohibirle su propio traje.
//  2. El pantalón del traje SÍ cuenta para el requisito de "Abajo" (countIn
//     sobre el catálogo completo): marcar el traje no debe mandarte a Abajo a
//     marcar otro pantalón.
//  3. El contador del chip "Abajo" NO cuenta esa pieza (countChip sobre
//     sueltas): un número en una pestaña sin tarjetas marcadas se lee como bug.

// Firma completa a propósito: con `vi.fn(async () => …)` el mock declara cero
// parámetros, `mock.calls` queda `[][]` y el `calls.at(-1)![0]` de abajo es un
// TS2493 que vitest no ve pero `next build` sí (el tsconfig incluye los tests).
const { saveCloset } = vi.hoisted(() => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- el parámetro tipa mock.calls
  saveCloset: vi.fn(async (_ids: number[]) => undefined as unknown as { error: string }),
}));
vi.mock("./actions", () => ({ saveCloset }));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill: _fill, sizes: _sizes, priority: _p, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

const CARBON = "c0a21321-b0de-4a11-9b71-000000000321";

const item = (
  id: number,
  name: string,
  category: string,
  conjunto?: string
): CatalogItem => ({
  id,
  name,
  category,
  attrs: conjunto ? { conjunto } : {},
  image_path: null,
});

// Catálogo mínimo con lo obligatorio + un traje (saco y pantalón atados).
const CATALOGO: CatalogItem[] = [
  item(1, "Camiseta blanca", "top"),
  item(9, "Jeans azul oscuro", "bottom"),
  item(13, "Tenis blancos", "calzado"),
  item(321, "Saco de traje gris carbón", "saco", CARBON),
  item(322, "Pantalón de traje gris carbón", "bottom", CARBON),
];

// Anclado al inicio y con dígitos opcionales: "Abajo" y "Abajo1" son el chip,
// pero "sigue con abajo" (el CTA) no. Sin el ancla, getByRole encontraba dos.
const chip = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`^${label}\\d*$`, "i") });

describe("la pestaña Trajes del checklist", () => {
  it("un tap marca el traje COMPLETO: las dos piezas viajan a saveCloset", async () => {
    const u = userEvent.setup();
    render(<Checklist catalog={CATALOGO} />);

    await u.click(screen.getByRole("button", { name: /camiseta blanca/i }));
    await u.click(chip("Abajo"));
    await u.click(screen.getByRole("button", { name: /jeans azul oscuro/i }));
    await u.click(chip("Zapatos"));
    await u.click(screen.getByRole("button", { name: /tenis blancos/i }));
    await u.click(chip("Trajes"));
    await u.click(screen.getByRole("button", { name: /traje gris carbón/i }));

    // Obligatorias cubiertas y la única opcional presente (Trajes) ya visitada
    // → el CTA es el envío.
    await u.click(screen.getByRole("button", { name: /armar mi primer look/i }));

    const ids = [...saveCloset.mock.calls.at(-1)![0]].sort((a, b) => a - b);
    expect(ids).toEqual([1, 9, 13, 321, 322]);
  });

  it("marcar el traje cubre 'Abajo': el CTA no te manda a marcar otro pantalón", async () => {
    const u = userEvent.setup();
    render(<Checklist catalog={CATALOGO} />);

    await u.click(screen.getByRole("button", { name: /camiseta blanca/i }));
    await u.click(chip("Zapatos"));
    await u.click(screen.getByRole("button", { name: /tenis blancos/i }));
    await u.click(chip("Trajes"));
    await u.click(screen.getByRole("button", { name: /traje gris carbón/i }));

    // El pantalón del traje satisface el requisito de bottom (countIn lee el
    // catálogo completo): el CTA ya no dice "sigue con abajo".
    expect(screen.queryByRole("button", { name: /sigue con abajo/i })).toBeNull();
    expect(screen.getByRole("button", { name: /armar mi primer look/i })).toBeTruthy();
  });

  it("el chip 'Abajo' NO cuenta la pieza del traje; el de 'Trajes' sí cuenta el traje", async () => {
    const u = userEvent.setup();
    render(<Checklist catalog={CATALOGO} />);

    await u.click(chip("Trajes"));
    await u.click(screen.getByRole("button", { name: /traje gris carbón/i }));

    // "Abajo" sin número (la pieza vive en la tarjeta del traje, no aquí) y
    // sin punto de pendiente (el requisito SÍ está cubierto).
    const abajo = chip("Abajo");
    expect(abajo.textContent).toBe("Abajo");
    expect(chip("Trajes").textContent).toContain("1");
  });

  it("sin pares atados no existe la pestaña Trajes", () => {
    render(<Checklist catalog={CATALOGO.filter((i) => !i.attrs.conjunto)} />);
    expect(screen.queryByRole("button", { name: /trajes/i })).toBeNull();
  });
});
