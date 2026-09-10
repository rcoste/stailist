import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  comandosDeConversion,
  debeMedirPrimerLook,
  esTipoConversion,
  hayEtiquetas,
  limpiarIds,
  linkSaleDeZona,
  medicionPermitida,
  rutaMedible,
  urlParaEtiquetas,
  urlSoloConCampana,
} from "./publicidad";

const TODO = limpiarIds({
  googleAds: "AW-123456789",
  labelRegistro: "AbC-reg_1",
  labelPrimerLook: "XyZ-look_2",
  ga4: "G-ABC123XYZ",
  tiktok: "CQ1ABCDEF23456789",
});

describe("limpiarIds — el switch", () => {
  it("sin variables no hay etiquetas: nada se carga", () => {
    expect(hayEtiquetas(limpiarIds({}))).toBe(false);
  });

  it("acepta los formatos reales de cada plataforma", () => {
    expect(TODO).toEqual({
      googleAds: "AW-123456789",
      labelRegistro: "AbC-reg_1",
      labelPrimerLook: "XyZ-look_2",
      ga4: "G-ABC123XYZ",
      tiktok: "CQ1ABCDEF23456789",
    });
  });

  it("un ID con typo se descarta en vez de cargarse (termina en una URL y un script)", () => {
    const ids = limpiarIds({
      googleAds: "123456789",
      ga4: "UA-1234-1",
      tiktok: 'ABC");alert(1);//',
      labelRegistro: "con espacios no",
    });
    expect(ids).toEqual({});
  });

  it("tolera espacios alrededor al pegar en Vercel", () => {
    expect(limpiarIds({ ga4: "  G-ABC123XYZ\n" }).ga4).toBe("G-ABC123XYZ");
  });
});

describe("rutaMedible — el aviso promete que dentro de la app no hay etiquetas", () => {
  it("la landing y el onboarding después de la edad sí", () => {
    for (const p of ["/", "/onboarding/objetivo", "/onboarding/gustos", "/onboarding/wow"]) {
      expect(rutaMedible(p), p).toBe(true);
    }
  });

  it("donde se teclea un correo o aún no se sabe la edad no: login, género y edad", () => {
    for (const p of ["/login", "/login/x", "/onboarding/genero", "/onboarding/edad"]) {
      expect(rutaMedible(p), p).toBe(false);
    }
  });

  it("la app, el admin, las legales y la API no", () => {
    for (const p of ["/hoy", "/closet", "/perfil", "/historial", "/viaje", "/admin", "/privacidad", "/api/generate", "/onboardingx", "/loginx"]) {
      expect(rutaMedible(p), p).toBe(false);
    }
  });
});

describe("linkSaleDeZona — qué links se vuelven navegación completa", () => {
  const origen = "https://stailist.co";

  it("un link propio a la app o a las legales sale; uno al onboarding o a la misma landing, no", () => {
    expect(linkSaleDeZona(new URL("https://stailist.co/perfil/avatar?return=x"), origen)).toBe(true);
    expect(linkSaleDeZona(new URL("https://stailist.co/privacidad"), origen)).toBe(true);
    expect(linkSaleDeZona(new URL("https://stailist.co/onboarding/gustos"), origen)).toBe(false);
    expect(linkSaleDeZona(new URL("https://stailist.co/#sumarme"), origen)).toBe(false);
  });

  it("un link a otro sitio no se toca: ya es navegación completa", () => {
    expect(linkSaleDeZona(new URL("https://policies.google.com/privacy"), origen)).toBe(false);
  });
});

describe("medicionPermitida", () => {
  it("el botón de /privacidad, Global Privacy Control o una menor declarada apagan todo", () => {
    expect(medicionPermitida({ optOut: false, gpc: false, menor: false })).toBe(true);
    expect(medicionPermitida({ optOut: true, gpc: false, menor: false })).toBe(false);
    expect(medicionPermitida({ optOut: false, gpc: true, menor: false })).toBe(false);
    expect(medicionPermitida({ optOut: false, gpc: false, menor: true })).toBe(false);
  });
});

describe("debeMedirPrimerLook — la puerta de menores del wow", () => {
  it("paso 4 y adulta: sí", () => {
    expect(debeMedirPrimerLook(4, "25-34")).toBe(true);
  });

  it("13-17, sin edad, o fuera del paso 4 (ya lo tenía, o aún no llega): no", () => {
    expect(debeMedirPrimerLook(4, "13-17")).toBe(false);
    expect(debeMedirPrimerLook(4, null)).toBe(false);
    expect(debeMedirPrimerLook(5, "25-34")).toBe(false);
    expect(debeMedirPrimerLook(3, "25-34")).toBe(false);
  });
});

