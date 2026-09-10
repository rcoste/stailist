import { describe, expect, it } from "vitest";
import {
  decidirOrigen,
  hostExterno,
  leerOrigen,
  parseOrigen,
  serializarOrigen,
  type Origen,
} from "./origen";

const AHORA = new Date("2026-09-14T15:00:00.000Z");
const url = (s: string) => {
  const u = new URL(s);
  return { pathname: u.pathname, searchParams: u.searchParams, hostname: u.hostname };
};

describe("leerOrigen — qué dice una visita de dónde viene", () => {
  it("un clic de Google Ads guarda las utm y el gclid", () => {
    const o = leerOrigen(
      url("https://stailist.co/?utm_source=google&utm_campaign=hombres-search&gclid=Cj0KCQ"),
      null,
      AHORA
    );
    expect(o).toEqual({
      landing: "/",
      at: AHORA.toISOString(),
      utm_source: "google",
      utm_campaign: "hombres-search",
      gclid: "Cj0KCQ",
    });
  });

  it("un clic de TikTok sin utm se reconoce por el ttclid", () => {
    const o = leerOrigen(url("https://stailist.co/?ttclid=E.C.P.abc"), null, AHORA);
    expect(o?.ttclid).toBe("E.C.P.abc");
  });

  it("sólo guarda el DOMINIO del referer, nunca la ruta ni la búsqueda", () => {
    const o = leerOrigen(
      url("https://stailist.co/"),
      "https://www.google.com/search?q=que+me+pongo+hoy",
      AHORA
    );
    expect(o?.referer).toBe("www.google.com");
    expect(JSON.stringify(o)).not.toContain("pongo");
  });

  it("una visita directa o desde el propio sitio no dice nada", () => {
    expect(leerOrigen(url("https://stailist.co/login"), null, AHORA)).toBeNull();
    expect(leerOrigen(url("https://stailist.co/login"), "https://stailist.co/", AHORA)).toBeNull();
    expect(leerOrigen(url("https://stailist.co/login"), "https://www.stailist.co/", AHORA)).toBeNull();
  });

  it("ignora parámetros que no son de campaña (el ?email= de un link viejo no se cuela)", () => {
    const o = leerOrigen(url("https://stailist.co/login?email=ana@x.com&utm_source=tiktok"), null, AHORA);
    expect(o?.utm_source).toBe("tiktok");
    expect(JSON.stringify(o)).not.toContain("ana@x.com");
  });

  it("recorta valores absurdamente largos", () => {
    const o = leerOrigen(url(`https://stailist.co/?utm_campaign=${"x".repeat(500)}`), null, AHORA);
    expect(o?.utm_campaign?.length).toBe(120);
  });

  it("tira los caracteres fuera de la lista: un link fabricado no infla la cookie ni mete basura al panel", () => {
    const basura = encodeURIComponent("méxico<script>💥".repeat(40));
    const o = leerOrigen(url(`https://stailist.co/?utm_campaign=${basura}&utm_source=x`), null, AHORA);
    expect(o?.utm_campaign).toMatch(/^[\w.\-~+: ]+$/);
    expect(serializarOrigen(o!).length).toBeLessThan(1800);
  });
});

describe("hostExterno", () => {
  it("un referer ilegible no truena", () => {
    expect(hostExterno("no es una url", "stailist.co")).toBeUndefined();
  });

  it("un referer que no es web (la app de Gmail en Android) no es una fuente", () => {
    expect(hostExterno("android-app://com.google.android.gm", "stailist.co")).toBeUndefined();
  });
});

describe("decidirOrigen — qué visita gana", () => {
  const anuncioA: Origen = { landing: "/", at: "2026-09-14T00:00:00Z", utm_source: "google", utm_campaign: "a" };
  const anuncioB: Origen = { landing: "/", at: "2026-09-16T00:00:00Z", utm_source: "google", utm_campaign: "b" };
  const organico: Origen = { landing: "/", at: "2026-09-17T00:00:00Z", referer: "www.google.com" };

  it("el MISMO clic otra vez (recargar, la redirección a /login) no pisa la página a la que llegó", () => {
    const recarga: Origen = { ...anuncioA, landing: "/login", at: "2026-09-14T00:00:05Z" };
    expect(decidirOrigen(anuncioA, recarga)).toBeNull();
  });

  it("el último anuncio reemplaza al anterior", () => {
    expect(decidirOrigen(anuncioA, anuncioB)).toBe(anuncioB);
  });

  it("volver por Google orgánico NO borra el anuncio que la trajo", () => {
    expect(decidirOrigen(anuncioA, organico)).toBeNull();
  });

  it("el orgánico sí se guarda si no había nada", () => {
    expect(decidirOrigen(null, organico)).toBe(organico);
  });

  it("una visita que no dice nada no toca la cookie", () => {
    expect(decidirOrigen(anuncioA, null)).toBeNull();
  });
});

describe("parseOrigen — la cookie viene del navegador", () => {
  const o: Origen = { landing: "/", at: AHORA.toISOString(), utm_source: "google", gclid: "abc" };

  it("ida y vuelta, codificada o no", () => {
    expect(parseOrigen(serializarOrigen(o))).toEqual(o);
    expect(parseOrigen(encodeURIComponent(serializarOrigen(o)))).toEqual(o);
  });

  it("descarta basura y claves desconocidas", () => {
    expect(parseOrigen("{no json")).toBeNull();
    expect(parseOrigen("[]")).toBeNull();
    expect(parseOrigen(JSON.stringify({ utm_source: "google" }))).toBeNull();
    const conExtra = parseOrigen(JSON.stringify({ ...o, email: "ana@x.com" }));
    expect(conExtra).toEqual(o);
  });

  it("una cookie sin etiquetas ni referer no cuenta como origen", () => {
    expect(parseOrigen(JSON.stringify({ landing: "/", at: "x" }))).toBeNull();
  });
});
