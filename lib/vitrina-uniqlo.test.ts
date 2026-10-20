// LA VITRINA DE UNIQLO — lo que se blinda es QUÉ prenda se le enseña a quién.
//
// La API de Uniqlo devuelve de todo: hombre, mujer, niños, veinte colores. La
// decisión de producto es que una pieza que te FALTA se cubra sólo con una
// prenda de tu segmento y de tu color, o con nada. Un refactor que mueva el
// filtro de género al parámetro de la URL (que NO filtra, medido el
// 2026-10-20) o que relaje el color no rompe ninguna pantalla: sólo empieza a
// ofrecerle a una mujer un suéter de niño, o a alguien de paleta fría un vino
// que no es el suyo. Por eso los tests miran la fixture grabada de la API
// (lib/__fixtures__/uniqlo-us-sweater.json) y lo que sale de elegirPrendas.
import { describe, expect, it, vi } from "vitest";
import fixture from "./__fixtures__/uniqlo-us-sweater.json";
import {
  VITRINA_HASTA,
  claveVitrina,
  coloresDe,
  consultarUniqlo,
  elegirPrendas,
  fotoSegura,
  mercadoDeParada,
  mercadosDeParadas,
  precioTexto,
  terminoDe,
  urlDeFicha,
  type UniqloItem,
} from "./vitrina-uniqlo";

const HOY = new Date("2026-10-21T12:00:00Z");
const items = fixture.result.items as unknown as UniqloItem[];

describe("mercadoDeParada: el país al final del lugar, y sólo mientras la prueba viva", () => {
  it("reconoce los tres países con tienda en línea, con y sin acento", () => {
    expect(mercadoDeParada("Mineápolis, Minnesota, Estados Unidos", HOY)).toBe("us");
    expect(mercadoDeParada("Kioto, Prefectura de Kioto, Japón", HOY)).toBe("jp");
    expect(mercadoDeParada("Tokio, Japon", HOY)).toBe("jp");
    expect(mercadoDeParada("Seúl, Seúl, Corea del Sur", HOY)).toBe("kr");
  });

  it("no inventa mercado: México, Europa, un lugar sin coma o vacío → null", () => {
    expect(mercadoDeParada("Ciudad de México, México", HOY)).toBeNull();
    expect(mercadoDeParada("París, Francia", HOY)).toBeNull();
    expect(mercadoDeParada("Tokio", HOY)).toBeNull();
    expect(mercadoDeParada("", HOY)).toBeNull();
    expect(mercadoDeParada(null, HOY)).toBeNull();
  });

  it("pasada VITRINA_HASTA todo devuelve null: la prueba se apaga sola", () => {
    const despues = new Date(`${VITRINA_HASTA}T12:00:00Z`);
    despues.setUTCDate(despues.getUTCDate() + 1);
    expect(mercadoDeParada("Tokio, Japón", despues)).toBeNull();
    expect(mercadoDeParada("Tokio, Japón", new Date(`${VITRINA_HASTA}T10:00:00Z`))).toBe("jp");
  });

  it("un viaje con varias paradas en el mismo país consulta ese mercado una sola vez", () => {
    const paradas = [
      { lugar: "Mineápolis, Minnesota, Estados Unidos" },
      { lugar: "Seúl, Seúl, Corea del Sur" },
      { lugar: "Kioto, Prefectura de Kioto, Japón" },
      { lugar: "Tokio, Tokio, Japón" },
    ];
    expect(mercadosDeParadas(paradas, HOY)).toEqual(["us", "kr", "jp"]);
    expect(mercadosDeParadas([{ lugar: "Guadalajara, Jalisco, México" }], HOY)).toEqual([]);
    expect(mercadosDeParadas(null, HOY)).toEqual([]);
  });
});

describe("terminoDe: el tipo canónico, en inglés, con sus modificadores", () => {
  it("canoniza plurales y sinónimos como al guardar (jeans → jean → jeans)", () => {
    expect(terminoDe("jeans")).toBe("jeans");
    expect(terminoDe("jean")).toBe("jeans");
    expect(terminoDe("botas")).toBe("boots");
    expect(terminoDe("sueter")).toBe("sweater");
  });

  it("traduce el modificador cuando cambia la prenda y lo ignora cuando no", () => {
    expect(terminoDe("vestido-punto")).toBe("knit dress");
    expect(terminoDe("chamarra-mezclilla")).toBe("denim jacket");
    expect(terminoDe("pantalon-wide-leg")).toBe("wide pants");
    expect(terminoDe("sudadera-cierre")).toBe("zip sweatshirt");
    expect(terminoDe("sueter-grueso")).toBe("sweater");
    expect(terminoDe("cuello-alto")).toBe("turtleneck");
    expect(terminoDe("cuello-tortuga")).toBe("turtleneck");
  });

  it("una cabeza desconocida no se busca: mejor nada que cualquier cosa", () => {
    expect(terminoDe("reloj")).toBeNull();
    expect(terminoDe("")).toBeNull();
    expect(terminoDe(null)).toBeNull();
  });
});

