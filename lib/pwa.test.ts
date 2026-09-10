// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { notifyFirstLike, notifyLookListo } from "./pwa";

// LA PWA SE OFRECÍA A CASI NADIE (auditoría 2026-09-09). El prompt de instalar
// vivía SOLO tras el primer 👍 — buena teoría (el pico emocional), pero el 👍
// casi no ocurre: 9 personas en toda la vida del producto han dado al menos
// uno, de 24 que llegaron a generar un look. A las otras 15 nunca se les
// ofreció. Se AÑADE un segundo momento sin quitar el primero, y cada uno viaja
// con su motivo para poder medir cuál convierte.
afterEach(() => vi.restoreAllMocks());

const capturar = () => {
  const visto: string[] = [];
  const h = (e: Event) => visto.push((e as CustomEvent<string>).detail);
  window.addEventListener("stailist:pwa-momento", h);
  return { visto, quitar: () => window.removeEventListener("stailist:pwa-momento", h) };
};

describe("los dos momentos donde se ofrece instalar la app", () => {
  it("el 👍 sigue disparando, y se identifica como 'like'", () => {
    const c = capturar();
    notifyFirstLike();
    c.quitar();
    expect(c.visto).toEqual(["like"]);
  });

  it("un look listo también dispara, identificado como 'look'", () => {
    const c = capturar();
    notifyLookListo();
    c.quitar();
    expect(c.visto).toEqual(["look"]);
  });

  it("los dos usan el MISMO evento: el prompt decide una vez, no dos veces", () => {
    // Si cada uno disparara su propio evento, el componente tendría dos
    // caminos y el flag de "ya se vio" podría no cubrir los dos.
    const c = capturar();
    notifyFirstLike();
    notifyLookListo();
    c.quitar();
    expect(c.visto).toHaveLength(2);
  });

  it("cada uno lleva su motivo: sin eso no se sabe cuál de los dos convierte", () => {
    const c = capturar();
    notifyFirstLike();
    notifyLookListo();
    c.quitar();
    expect(new Set(c.visto)).toEqual(new Set(["like", "look"]));
  });
});
