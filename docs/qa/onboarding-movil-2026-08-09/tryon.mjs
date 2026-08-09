// Cierra el recorrido: elegir uno de los looks del wow y probárselo en el
// avatar. Va aparte para no repetir las tres generaciones que ya se pagaron —
// la cuenta ya quedó con avatar y con sus dos outfits.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = process.argv[2] ?? "./capturas";
let n = Number(process.argv[3] ?? 52);
const extra = [];
const t00 = Date.now();

async function shot(page, nombre, nota = "") {
  n += 1;
  const archivo = `${String(n).padStart(2, "0")}-${nombre}.png`;
  await page.screenshot({ path: path.join(OUT, archivo) });
  const texto = await page.evaluate(() => document.body.innerText).catch(() => "");
  extra.push({ n, archivo, nota, seg: Math.round((Date.now() - t00) / 1000), url: page.url().replace(BASE, ""), texto, controles: [] });
  console.log(`  [${n}] ${archivo}${nota ? " — " + nota : ""}`);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "es-MX",
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.locator('form:has(input[value="claude.dev@stailist.app"]) button').click();
    await page.waitForTimeout(4000);
    await page.goto(`${BASE}/onboarding/wow`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await shot(page, "wow-selector", "elegir entre los looks — y prueba de que NO regenera al volver");
    const cta = page.locator('button:has-text("empezar con")').first();
    if (await cta.count()) {
      await cta.click();
      await page.waitForTimeout(2500);
    }
    await shot(page, "look-elegido", "el detalle del look");
    const verme = page
      .locator('button:has-text("verme"), button:has-text("así te queda"), button:has-text("Ver en tu avatar")')
      .first();
    if (await verme.count()) {
      await verme.click();
      await page.waitForTimeout(2000);
      for (let i = 1; i <= 12; i++) {
        await page.waitForTimeout(6000);
        await shot(page, `tryon-generando-espera${i}`, `${i * 6}s`);
        const sigue = await page
          .evaluate(() => /generando|montando|poniendo|probando|un momento|espera|vistiendo/i.test(document.body.innerText))
          .catch(() => false);
        if (!sigue) break;
      }
      await shot(page, "tryon-listo", "el look puesto en tu avatar");
    } else {
      const inv = await page.evaluate(() =>
        [...document.querySelectorAll("button")].filter((b) => b.offsetParent).map((b) => b.innerText.replace(/\s+/g, " ").trim().slice(0, 40))
      );
      console.log("   sin botón de try-on:", JSON.stringify(inv));
      await shot(page, "sin-tryon", "no encontré la entrada al try-on");
    }
  } catch (e) {
    console.error("FALLO:", e.message);
    await shot(page, "FALLO-tryon", e.message.slice(0, 120));
  }
  fs.writeFileSync(path.join(OUT, "bitacora-extra.json"), JSON.stringify(extra, null, 1));
  await browser.close();
})();
