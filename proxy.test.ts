// LA HUELLA DEL ANUNCIO EN EL PORTERO (proxy.ts).
//
// lib/origen.test.ts blinda las reglas (qué visita gana). Lo que se blinda aquí
// es que el portero las APLIQUE en las respuestas que de verdad salen: sobre
// todo en la redirección a /login, que es lo primero que ve alguien que llega
// de un anuncio a una ruta privada. Si la cookie se pusiera sólo en la
// respuesta "normal", esa visita se perdería sin ningún error.
//
// Supabase se simula entero: ningún test toca la red ni la base.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import proxy from "./proxy";
import { COOKIE_ORIGEN, ORIGEN_MAX_AGE_S, parseOrigen, serializarOrigen, type Origen } from "@/lib/origen";

const sesion = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: sesion.user } }) },
  }),
}));

beforeEach(() => {
  sesion.user = null;
});

function pedir(url: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return proxy(new NextRequest(url, { method: init.method ?? "GET", headers: init.headers }));
}

describe("proxy — la cookie de origen", () => {
  it("el anuncio que cae en una ruta privada deja su huella AUNQUE lo manden a /login", async () => {
    const res = await pedir("https://stailist.co/closet?utm_source=google&utm_campaign=h1&gclid=Cj0");

    expect(res.headers.get("location")).toMatch(/\/login/);
    const c = res.cookies.get(COOKIE_ORIGEN);
    expect(c?.httpOnly).toBe(true);
    expect(c?.maxAge).toBe(ORIGEN_MAX_AGE_S);
    expect(parseOrigen(c?.value)).toMatchObject({ utm_source: "google", utm_campaign: "h1", gclid: "Cj0", landing: "/closet" });
  });

  it("un POST (server action) o una llamada a /api no escriben la cookie", async () => {
    const post = await pedir("https://stailist.co/?utm_source=google", { method: "POST" });
    expect(post.cookies.get(COOKIE_ORIGEN)).toBeUndefined();

    const api = await pedir("https://stailist.co/api/version?utm_source=google");
    expect(api.cookies.get(COOKIE_ORIGEN)).toBeUndefined();
  });

  it("volver por Google orgánico no pisa el anuncio; entrar por otro anuncio sí", async () => {
    const anuncio: Origen = { landing: "/", at: "2026-09-14T00:00:00.000Z", utm_source: "google", utm_campaign: "a" };
    const cookie = `${COOKIE_ORIGEN}=${encodeURIComponent(serializarOrigen(anuncio))}`;

    const organico = await pedir("https://stailist.co/", {
      headers: { cookie, referer: "https://www.google.com/search?q=que+me+pongo" },
    });
    expect(organico.cookies.get(COOKIE_ORIGEN)).toBeUndefined();

    const otro = await pedir("https://stailist.co/?utm_source=tiktok&utm_campaign=b", { headers: { cookie } });
    expect(parseOrigen(otro.cookies.get(COOKIE_ORIGEN)?.value)).toMatchObject({ utm_source: "tiktok", utm_campaign: "b" });
  });

  it("la redirección a /login conserva la query: esa segunda visita es el mismo clic y no pisa la página real", async () => {
    const primera = await pedir("https://stailist.co/closet?utm_source=google&gclid=Cj0");
    const valor = primera.cookies.get(COOKIE_ORIGEN)?.value;
    expect(valor).toBeDefined();

    const segunda = await pedir("https://stailist.co/login?utm_source=google&gclid=Cj0", {
      headers: { cookie: `${COOKIE_ORIGEN}=${encodeURIComponent(valor!)}` },
    });
    expect(segunda.cookies.get(COOKIE_ORIGEN)).toBeUndefined();
  });
});
