// @vitest-environment jsdom
//
// EL QUE DECIDE, EN CADA CAMBIO DE RUTA, SI LAS ETIQUETAS VIVEN.
//
// La promesa que blinda: "cuando entras a la app, las etiquetas se apagan" (aviso
// de privacidad). Las salidas conocidas ya son navegación completa
// (salirSinEtiquetas); este componente convierte los links que salen de la zona
// y, como red, recarga si las etiquetas siguen vivas fuera de ella. Y la otra
// cara: si nunca se cargaron, recargar sería un bucle.
//
// Se simulan las funciones del navegador de lib/publicidad (ya probadas en
// lib/publicidad-navegador.test.ts); `rutaMedible` se queda REAL: qué ruta se
// mide es justo la decisión que viaja por aquí.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TagsPublicidad } from "./tags-publicidad";

const nav = vi.hoisted(() => ({ ruta: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.ruta }));

const pub = vi.hoisted(() => ({
  cargarEtiquetas: vi.fn((): boolean => true),
  etiquetasCargadas: vi.fn((): boolean => false),
  permitidoEnEsteNavegador: vi.fn((): boolean => true),
  registrarConversion: vi.fn((_tipo: "registro" | "primer_look"): boolean => true),
  registrarVista: vi.fn((): void => {}),
  salirSinEtiquetas: vi.fn((_href: string): boolean => true),
  tomarConversionPendiente: vi.fn((): "registro" | "primer_look" | null => null),
}));
vi.mock("@/lib/publicidad", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/publicidad")>()),
  ...pub,
}));

const reload = vi.fn(() => {});

beforeEach(() => {
  for (const f of Object.values(pub)) f.mockClear();
  pub.cargarEtiquetas.mockReturnValue(true);
  pub.etiquetasCargadas.mockReturnValue(false);
  pub.permitidoEnEsteNavegador.mockReturnValue(true);
  pub.tomarConversionPendiente.mockReturnValue(null);
  reload.mockClear();
  vi.stubGlobal("location", {
    ...window.location,
    reload,
    href: "http://localhost:3000/onboarding/wow",
    origin: "http://localhost:3000",
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TagsPublicidad", () => {
  it("del onboarding a /hoy con etiquetas vivas: recarga para soltarlas", () => {
    nav.ruta = "/onboarding/wow";
    const { rerender } = render(<TagsPublicidad />);
    expect(pub.cargarEtiquetas).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();

    pub.etiquetasCargadas.mockReturnValue(true);
    nav.ruta = "/hoy";
    rerender(<TagsPublicidad />);

    expect(reload).toHaveBeenCalledTimes(1);
    // Dentro de la app no se intenta cargar ni medir nada.
    expect(pub.cargarEtiquetas).toHaveBeenCalledTimes(1);
    expect(pub.registrarVista).toHaveBeenCalledTimes(1);
  });

  it("en la zona medida, si ya no se permite (acaba de declarar 13-17 años): recarga para soltarlas y no mide", () => {
    nav.ruta = "/onboarding/objetivo";
    pub.etiquetasCargadas.mockReturnValue(true);
    pub.permitidoEnEsteNavegador.mockReturnValue(false);
    render(<TagsPublicidad />);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(pub.registrarVista).not.toHaveBeenCalled();
  });

  it("fuera de la zona sin etiquetas cargadas no recarga (no hay bucle), y la conversión pendiente espera a la zona medida", () => {
    nav.ruta = "/onboarding/gustos";
    pub.tomarConversionPendiente.mockReturnValue("registro");
    render(<TagsPublicidad />);

    expect(reload).not.toHaveBeenCalled();
    expect(pub.tomarConversionPendiente).not.toHaveBeenCalled();
    expect(pub.registrarConversion).not.toHaveBeenCalled();
  });

  it("en la zona medida: la conversión pendiente sólo sale si las etiquetas cargaron", () => {
    nav.ruta = "/onboarding/objetivo";
    pub.tomarConversionPendiente.mockReturnValue("registro");
    render(<TagsPublicidad />);
    expect(pub.registrarVista).toHaveBeenCalledTimes(1);
    expect(pub.registrarConversion).toHaveBeenCalledWith("registro");

    cleanup();
    for (const f of Object.values(pub)) f.mockClear();
    // Botón de /privacidad o GPC: cargarEtiquetas se niega.
    pub.cargarEtiquetas.mockReturnValue(false);
    pub.tomarConversionPendiente.mockReturnValue("registro");
    render(<TagsPublicidad />);
    expect(pub.tomarConversionPendiente).toHaveBeenCalledTimes(1);
    expect(pub.registrarVista).not.toHaveBeenCalled();
    expect(pub.registrarConversion).not.toHaveBeenCalled();
  });

  it("con etiquetas vivas, un link que sale de la zona (el try-on del wow) se vuelve navegación completa; uno que se queda, no", () => {
    nav.ruta = "/onboarding/wow";
    pub.etiquetasCargadas.mockReturnValue(true);
    render(
      <>
        <TagsPublicidad />
        <a href="/perfil/avatar?return=%2Fonboarding%2Fwow">avatar</a>
        <a href="/onboarding/objetivo">objetivo</a>
      </>
    );

    // fireEvent devuelve false cuando el clic quedó cancelado: el router no llega a moverse.
    expect(fireEvent.click(screen.getByText("avatar"))).toBe(false);
    expect(pub.salirSinEtiquetas).toHaveBeenCalledWith("/perfil/avatar?return=%2Fonboarding%2Fwow");

    pub.salirSinEtiquetas.mockClear();
    fireEvent.click(screen.getByText("objetivo"));
    expect(pub.salirSinEtiquetas).not.toHaveBeenCalled();
  });

  it("sin etiquetas cargadas los links no se tocan", () => {
    nav.ruta = "/onboarding/wow";
    render(
      <>
        <TagsPublicidad />
        <a href="/hoy">hoy</a>
      </>
    );

    expect(fireEvent.click(screen.getByText("hoy"))).toBe(true);
    expect(pub.salirSinEtiquetas).not.toHaveBeenCalled();
  });
});