describe("coloresDe: familias de la cápsula → nombres de Uniqlo", () => {
  it("vino y rubí caen en WINE/RED; negro sólo en BLACK; desconocido en nada", () => {
    expect(coloresDe("vino")).toEqual(["WINE", "DARK RED"]);
    expect(coloresDe("rubí")).toContain("WINE");
    expect(coloresDe("negro")).toEqual(["BLACK"]);
    expect(coloresDe("gris carbón")).toEqual(["DARK GRAY"]);
    expect(coloresDe("neutro claro")).toContain("OFF WHITE");
    expect(coloresDe("plata")).toEqual([]);
    expect(coloresDe(null)).toEqual([]);
  });
});

describe("elegirPrendas: tu segmento, tu color, hasta dos, las mejor calificadas", () => {
  it("para una mujer de color rojo/vino: sólo WOMEN o UNISEX en RED, nunca KIDS ni MEN", () => {
    const out = elegirPrendas(items, { segmento: "mujer", colorFamilia: "rojo" }, "us", "2026-10-20T12:00:00Z");
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(2);
    for (const p of out) {
      expect(p.color).toBe("RED");
      expect(p.mercado).toBe("us");
      // La ficha abre en EL color que se enseñó, no en el color por defecto.
      expect(p.url).toMatch(/^https:\/\/www\.uniqlo\.com\/us\/en\/products\/E\d+-000\/00\?colorDisplayCode=\d{2}$/);
      expect(p.foto.startsWith("https://image.uniqlo.com/UQ/")).toBe(true);
      expect(p.vistoEl).toBe("2026-10-20T12:00:00Z");
    }
    // El suéter de niños de la fixture también es RED y no entra.
    const kids = items.find((i) => i.genderCategory === "KIDS")!;
    expect(out.some((p) => p.id.includes(kids.productId!))).toBe(false);
  });

  it("para un hombre: MEN o UNISEX; la de mujer en el mismo color queda fuera", () => {
    const out = elegirPrendas(items, { segmento: "hombre", colorFamilia: "gris carbón" }, "us");
    expect(out.length).toBeGreaterThan(0);
    for (const p of out) expect(p.color).toBe("DARK GRAY");
    const mujerGris = items.find((i) => i.genderCategory === "WOMEN" && i.colors?.some((c) => c.name === "DARK GRAY"))!;
    expect(out.some((p) => p.id.includes(mujerGris.productId!))).toBe(false);
  });

  it("sin empate de color no hay prenda: nunca se rellena el hueco con otro color", () => {
    expect(elegirPrendas(items, { segmento: "mujer", colorFamilia: "gris claro" }, "us")).toEqual([]);
    expect(elegirPrendas(items, { segmento: "mujer", colorFamilia: "plata" }, "us")).toEqual([]);
  });

  it("tope de dos y orden por calificación; calificación ausente cuenta como 0", () => {
    const base = items.find((i) => i.genderCategory === "WOMEN")!;
    const clon = (id: string, rating: number | null): UniqloItem => ({
      ...base,
      productId: id,
      rating: rating === null ? null : { average: rating },
      colors: [{ name: "BLACK", displayCode: "09" }],
      images: { main: { "09": { image: "https://image.uniqlo.com/UQ/ST3/us/imagesgoods/x/item/x_09.jpg" } } },
    });
    const out = elegirPrendas([clon("E1-000", 3.1), clon("E2-000", null), clon("E3-000", 4.9)], { segmento: "mujer", colorFamilia: "negro" }, "jp");
    expect(out.map((p) => p.id)).toEqual(["jp:E3-000:09", "jp:E1-000:09"]);
    expect(out[0].precioTexto).toMatch(/^¥/);
  });

  it("una prenda sin foto de su color, sin precio o con host de foto ajeno se descarta", () => {
    const base = items.find((i) => i.genderCategory === "WOMEN" && i.colors?.some((c) => c.name === "RED"))!;
    const sinFoto: UniqloItem = { ...base, images: { main: {} } };
    const sinPrecio: UniqloItem = { ...base, prices: { base: null } };
    const hostAjeno: UniqloItem = {
      ...base,
      images: { main: { "13": { image: "https://cdn.otro.com/foto.jpg" } } },
      colors: [{ name: "RED", displayCode: "13" }],
    };
    expect(elegirPrendas([sinFoto, sinPrecio, hostAjeno], { segmento: "mujer", colorFamilia: "rojo" }, "us")).toEqual([]);
  });
});

