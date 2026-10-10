import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// EL CANDADO CONTRA "EL MENÚ APUNTA A DONDE YA NO ESTÁ".
//
// El nav del admin declara sus rutas como strings sueltos. Un string no lo
// revisa nadie: si una carpeta se renombra o se borra, el link sigue ahí
// viéndose perfecto y te manda a un 404. No truena el build, no truena ningún
// test, y solo se descubre haciendo clic.
//
// Nació de la reorganización del 2026-08-17, que movió seis secciones de lugar
// (revisar y duplicados → limpieza/*, allowlist y waitlist → acceso) y borró
// tres (barrido, ab, inspo). Cada uno de esos movimientos era una oportunidad
// de dejar un link muerto.
//
// Desde el replanteo del 2026-10-09 el menú tiene 5 entradas y a una pantalla
// se llega por tres puertas: el menú, el índice del Taller y las pestañas de
// una sección (Embudo | Retención, Lista | Actividad). Las tres cuentan como
// "está en el menú". Este test se quedó vigilando el menú viejo un día entero
// después del replanteo porque se corrieron sólo los tests de lib/admin y
// app/admin, no los de lib/: correr la suite completa antes de publicar.
//
// La segunda mitad vigila lo contrario, que es el problema que la
// reorganización venía a resolver: una sección que existe en disco pero no
// está en el menú es una pantalla que nadie sabe que existe ni para qué sirve.
// Si se deja fuera a propósito, se declara aquí con su razón.

const RAIZ = join(import.meta.dirname, "..");
/** Las tres puertas por las que se llega a una pantalla del admin. */
const PUERTAS = ["app/admin/admin-nav.tsx", "app/admin/taller/page.tsx", "app/admin/_compartido/pestanas.tsx"];

/** Los hrefs declarados en las puertas, tal cual salen de la fuente. */
function hrefsDelNav(): string[] {
  const hrefs = PUERTAS.flatMap((f) =>
    [...readFileSync(join(RAIZ, f), "utf8").matchAll(/href:\s*"(\/admin[^"]*)"/g)].map((m) => m[1])
  );
  return [...new Set(hrefs)];
}

/** Las secciones de primer nivel que existen en disco bajo app/admin. */
function seccionesEnDisco(): string[] {
  const dir = join(RAIZ, "app/admin");
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    // Las carpetas dinámicas ([id]) son hijas de una sección, no secciones;
    // las privadas (_compartido) son código, no rutas.
    .filter((d) => !d.name.startsWith("[") && !d.name.startsWith("_"))
    .map((d) => d.name);
}

/**
 * Secciones que viven fuera del menú A PROPÓSITO. Cada exención lleva su
 * porqué: la lista es donde se discute, no un cajón de sastre.
 */
const FUERA_DEL_MENU: Record<string, string> = {
  "ver-como": "es una acción, no una pantalla: se entra desde la ficha de usuaria",
  campana: "ruta vieja: redirige a /admin/campanas desde el replanteo del 2026-10-09",
  adquisicion: "ruta vieja: redirige a /admin/campanas desde el replanteo del 2026-10-09",
};

describe("el menú del admin apunta a secciones que existen", () => {
  const hrefs = hrefsDelNav();

  it("el nav sigue declarando los links que este test cree vigilar", () => {
    // Si el regex deja de casar, el test pasaría en vacío sin vigilar nada.
    expect(hrefs.length, "no encontré hrefs en el nav").toBeGreaterThan(8);
    expect(hrefs).toContain("/admin");
  });

  for (const href of hrefsDelNav()) {
    it(`${href} existe en disco`, () => {
      // "/admin" es el overview; el resto son carpetas bajo app/admin.
      const rel = href === "/admin" ? "app/admin" : `app${href}`;
      const carpeta = join(RAIZ, rel);
      expect(
        existsSync(carpeta),
        `El menú manda a ${href} y esa carpeta no existe. Un link muerto no ` +
          `truena nada: se ve bien y da 404 al hacer clic.`
      ).toBe(true);
      // Una carpeta sin page.tsx tampoco pinta nada.
      expect(
        existsSync(join(carpeta, "page.tsx")),
        `${href} existe como carpeta pero no tiene page.tsx, así que no pinta nada.`
      ).toBe(true);
    });
  }

  it("no hay secciones huérfanas fuera del menú", () => {
    const enMenu = new Set(
      hrefs.filter((h) => h !== "/admin").map((h) => h.replace("/admin/", ""))
    );
    const huerfanas = seccionesEnDisco().filter(
      (s) => !enMenu.has(s) && !FUERA_DEL_MENU[s]
    );
    expect(
      huerfanas,
      `Estas secciones existen pero no están en el menú, así que nadie sabe ` +
        `que existen ni para qué sirven: ${huerfanas.join(", ")}. O las metes ` +
        `al nav, o las declaras en FUERA_DEL_MENU con su razón.`
    ).toEqual([]);
  });

  it("no hay exenciones para secciones que ya no existen", () => {
    // Una exención huérfana es peor que ninguna: parece que alguien lo pensó.
    const enDisco = new Set(seccionesEnDisco());
    const huerfanas = Object.keys(FUERA_DEL_MENU).filter((s) => !enDisco.has(s));
    expect(
      huerfanas,
      `Exenciones de secciones inexistentes: ${huerfanas.join(", ")}`
    ).toEqual([]);
  });
});
