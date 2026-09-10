// @vitest-environment jsdom
//
// LO QUE CORRE EN EL NAVEGADOR de lib/publicidad.ts.
//
// POR QUÉ EXISTE
// lib/publicidad.test.ts blinda las decisiones puras (qué ruta se mide, qué
// comando va a qué plataforma). Pero las promesas del aviso de privacidad se
// cumplen —o no— en el pegamento del navegador: que dentro de la app no se
// inyecte nada, que el botón de /privacidad y Global Privacy Control apaguen de
// verdad, que un registro no se cuente dos veces y que la cookie del servidor
// se consuma una sola vez. Eso es lo que se prueba aquí, contra un DOM falso.
//
// El módulo guarda estado (`cargadas`, `ultimaVista`): cada test lo importa
// fresco con vi.resetModules() para que un test no herede las etiquetas ya
// cargadas del anterior. Nada sale a la red: jsdom no descarga scripts externos.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Modulo = typeof import("./publicidad");

async function fresco(): Promise<Modulo> {
  vi.resetModules();
  return import("./publicidad");
}

const IDS = {
  googleAds: "AW-123456789",
  labelRegistro: "AbC-reg_1",
  labelPrimerLook: "XyZ-look_2",
  ga4: "G-ABC123XYZ",
  tiktok: "CQ1ABCDEF23456789",
};

type Ttq = { page: () => void; track: (evento: string) => void; load: (id: string) => void };
type Ventana = Window & { dataLayer?: IArguments[]; gtag?: unknown; ttq?: Ttq };
const w = () => window as unknown as Ventana;

function ir(ruta: string) {
  window.history.replaceState(null, "", ruta);
}

/** Los comandos que recibió gtag, como arreglos normales. */
const comandosGtag = (): unknown[][] => (w().dataLayer ?? []).map((a) => Array.from(a));

const scriptDeGoogle = () =>
  [...document.querySelectorAll("script")].filter((s) => s.src.includes("googletagmanager.com"));

function conGpc() {
  Object.defineProperty(navigator, "globalPrivacyControl", { value: true, configurable: true });
}

/** Un ttq de mentira para contar lo que se le pide (el real no se descarga). */
function ttqEspia() {
  const ttq = {
    page: vi.fn(() => {}),
    track: vi.fn((_evento: string) => {}),
    load: vi.fn((_id: string) => {}),
  };
  w().ttq = ttq;
  return ttq;
}

beforeEach(() => {
  localStorage.clear();
  ir("/");
});

afterEach(() => {
  document.head.innerHTML = "";
  delete w().dataLayer;
  delete w().gtag;
  delete w().ttq;
  Reflect.deleteProperty(navigator, "globalPrivacyControl");
  document.cookie = "st_conversion=; Max-Age=0; path=/";
  document.cookie = "st_menor=; Max-Age=0; path=/";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("cargarEtiquetas — dónde NO se carga nada", () => {
  it("sin IDs, o dentro de la app, no se inyecta ni un script", async () => {
    const m = await fresco();
    expect(m.cargarEtiquetas({})).toBe(false);

    ir("/hoy");
    expect(m.cargarEtiquetas(IDS)).toBe(false);
    ir("/closet");
    expect(m.cargarEtiquetas(IDS)).toBe(false);

    expect(document.querySelectorAll("script")).toHaveLength(0);
    expect(w().gtag).toBeUndefined();
    expect(m.etiquetasCargadas()).toBe(false);
  });

  it("el botón de /privacidad o Global Privacy Control apagan la carga en la landing", async () => {
    const m = await fresco();
    localStorage.setItem(m.OPT_OUT_KEY, "1");
    expect(m.cargarEtiquetas(IDS)).toBe(false);

    localStorage.removeItem(m.OPT_OUT_KEY);
    conGpc();
    expect(m.cargarEtiquetas(IDS)).toBe(false);

    expect(document.querySelectorAll("script")).toHaveLength(0);
    expect(m.etiquetasCargadas()).toBe(false);
  });
});

describe("cargarEtiquetas — sin storage", () => {
  it("si el navegador no deja leer el botón de /privacidad, falla cerrado: no carga nada", async () => {
    const m = await fresco();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });

    expect(m.permitidoEnEsteNavegador()).toBe(false);
    expect(m.cargarEtiquetas(IDS)).toBe(false);
    expect(document.querySelectorAll("script")).toHaveLength(0);
  });
});

