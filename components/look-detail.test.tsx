// @vitest-environment jsdom
//
// Qué botón manda en el pie del look. La decisión que se blinda (2026-10-08):
// en el PRIMER look (el wow, el único que pasa `enterApp`), sin avatar, la
// primaria es "entrar a la app" y el avatar es un enlace chico. Antes la
// primaria negra era "crea tu avatar para verte" y casi la mitad de quien
// entraba ahí se iba de la app a media creación. En el look de cada día, sin
// avatar, el avatar sigue siendo la primaria.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LookDetail } from "./look-detail";

// El corazón llama a una server action; aquí no importa.
vi.mock("@/components/favorite-button", () => ({ FavoriteButton: () => null }));

afterEach(cleanup);

const base = {
  nombre: "look",
  prendas: [],
  justificacion: "por qué",
  outfitId: "o1",
  initialFavorited: false,
  voto: null,
  onVote: () => {},
};

/** La primaria es la de fondo negro (bg-accent). */
const esPrimaria = (el: HTMLElement) => el.className.split(" ").includes("bg-accent");

describe("pie del look: avatar contra entrar a la app", () => {
  it("primer look sin avatar: entrar a la app es la primaria y el avatar un enlace chico", () => {
    render(<LookDetail {...base} enterApp={() => {}} avatarHref="/perfil/avatar" />);
    expect(esPrimaria(screen.getByRole("button", { name: /entrar a la app/ }))).toBe(true);
    const avatar = screen.getByRole("link", { name: /crea tu avatar/ });
    expect(avatar.getAttribute("href")).toBe("/perfil/avatar");
    expect(esPrimaria(avatar)).toBe(false);
  });

  it("look de cada día sin avatar: el avatar sigue siendo la primaria", () => {
    render(<LookDetail {...base} avatarHref="/perfil/avatar" />);
    expect(esPrimaria(screen.getByRole("link", { name: /crea tu avatar/ }))).toBe(true);
    expect(screen.queryByRole("button", { name: /entrar a la app/ })).toBeNull();
  });

  it("primer look CON avatar: 'verme con este look' sigue de primaria (son 20 s, no el wizard)", () => {
    render(<LookDetail {...base} enterApp={() => {}} onGenerar={() => {}} />);
    expect(esPrimaria(screen.getByRole("button", { name: /verme con este look/ }))).toBe(true);
    expect(esPrimaria(screen.getByRole("button", { name: /entrar a la app/ }))).toBe(false);
    expect(screen.queryByRole("link", { name: /crea tu avatar/ })).toBeNull();
  });
});