describe("piezas chicas", () => {
  it("fotoSegura sólo deja pasar el host de Uniqlo con https", () => {
    expect(fotoSegura("https://image.uniqlo.com/UQ/ST3/us/imagesgoods/1/item/a.jpg")).toBeTruthy();
    expect(fotoSegura("http://image.uniqlo.com/UQ/a.jpg")).toBeNull();
    expect(fotoSegura("https://cdn.otro.com/a.jpg")).toBeNull();
    expect(fotoSegura(null)).toBeNull();
  });

  it("precio con la moneda del mercado y la ficha del mercado", () => {
    expect(precioTexto("us", 49.9)).toBe("US$49.90");
    expect(precioTexto("jp", 2990)).toBe("¥2,990");
    expect(precioTexto("kr", 129000)).toBe("₩129,000");
    expect(urlDeFicha("kr", "E1-000")).toBe("https://www.uniqlo.com/kr/ko/products/E1-000/00");
    expect(urlDeFicha("us", "E487294-000", "19")).toBe("https://www.uniqlo.com/us/en/products/E487294-000/00?colorDisplayCode=19");
  });

  it("la clave de eventos canoniza el tipo y normaliza el color", () => {
    expect(claveVitrina("mujer", "jeans", "Negro")).toBe("mujer|jean|negro");
    expect(claveVitrina("hombre", "Botas altas", "gris carbón")).toBe("hombre|bota-altas|gris carbon");
  });
});

describe("consultarUniqlo: el único fetch; todo fallo es vacío y aviso, nunca un error en la página", () => {
  const respuesta = (body: unknown, status = 200, date = "Tue, 20 Oct 2026 19:08:26 GMT") =>
    ({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k: string) => (k === "date" ? date : null) },
      json: async () => body,
    }) as unknown as Response;

  it("con status ok devuelve los ítems y la fecha de la respuesta, pidiendo caché de 7 días y limit 20", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => respuesta(fixture));
    const out = await consultarUniqlo("us", "sweater", { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(out.items.length).toBe(items.length);
    expect(out.vistoEl).toBe("Tue, 20 Oct 2026 19:08:26 GMT");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain("/us/api/commerce/v5/en/products?q=sweater&offset=0&limit=20&httpFailure=true");
    expect(init).toMatchObject({ cache: "force-cache", next: { revalidate: 604800 } });
  });

  it("http 403, status nok y timeout → vacío + aviso con el mercado", async () => {
    const avisos: string[] = [];
    const onError = async (m: string, msg: string) => {
      avisos.push(`${m}:${msg}`);
    };
    const f403 = vi.fn(async () => respuesta({}, 403));
    expect((await consultarUniqlo("jp", "jeans", { fetchImpl: f403 as unknown as typeof fetch, onError })).items).toEqual([]);
    const fNok = vi.fn(async () => respuesta({ status: "nok", error: { code: 0 } }));
    expect((await consultarUniqlo("kr", "jeans", { fetchImpl: fNok as unknown as typeof fetch, onError })).items).toEqual([]);
    const fTimeout = vi.fn(async () => {
      const e = new Error("The operation was aborted due to timeout");
      e.name = "TimeoutError";
      throw e;
    });
    expect((await consultarUniqlo("us", "jeans", { fetchImpl: fTimeout as unknown as typeof fetch, onError })).items).toEqual([]);
    expect(avisos).toEqual(["jp:http 403", "kr:status nok", "us:timeout"]);
  });

  it("una consulta vacía no toca la red (la API contesta nok 'must not be empty')", async () => {
    const fetchImpl = vi.fn(async () => respuesta(fixture));
    expect((await consultarUniqlo("us", "  ", { fetchImpl: fetchImpl as unknown as typeof fetch })).items).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