describe("cargarEtiquetas — cuando sí", () => {
  it("apaga señales y personalización de Google, manda la URL limpia y es idempotente", async () => {
    const m = await fresco();
    ir("/?email=ana%40x.com&invite=tok123&utm_source=google&gclid=Cj0");

    expect(m.cargarEtiquetas(IDS)).toBe(true);

    const cmds = comandosGtag();
    expect(cmds).toContainEqual(["set", { allow_google_signals: false, allow_ad_personalization_signals: false }]);
    // GA4 sin page_view automática: la automática llevaría la query completa.
    expect(cmds).toContainEqual([
      "config",
      "G-ABC123XYZ",
      { send_page_view: false, page_location: "http://localhost:3000/?utm_source=google&gclid=Cj0" },
    ]);
    expect(JSON.stringify(cmds)).not.toMatch(/ana|tok123/);
    expect(scriptDeGoogle()).toHaveLength(1);
    expect(scriptDeGoogle()[0].src).toContain("id=AW-123456789");
    // La dirección trae ?email= e ?invite=: a TikTok no se le carga ni el píxel.
    const tiktok = [...document.querySelectorAll("script")].find((s) => s.textContent?.includes('ttq.load("CQ1ABCDEF23456789")'));
    expect(tiktok).toBeUndefined();

    // Una segunda llamada (otro cambio de ruta) no vuelve a inyectar nada.
    const antes = document.querySelectorAll("script").length;
    expect(m.cargarEtiquetas(IDS)).toBe(true);
    expect(document.querySelectorAll("script")).toHaveLength(antes);
  });
});

describe("cargarEtiquetas — TikTok con una URL limpia", () => {
  it("con sólo etiquetas de campaña (y la versión de la landing) sí se carga su píxel", async () => {
    const m = await fresco();
    ir("/?g=hombre&utm_source=tiktok&ttclid=E.1");

    expect(m.cargarEtiquetas(IDS)).toBe(true);
    const tiktok = [...document.querySelectorAll("script")].find((s) => s.textContent?.includes('ttq.load("CQ1ABCDEF23456789")'));
    expect(tiktok).toBeDefined();
  });
});

describe("registrarVista", () => {
  it("sin etiquetas no hace nada; con ellas, una vista por dirección (el doble efecto de React no cuenta dos)", async () => {
    const m = await fresco();
    m.registrarVista(IDS); // antes de cargar: no truena, no manda
    expect(w().gtag).toBeUndefined();

    ir("/?utm_source=tiktok&g=hombre");
    m.cargarEtiquetas(IDS);
    const ttq = ttqEspia();
    m.registrarVista(IDS);
    m.registrarVista(IDS);

    const vistas = () => comandosGtag().filter((c) => c[0] === "event" && c[1] === "page_view");
    expect(vistas()).toHaveLength(1);
    expect(vistas()[0][2]).toMatchObject({ send_to: "G-ABC123XYZ", page_location: "http://localhost:3000/?utm_source=tiktok" });
    expect(ttq.page).toHaveBeenCalledTimes(1);

    ir("/onboarding/gustos");
    m.registrarVista(IDS);
    expect(vistas()).toHaveLength(2);
    expect(ttq.page).toHaveBeenCalledTimes(2);
  });
});

