import { describe, expect, it } from "vitest";

// EL BUZÓN — lo que se prueba aquí es la DECISIÓN, no el markup.
//
// Roberto, 2026-09-09: "algún botón para que los usuarios puedan reportar algún
// problema o sugerencia… es más fácil que de memoria me lo expliquen".
//
// El caso que lo motiva: Val intentó verse un look CUATRO veces ese día, falló
// las cuatro por una caída del proveedor de imágenes, y NO reportó nada — se
// rindió. El único canal era hola@stailist.co, escondido en la página de
// términos.
//
// Este archivo fija las tres decisiones que hacen que un reporte exista y sirva.
// La acción en sí (enviarReporte) es "use server" y toca Supabase; probarla
// pediría un arnés de base que este repo no tiene. Lo que NO puede perderse en
// una edición es lo de abajo.
import { readFileSync } from "node:fs";

const fuente = readFileSync("lib/reportes.ts", "utf8");
const hoja = readFileSync("components/reporte-sheet.tsx", "utf8");
const drawer = readFileSync("components/more-sheet.tsx", "utf8");
const tryon = readFileSync("components/tryon-view.tsx", "utf8");

describe("el contexto viaja solo — no se le pide a la persona", () => {
  it("adjunta la ruta, la versión y el agente sin preguntarlos", () => {
    for (const campo of ["ruta:", "version:", "foto_path:"]) {
      expect(fuente).toContain(campo);
    }
  });

  it("adjunta sus últimos eventos y sus fallos de IA recientes", () => {
    // Es lo que convierte "no me funcionó" en algo accionable: los 4 fallos de
    // tryon de Val habrían llegado pegados a su reporte.
    expect(fuente).toContain("eventos");
    expect(fuente).toContain("fallosIaRecientes");
    expect(fuente).toMatch(/ai_calls/);
  });

  it("la hoja LE DICE que no tiene que explicar dónde estaba", () => {
    expect(hoja).toMatch(/no tienes que explicarlo/i);
  });
});

describe("nada frena el impulso de escribir", () => {
  it("el tipo tiene default: se puede mandar sin clasificar", () => {
    expect(fuente).toMatch(/tipo:\s*datos\.tipo\s*\?\?\s*"problema"/);
  });

  it("el texto vacío no se manda, pero es la ÚNICA condición", () => {
    expect(fuente).toMatch(/if \(!texto\) return \{ ok: false, error: "vacio" \}/);
  });
});

describe("el reporte no se pierde si falla el correo", () => {
  it("se guarda ANTES de intentar avisar, y el correo no bloquea", () => {
    const posInsert = fuente.indexOf('.from("reportes").insert');
    // `void sendEmail` y no `sendEmail` a secas: lo segundo casa con el import,
    // que está arriba de todo y haría pasar el test por accidente.
    const posCorreo = fuente.indexOf("void sendEmail");
    expect(posInsert).toBeGreaterThan(-1);
    expect(posCorreo).toBeGreaterThan(posInsert);
    // `void` + catch: un Postmark caído no puede costar el reporte.
    expect(fuente).toMatch(/void sendEmail/);
  });
});

describe("dónde se puede reportar", () => {
  it("desde el menú, junto al sello de beta", () => {
    expect(drawer).toContain("onReportar");
    expect(drawer).toMatch(/>\s*beta\s*</);
  });

  it("y desde la pantalla de error, que es donde duele", () => {
    // El momento en que alguien tiene el problema enfrente es ÉSE, no tres taps
    // después en otra pantalla.
    expect(tryon).toContain("onReportar");
  });
});

describe("el sello de beta NO va donde se pide inversión", () => {
  it("ni en la landing ni en el onboarding", () => {
    // Anunciar fragilidad mientras se piden siete minutos y catalogar el clóset
    // es darle permiso a la persona para no volver.
    const landing = readFileSync("components/landing/landing.tsx", "utf8");
    const wow = readFileSync("app/onboarding/wow/wow-client.tsx", "utf8");
    for (const archivo of [landing, wow]) {
      expect(archivo).not.toMatch(/\bbeta\b/i);
    }
  });
});
