import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// CONTRATO DEL AVISO DE PRIVACIDAD Y LOS TÉRMINOS CON LO QUE LA APP HACE.
//
// Un aviso "robusto" es uno exacto. La revisión del 2026-09-10 cazó frases que
// la app contradecía; este test impide que regresen y que se caigan las que
// cubren lo que sí pasa. Si un cambio de producto rompe uno de estos, el texto
// legal se actualiza en el mismo commit.

const aviso = readFileSync(join(import.meta.dirname, "page.tsx"), "utf8");
const terminos = readFileSync(join(import.meta.dirname, "../terminos/page.tsx"), "utf8");

describe("aviso de privacidad", () => {
  it("no dice que nadie abre tus fotos sin tu sesión: el admin puede (migración 0070)", () => {
    expect(aviso).not.toMatch(/nadie puede abrirlas sin una sesión tuya/);
    expect(aviso).toMatch(/El equipo de stailist/);
  });

  it("declara lo que la app guarda y antes callaba", () => {
    expect(aviso).toMatch(/dirección IP/); // lib/ritmo-login.ts
    expect(aviso).toMatch(/reportas un problema/); // lib/reportes.ts
    expect(aviso).toMatch(/catálogo de prendas/); // addLibraryCandidates
    expect(aviso).toMatch(/fuera de México/);
    expect(aviso).toMatch(/nuestras cookies/);
  });

  it("no repite las frases que la revisión legal del 2026-09-10 encontró falsas", () => {
    // Open-Meteo recibe coordenadas exactas (lib/weather/index.ts).
    expect(aviso).not.toMatch(/solo les llegan coordenadas aproximadas/);
    // Borrar una prenda, look o viaje es borrado suave (lib/delete-actions.ts).
    expect(aviso).not.toMatch(/No hay papelera ni copia que se quede/);
    // El reporte no guarda el navegador ni trae foto (lib/reportes.ts).
    expect(aviso).not.toMatch(/tu navegador, las fallas recientes|la foto si adjuntas una/);
  });

  it("nombra lo que antes callaba: BigDataCloud, datos del cuerpo, borrado suave, correos sin cuenta", () => {
    expect(aviso).toMatch(/BigDataCloud/);
    expect(aviso).toMatch(/complexión/);
    expect(aviso).toMatch(/lo guardamos hasta que borres la cuenta/);
    expect(aviso).toMatch(/lista de espera/);
  });

  it("sigue nombrando al responsable y las etiquetas de anuncios", () => {
    expect(aviso).toMatch(/FREIGHTNOW SA DE CV/);
    expect(aviso).toMatch(/anuncios y etiquetas de medición/);
    expect(aviso).not.toMatch(/No hay\s+publicidad/);
  });
});

describe("términos de uso", () => {
  it("no limitan el uso de lo que subes a 'darte el servicio': el aviso dice más", () => {
    expect(terminos).not.toMatch(/con el único fin de darte el servicio/);
  });

  it("dicen el precio igual que las preguntas frecuentes: gratis y sin tarjeta", () => {
    expect(terminos).toMatch(/no te pedimos tarjeta/);
  });
});