describe("urlSoloConCampana — lo único que TikTok puede ver de la dirección", () => {
  it("etiquetas de campaña y la versión de la landing pasan", () => {
    expect(urlSoloConCampana("https://stailist.co/?g=hombre&utm_source=tiktok&ttclid=E.1")).toBe(true);
    expect(urlSoloConCampana("https://stailist.co/onboarding/gustos")).toBe(true);
  });

  it("cualquier otra cosa (un token, un correo, el id de un look) no", () => {
    expect(urlSoloConCampana("https://stailist.co/login?invite=tok")).toBe(false);
    expect(urlSoloConCampana("https://stailist.co/?email=a%40b.c&utm_source=x")).toBe(false);
    expect(urlSoloConCampana("https://stailist.co/onboarding/wow?look=abc")).toBe(false);
    expect(urlSoloConCampana("nada")).toBe(false);
  });
});

describe("urlParaEtiquetas — lo que Google y TikTok ven de la dirección", () => {
  it("tira el correo, el token de invitación y cualquier otra query", () => {
    const u = urlParaEtiquetas("https://stailist.co/login?email=ana%40x.com&invite=tok123&look=abc");
    expect(u).toBe("https://stailist.co/login");
  });

  it("conserva las etiquetas de campaña: GA4 atribuye leyéndolas", () => {
    const u = urlParaEtiquetas("https://stailist.co/?g=hombre&utm_source=google&utm_campaign=h1&gclid=Cj0&email=x@y.z");
    expect(u).toBe("https://stailist.co/?utm_source=google&utm_campaign=h1&gclid=Cj0");
  });

  it("una URL ilegible no truena", () => {
    expect(urlParaEtiquetas("nada")).toBe("");
  });
});

describe("comandosDeConversion — qué momento viaja a qué plataforma", () => {
  it("registro con todo configurado: sign_up en GA4, conversión con su label en Ads, estándar en TikTok", () => {
    expect(comandosDeConversion("registro", TODO)).toEqual([
      { a: "gtag", args: ["event", "sign_up", { method: "email", send_to: "G-ABC123XYZ" }] },
      { a: "gtag", args: ["event", "conversion", { send_to: "AW-123456789/AbC-reg_1" }] },
      { a: "ttq", evento: "CompleteRegistration" },
    ]);
  });

  it("primer look usa SU label, no el del registro", () => {
    const cmds = comandosDeConversion("primer_look", TODO);
    expect(cmds).toContainEqual({ a: "gtag", args: ["event", "conversion", { send_to: "AW-123456789/XyZ-look_2" }] });
    expect(JSON.stringify(cmds)).not.toContain("AbC-reg_1");
  });

  it("Ads sin label no manda conversión (nadie la contaría)", () => {
    const cmds = comandosDeConversion("registro", limpiarIds({ googleAds: "AW-123456789" }));
    expect(cmds).toEqual([]);
  });

  it("ningún comando lleva datos de la persona", () => {
    const todo = JSON.stringify([...comandosDeConversion("registro", TODO), ...comandosDeConversion("primer_look", TODO)]);
    expect(todo).not.toMatch(/@|email_address|user_data|phone/);
  });
});

describe("esTipoConversion — la cookie viene del navegador", () => {
  it("sólo acepta los dos momentos", () => {
    expect(esTipoConversion("registro")).toBe(true);
    expect(esTipoConversion("primer_look")).toBe(true);
    expect(esTipoConversion("compra")).toBe(false);
  });
});

describe("contrato: el correo nunca viaja en la URL", () => {
  // Con las etiquetas cargadas en la landing, un router.push a /login?email=…
  // le entregaba el correo a Google y a TikTok en el historial de la página.
  it("el formulario de la landing no arma /login?email=", () => {
    const fuente = readFileSync(join(import.meta.dirname, "../components/landing/entrar-form.tsx"), "utf8");
    expect(fuente).not.toMatch(/\?email=/);
  });

  it("la landing sale al login con salirSinEtiquetas: con el router, la recarga de seguridad dejaba el correo en blanco", () => {
    const fuente = readFileSync(join(import.meta.dirname, "../components/landing/entrar-form.tsx"), "utf8");
    expect(fuente).toMatch(/salirSinEtiquetas\("\/login"\)/);
  });
});
