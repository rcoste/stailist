// Recorrido completo del onboarding EN MÓVIL (iPhone 14) contra el dev server,
// con la cuenta claude.dev. Captura cada paso Y cada pantalla de espera.
//
// No automatiza para "pasar": automatiza para MIRAR. Las esperas son parte del
// producto —hay tres generaciones de IA en este camino— y es donde toca afinar.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = process.argv[2] ?? "./capturas";
const CARA = process.argv[3] ?? "./avatar-face.jpg";

fs.mkdirSync(OUT, { recursive: true });
let n = 0;
const bitacora = [];
const t00 = Date.now();

async function shot(page, nombre, nota = "") {
  n += 1;
  const archivo = `${String(n).padStart(2, "0")}-${nombre}.png`;
  await page.screenshot({ path: path.join(OUT, archivo) });
  const texto = await page.evaluate(() => document.body.innerText).catch(() => "");
  const controles = await page
    .evaluate(() =>
      [...document.querySelectorAll("button, a[href]")]
        .filter((e) => e.offsetParent !== null && !e.closest("nextjs-portal"))
        .map((e) => (e.innerText || e.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 16)
    )
    .catch(() => []);
  bitacora.push({
    n,
    archivo,
    nota,
    seg: Math.round((Date.now() - t00) / 1000),
    url: page.url().replace(BASE, ""),
    texto,
    controles,
  });
  console.log(`  [${n}] ${archivo}${nota ? " — " + nota : ""}`);
}

const CARGANDO =
  /generando|dibujando|estudiando|preparando|combinando|afinando|revisando|casi list|terminando|armando|mientras contestas|leyendo|buscando|montando|eligiendo|calculando|un momento|espera/i;

/** Capturas repetidas mientras algo carga. Devuelve los segundos que tardó. */
async function esperando(page, nombre, maxMs, cada = 6000) {
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < maxMs) {
    await page.waitForTimeout(cada);
    i += 1;
    const sigue = await page.evaluate((re) => new RegExp(re, "i").test(document.body.innerText), CARGANDO.source).catch(() => false);
    await shot(page, `${nombre}-espera${i}`, `${Math.round((Date.now() - t0) / 1000)}s cargando`);
    if (!sigue) break;
  }
  return Math.round((Date.now() - t0) / 1000);
}

/** El CTA primario: el último botón ancho. Adivinar la palabra se rompía. */
async function avanzar(page, { espera = 2500 } = {}) {
  const h = await page.evaluateHandle(() => {
    // BOTONES *Y* ENLACES: la pantalla de resultado de colorimetría cierra con
    // un <a>, no con un <button>, y mirando sólo botones el recorrido se
    // quedaba ahí sin decir por qué.
    const anchos = [...document.querySelectorAll("button, a[href]")].filter((b) => {
      const r = b.getBoundingClientRect();
      return (
        r.width > window.innerWidth * 0.6 &&
        r.height >= 40 &&
        b.offsetParent !== null &&
        !b.disabled &&
        !b.closest("nextjs-portal")
      );
    });
    return anchos[anchos.length - 1] ?? null;
  });
  const el = h.asElement();
  if (!el) return false;
  const txt = await el.evaluate((e) => e.innerText.replace(/\s+/g, " ").trim());
  await el.click();
  await page.waitForTimeout(espera);
  return txt;
}

/** Elige la primera opción de una pantalla-pregunta (no el CTA ancho). */
async function eligeOpcion(page, salto = 0) {
  const h = await page.evaluateHandle((s) => {
    const ops = [...document.querySelectorAll("button")].filter((b) => {
      const r = b.getBoundingClientRect();
      return (
        b.offsetParent !== null &&
        !b.disabled &&
        !b.closest("nextjs-portal") &&
        r.height >= 36 &&
        r.width < window.innerWidth * 0.95
      );
    });
    return ops[s] ?? ops[0] ?? null;
  }, salto);
  const el = h.asElement();
  if (!el) return false;
  const txt = await el.evaluate((e) => e.innerText.replace(/\s+/g, " ").trim().slice(0, 40));
  await el.click();
  await page.waitForTimeout(600);
  return txt;
}

/** Vuelca el inventario de botones de una pantalla: ancho, alto y texto. Es lo
 *  que evita seguir adivinando qué es opción y qué es CTA. */
async function inventario(page, nombre) {
  const inv = await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((b) => b.offsetParent !== null && !b.closest("nextjs-portal"))
      .map((b) => {
        const r = b.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), t: (b.innerText || b.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 44) };
      })
  );
  console.log("   inventario " + nombre + ":", JSON.stringify(inv));
  return true;
}

const hay = (page, txt) =>
  page.evaluate((t) => document.body.innerText.includes(t), txt).catch(() => false);

