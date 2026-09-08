// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { Hint } from "@/components/hint";

// LA NOTA DEL COACH-MARK TIENE QUE VERSE (2026-09-08). Roberto, en el home
// recién desplegado: "nada más se marcó lo de añadir prendas, pero no sale el
// textito". El hoyo se dibujaba y la nota quedaba `visibility: hidden` para
// siempre: `measure` corre en un useLayoutEffect, encuentra el target en el
// primer frame y pone `ready` ANTES de que el useEffect ponga `mounted`; en ese
// render no hay nota, el efecto que la mide corre con la ref vacía y —con
// `ready` como única dependencia— no volvía a correr. Sólo pasa cuando el
// target ya está en pantalla al montar, que es exactamente el caso de un tile
// del home.
//
// POR QUÉ NO USA render() DE TESTING-LIBRARY: act() aplana los efectos —
// layout y pasivos se vacían juntos y React re-renderiza UNA vez con `ready` y
// `mounted` ya en true, así que la carrera no existe dentro de act() y el test
// pasaba con y sin el fix (comprobado). Con createRoot a pelo, como en el
// navegador, el setState del layout effect re-renderiza SÍNCRONO antes de que
// corra el efecto pasivo, y la carrera aparece.

const dismissHint = vi.fn(async (_id: string) => {});
vi.mock("@/lib/hints", () => ({ dismissHint: (id: string) => dismissHint(id) }));

let root: Root | null = null;
let host: HTMLDivElement | null = null;

const tick = (ms = 80) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  // Fuera de act: que React no se queje de updates sin act (es a propósito).
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = false;
  // Móvil: es el único camino que dibuja el coach-mark (desktop pinta un banner).
  window.matchMedia = ((q: string) =>
    ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList) as typeof window.matchMedia;
  // jsdom no tiene layout: todo mide 0 y no existe elementFromPoint. Le damos
  // cajas reales y un "encima" que es el propio target (no hay overlay).
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    }
  );
  Element.prototype.getBoundingClientRect = () =>
    ({ top: 400, left: 10, width: 300, height: 60, right: 310, bottom: 460, x: 10, y: 400, toJSON() {} }) as DOMRect;
  Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get: () => document.body });
  // Lookup vivo: el target del test anterior ya no existe y una referencia
  // vieja haría que el coach-mark creyera que hay algo encima y cediera.
  document.elementFromPoint = () => document.querySelector('[data-hint-target="hoy-prendas"]');
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(async () => {
  root?.unmount();
  await tick(20);
  host?.remove();
  root = null;
  host = null;
  vi.unstubAllGlobals();
  dismissHint.mockClear();
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
});

async function montar() {
  root = createRoot(host!);
  root.render(
    <div>
      <button type="button" data-hint-target="hoy-prendas">
        añadir prendas
      </button>
      <Hint id="hoy-prendas">empieza por aquí: sube fotos de tu ropa de golpe</Hint>
    </div>
  );
  // Varios turnos: matchMedia → isMobile, luego measure, luego mounted, luego la nota.
  for (let i = 0; i < 6; i++) await tick();
}

describe("coach-mark — con el target en pantalla desde el primer frame (sin act)", () => {
  it("dibuja el hoyo Y la nota visible, con el texto", async () => {
    await montar();
    expect(document.querySelector(".hint-hole")).not.toBeNull();
    const nota = document.querySelector<HTMLElement>(".hint-note");
    expect(nota).not.toBeNull();
    expect(nota!.textContent).toContain("empieza por aquí");
    // Sin el fix, esto se quedaba en "hidden" para siempre.
    expect(nota!.style.visibility).not.toBe("hidden");
  });

  it("'entendido' marca el tip como visto y lo quita", async () => {
    await montar();
    const dialog = document.querySelector("[role=dialog]");
    expect(dialog).not.toBeNull();
    const botones = dialog!.querySelectorAll("button");
    const ok = botones[botones.length - 1];
    ok.click();
    await tick();
    expect(dismissHint).toHaveBeenCalledWith("hoy-prendas");
    expect(document.querySelector(".hint-note")).toBeNull();
  });
});