describe("registrarConversion", () => {
  it("un momento sale una sola vez por navegador: recargar el wow no cuenta dos primeros looks", async () => {
    const m = await fresco();
    ir("/onboarding/wow");
    m.cargarEtiquetas(IDS);
    const ttq = ttqEspia();

    expect(m.registrarConversion("primer_look", IDS)).toBe(true);
    const conversiones = () => comandosGtag().filter((c) => c[0] === "event" && c[1] !== "page_view");
    expect(conversiones()).toEqual([
      ["event", "primer_look", { send_to: "G-ABC123XYZ" }],
      ["event", "conversion", { send_to: "AW-123456789/XyZ-look_2" }],
    ]);
    expect(ttq.track).toHaveBeenCalledWith("PrimerLook");

    expect(m.registrarConversion("primer_look", IDS)).toBe(false);
    expect(conversiones()).toHaveLength(2);
    expect(ttq.track).toHaveBeenCalledTimes(1);

    // El registro es otro momento: su marca es aparte.
    expect(m.registrarConversion("registro", IDS)).toBe(true);
    expect(ttq.track).toHaveBeenLastCalledWith("CompleteRegistration");
  });

  it("si no se puede medir (GPC), no sale ni queda marcada como enviada", async () => {
    const m = await fresco();
    ir("/onboarding/objetivo");
    conGpc();

    expect(m.registrarConversion("registro", IDS)).toBe(false);
    expect(w().dataLayer).toBeUndefined();
    expect(localStorage.getItem("st_conv_registro")).toBeNull();
  });
});

describe("lo que TikTok no ve, la menor declarada y la marca sin envío", () => {
  it("con un parámetro que no es de campaña, a TikTok no le llega ni la vista ni el momento; a Google sí, limpio", async () => {
    const m = await fresco();
    ir("/onboarding/wow?look=abc");
    m.cargarEtiquetas(IDS);
    const ttq = ttqEspia();

    m.registrarVista(IDS);
    expect(ttq.page).not.toHaveBeenCalled();

    expect(m.registrarConversion("primer_look", IDS)).toBe(true);
    expect(ttq.track).not.toHaveBeenCalled();
    expect(comandosGtag()).toContainEqual(["event", "conversion", { send_to: "AW-123456789/XyZ-look_2" }]);
  });

  it("la cookie de menor apaga la carga aunque la ruta sea medible", async () => {
    const m = await fresco();
    document.cookie = `${m.COOKIE_MENOR}=1; path=/`;
    ir("/onboarding/gustos");

    expect(m.cargarEtiquetas(IDS)).toBe(false);
    expect(document.querySelectorAll("script")).toHaveLength(0);
  });

  it("sin comandos (el ID de Ads puesto antes que sus labels) no queda marcada: si no, nunca se contaría", async () => {
    const m = await fresco();
    ir("/onboarding/gustos");

    expect(m.registrarConversion("registro", { googleAds: "AW-123456789" })).toBe(false);
    expect(localStorage.getItem("st_conv_registro")).toBeNull();
  });
});

describe("salirSinEtiquetas — la salida del onboarding", () => {
  it("sin etiquetas deja navegar al router; con ellas hace navegación completa", async () => {
    const m = await fresco();
    expect(m.salirSinEtiquetas("/hoy")).toBe(false);

    ir("/onboarding/wow");
    m.cargarEtiquetas(IDS);
    const assign = vi.fn((_href: string) => {});
    vi.stubGlobal("location", { ...window.location, assign });

    expect(m.salirSinEtiquetas("/hoy")).toBe(true);
    expect(assign).toHaveBeenCalledWith("/hoy");
  });
});

describe("tomarConversionPendiente — la cookie que dejó el servidor", () => {
  it("se consume una sola vez, y un valor que no es un momento conocido no pasa (pero se borra igual)", async () => {
    const m = await fresco();
    expect(m.tomarConversionPendiente()).toBeNull();

    document.cookie = `${m.COOKIE_CONVERSION}=registro; path=/`;
    expect(m.tomarConversionPendiente()).toBe("registro");
    expect(document.cookie).not.toContain(m.COOKIE_CONVERSION);
    expect(m.tomarConversionPendiente()).toBeNull();

    document.cookie = `${m.COOKIE_CONVERSION}=compra; path=/`;
    expect(m.tomarConversionPendiente()).toBeNull();
    expect(document.cookie).not.toContain(m.COOKIE_CONVERSION);
  });
});