async function vota(page) {
  for (const b of await page.locator("button").all()) {
    const al = (await b.getAttribute("aria-label")) ?? "";
    if (/^Me gusta/i.test(al)) {
      await b.click();
      return true;
    }
  }
  return false;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    locale: "es-MX",
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await shot(page, "login", "acceso");
    await page.locator('form:has(input[value="claude.dev@stailist.app"]) button').click();
    await page.waitForTimeout(3500);

    // ── 1. Género ────────────────────────────────────────────────────────
    await shot(page, "genero", "paso 1: qué ropa usas");
    await page.locator('button:has-text("hombre")').first().click();
    await page.waitForTimeout(500);
    await shot(page, "genero-marcado", "OJO: elegir no avanza, hay que confirmar abajo");
    await avanzar(page, { espera: 3000 });

    // ── 2. Edad ──────────────────────────────────────────────────────────
    await shot(page, "edad");
    await page.locator('button:has-text("25 a 34")').first().click();
    await page.waitForTimeout(500);
    await shot(page, "edad-marcada");
    await avanzar(page, { espera: 3000 });

    // ── 3. Gustos: los swipes ────────────────────────────────────────────
    await shot(page, "gustos-carta1", "paso 1 de 5 — con la explicación nueva");
    for (let i = 0; i < 30; i++) {
      if (!(await vota(page))) break;
      await page.waitForTimeout(420);
      if (i === 11) await shot(page, "gustos-mitad", "a mitad del mazo");
    }
    await shot(page, "gustos-fin-swipes", "tras la última carta");
    await esperando(page, "gustos-leyendo", 60000, 5000);
    await shot(page, "estilo-reveal", "tu arquetipo");
    await avanzar(page, { espera: 2500 });

    // ── 4. Pares de corte ────────────────────────────────────────────────
    await shot(page, "pares-1", "cómo te queda · 1 de 2");
    await eligeOpcion(page, 0);
    await page.waitForTimeout(1200);
    await shot(page, "pares-2", "cómo te queda · 2 de 2");
    await eligeOpcion(page, 0);
    await page.waitForTimeout(2500);
    await shot(page, "tras-pares", "¿va directo a colores? (la calibración salió del onboarding)");

    // ── 5. Colorimetría ──────────────────────────────────────────────────
    // Tiene PORTADA con gate ("va, hagámoslo" / "ahora no") antes de la primera
    // pregunta — pasarla por alto dejaba el recorrido dando vueltas ahí.
    await shot(page, "color-portada", "la portada del quiz, con salida");
    await page.locator('button:has-text("hagámoslo")').first().click();
    await page.waitForTimeout(1500);
    for (let i = 0; i < 12; i++) {
      if (!page.url().includes("colorimetria")) break;
      await shot(page, `color-q${i + 1}`);
      if (await inventario(page, `color-q${i + 1}`)) { /* sólo la 1a vez */ }
      const op = await eligeOpcion(page, 0);
      if (!op) break;
      await page.waitForTimeout(1100);
      if (await hay(page, "tu paleta")) break;
      if (await hay(page, "Tu paleta")) break;
    }
    await esperando(page, "color-calculando", 40000, 4000);
    await shot(page, "colorimetria-resultado", "tu estación");
    await avanzar(page, { espera: 3000 });

    // ── 6. Básicos ───────────────────────────────────────────────────────
    // NO es una pantalla: son CINCO, encadenadas por categoría (Arriba →
    // Sacos → Abajo → Abrigos → Zapatos) con un CTA que dice "sigue con X".
    // Ahí es donde se esconden las 48 prendas que enseña /admin/basicos.
    for (let cat = 0; cat < 8; cat++) {
      await shot(page, `basicos-${cat + 1}`, cat === 0 ? "paso 3 de 5 — primera categoría" : "");
      // Marcar 3 por categoría: lo que haría alguien de verdad, no las 48.
      const tarjetas = await page.locator("button").all();
      let marcadas = 0;
      for (const t of tarjetas) {
        if (marcadas >= 3) break;
        const r = await t.boundingBox();
        if (!r || r.height < 150) continue; // las tarjetas son altas; los tabs no
        await t.click().catch(() => {});
        marcadas += 1;
        await page.waitForTimeout(120);
      }
      const cta = await avanzar(page, { espera: 2500 });
      console.log(`   básicos cat ${cat + 1}: ${marcadas} marcadas · CTA "${cta}"`);
      // Cortar por URL y no por el texto del CTA: cambia de pantalla a
      // pantalla ("sigue con abajo", "sigue con zapatos", "¿tienes sacos?"…).
      if (!cta || !page.url().includes("/onboarding/closet")) break;
    }

    // ── 7. Objetivo (paso 4 de 5) ────────────────────────────────────────
    await shot(page, "objetivo", "paso 4 de 5 — qué necesitas hoy");
    // Las opciones de este paso NO son <button> (son labels/inputs), así que
    // se pican por texto sin importar la etiqueta.
    await page.getByText("día a día", { exact: false }).first().click();
    await page.waitForTimeout(600);
    await shot(page, "objetivo-marcado");
    await avanzar(page, { espera: 3000 });

    // ── 8. El wow ────────────────────────────────────────────────────────
    // El "paso 5 de 5" NO es una pantalla: trae su propio mini-wizard con su
    // propio contador que reinicia en 1 ("paso 1 de 2: ¿de día o de noche?" →
    // el clima → generar). Se recorre en bucle hasta que arranca la generación.
    for (let i = 0; i < 5; i++) {
      if (!page.url().includes("/onboarding/wow")) break;
      await shot(page, `wow-pregunta${i + 1}`, i === 0 ? "el wow empieza preguntando" : "");
      await eligeOpcion(page, 0);
      const cta = await avanzar(page, { espera: 2500 });
      console.log(`   wow paso ${i + 1}: CTA "${cta}"`);
      if (/armar mi look/i.test(String(cta))) break;
    }
    await shot(page, "wow-arranca", "arranca la generación del primer look");
    const segWow = await esperando(page, "wow-generando", 120000, 6000);
    await shot(page, "wow-opciones", `los outfits, ${segWow}s de espera`);
    await inventario(page, "wow");

    // ── 9. El avatar ─────────────────────────────────────────────────────
    // Se entra por donde lo ofrezca la propia pantalla; si no, por la ruta
    // directa con el return al wow (que es como llega la gente desde el nudge).
    const entrada = page.locator('a:has-text("avatar"), button:has-text("avatar")').first();
    if (await entrada.count()) {
      await entrada.click();
      await page.waitForTimeout(2500);
    } else {
      await page.goto(`${BASE}/perfil/avatar?return=%2Fonboarding%2Fwow`, { waitUntil: "networkidle" });
    }
    await shot(page, "avatar-fotos", "paso 1 de 3 del avatar");
    await page.setInputFiles('input[type="file"]', CARA);
    await page.waitForTimeout(2500);
    await shot(page, "avatar-foto-puesta", "con la foto cargada");
    await page.locator('button:has-text("empezar")').first().click();
    await page.waitForTimeout(1500);

    // El cambio de hoy: las preguntas MIENTRAS se dibuja el retrato.
    await shot(page, "avatar-cuerpo", "paso 2 de 3 — con el retrato dibujándose encima");
    // ELEGIR COMPLEXIÓN ES OBLIGATORIO: sin ella el CTA queda deshabilitado
    // (puedeGenerar), y el recorrido se quedaba mirando la pantalla sin avanzar.
    await page.locator('button:has-text("Promedio")').first().click();
    await page.waitForTimeout(400);
    const alto = page.locator('input[type="number"]').first();
    if (await alto.count()) await alto.fill("178");
    await shot(page, "avatar-cuerpo-lleno", "complexión + estatura");
    await avanzar(page, { espera: 2000 });
    const segCara = await esperando(page, "avatar-retrato-esperando", 90000, 6000);
    await shot(page, "avatar-retrato", `el retrato + el juez (${segCara}s tras contestar)`);
    await page.locator('button:has-text("soy yo")').first().click();
    await page.waitForTimeout(1500);
    const segCuerpo = await esperando(page, "avatar-cuerpo-generando", 120000, 6000);
    await shot(page, "avatar-listo", `el avatar de cuerpo entero (${segCuerpo}s)`);
    await inventario(page, "avatar-listo");
    await page.locator('button:has-text("quedó")').first().click();
    // Guardar el avatar sube dos imágenes: 4s no alcanzaban y el recorrido
    // llegaba al look con la pantalla todavía en "Guardando…".
    await page.waitForURL((u) => !u.pathname.includes("/perfil/avatar"), { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3000);

    // ── 10. De vuelta al look, y el try-on ───────────────────────────────
    await shot(page, "vuelta-al-look", "de regreso del avatar");
    const verme = page.locator('button:has-text("verme"), button:has-text("así te queda")').first();
    if (await verme.count()) {
      await verme.click();
      await page.waitForTimeout(1500);
      const segTry = await esperando(page, "tryon-generando", 120000, 6000);
      await shot(page, "tryon-listo", `puesto en tu avatar (${segTry}s)`);
    } else {
      await shot(page, "tryon-sin-entrada", "no encontré cómo probarlo");
      await inventario(page, "sin-tryon");
    }

  } catch (e) {
    console.error("FALLO:", e.message);
    await shot(page, "FALLO", e.message.slice(0, 140));
  }

  fs.writeFileSync(path.join(OUT, "bitacora.json"), JSON.stringify(bitacora, null, 1));
  console.log(`\n${n} capturas · ${Math.round((Date.now() - t00) / 1000)}s totales`);
  await browser.close();
})();
