// @vitest-environment jsdom
//
// EL LISTADO DE USUARIOS DEL ADMIN — lo que se blinda es A DÓNDE navega un
// click, y cuántas navegaciones dispara.
//
// Dos bugs de la misma familia (Roberto, 2026-08-13): sólo el correo era
// clickeable (picarle a cualquier otra celda "no hacía nada"), y el detalle
// tarda segundos porque firma las URLs de TODO su clóset, así que el click sin
// acuse invitaba a picarle otra vez — y cada tap encolaba otro `router.push`.
//
// El markup de la tabla (columnas, orden, filtros) cambia seguido; lo que no
// puede cambiar en silencio es que la fila entera navegue una sola vez al
// usuario correcto.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UsuariosTable, type UserRow } from "@/app/admin/usuarios/usuarios-table";

afterEach(cleanup);

const { push } = vi.hoisted(() => ({ push: vi.fn((_url: string) => {}) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/admin/usuarios",
  useSearchParams: () => new URLSearchParams(),
}));

const NOW = 1_760_000_000_000;

const usuario = (over: Partial<UserRow> = {}): UserRow => ({
  id: "u1",
  email: "tatiana@example.com",
  isAdmin: false,
  onboardingStep: 5,
  onboardingDone: true,
  color: true,
  avatar: true,
  capsula: false,
  closet: 42,
  closetPhotos: 3,
  looks: 7,
  viaje: 0,
  cartera: 0,
  worn: 2,
  votes: 4,
  lastActive: NOW - 60_000,
  ...over,
});

const otra = usuario({ id: "u2", email: "andy@example.com", worn: 0 });

/** La celda de "clóset" — o sea, cualquier parte de la fila que NO sea el correo. */
const celdaCualquiera = (email: string) =>
  screen.getByText(email).closest("tr")!.querySelectorAll("td")[4];

beforeEach(() => push.mockClear());

describe("UsuariosTable — la fila entera abre el perfil", () => {
  it("picarle a una celda que no es el correo navega al detalle de ESE usuario", () => {
    render(<UsuariosTable rows={[usuario(), otra]} now={NOW} />);

    fireEvent.click(celdaCualquiera("andy@example.com"));

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/admin/usuarios/u2");
  });

  it("el segundo tap mientras navega se ignora (el detalle tarda segundos)", () => {
    render(<UsuariosTable rows={[usuario(), otra]} now={NOW} />);

    const celda = celdaCualquiera("tatiana@example.com");
    fireEvent.click(celda);
    fireEvent.click(celda);

    expect(push).toHaveBeenCalledTimes(1);
  });

  it("el candado es POR FILA: arrepentirse y picar otra SÍ navega", () => {
    render(<UsuariosTable rows={[usuario(), otra]} now={NOW} />);

    fireEvent.click(celdaCualquiera("tatiana@example.com"));
    fireEvent.click(celdaCualquiera("andy@example.com"));

    // Un candado global dejaría la tabla entera inerte mientras el detalle
    // tarda; el arrepentimiento tiene que responder.
    expect(push).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenLastCalledWith("/admin/usuarios/u2");
  });

  it("al volver con Atrás la tabla revive (el App Router no la re-monta)", () => {
    const { rerender } = render(<UsuariosTable rows={[usuario(), otra]} now={NOW} />);

    fireEvent.click(celdaCualquiera("tatiana@example.com"));
    expect(push).toHaveBeenCalledTimes(1);

    // Regresar re-renderiza con datos frescos: sin el reset, la fila seguiría
    // atenuada e inerte para siempre.
    rerender(<UsuariosTable rows={[usuario(), otra]} now={NOW + 1000} />);
    fireEvent.click(celdaCualquiera("tatiana@example.com"));

    expect(push).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenLastCalledWith("/admin/usuarios/u1");
  });

  it("el enlace del correo sigue existiendo (abrir en pestaña nueva) y no dispara además el push de la fila", () => {
    render(<UsuariosTable rows={[usuario(), otra]} now={NOW} />);

    const link = screen.getByRole("link", { name: /tatiana@example\.com/ });
    expect(link.getAttribute("href")).toBe("/admin/usuarios/u1");

    // stopPropagation: el click del enlace no debe además llamar al router.
    // (jsdom avisa "Not implemented: navigation to another Document" al seguir
    // el href de verdad — es ruido esperado, no un fallo.)
    fireEvent.click(link);
    expect(push).not.toHaveBeenCalled();
  });
});
