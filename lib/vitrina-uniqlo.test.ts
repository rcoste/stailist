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
  cabezaDeTermino,
  categoriasQueEmpatan,
  coloresDe,
  colorQueEmpata,
  consultarUniqloEnCategoria,
  consultarVitrina,
  consultasPara,
  puntosDeParecido,
  respetaModificadores,
  elegirCercana,
  familiasEnTexto,
  vecinosDe,
  textoDePieza,
  familiaDePieza,
  tonosDe,
  consultarUniqlo,
  elegirPrendas,
  cuelloCompatible,
  esRopaInterior,
  estampadoNoPedido,
  funcionCompatible,
  materialCompatible,
  mostrarPesos,
  numeroDeProducto,
  pesosAprox,
  tasasAMxn,
  validarCompra,
  temporadaCompatible,
  viajeEsFrio,
  fotoSegura,
  mangaCompatible,
  mangaDe,
  nombreCoincide,
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

describe("categoría de Uniqlo: filtrar en origen lo que la búsqueda de texto trae de más", () => {
  it("la cabeza del término es la última palabra, o las dos últimas si son una prenda", () => {
    expect(cabezaDeTermino("linen shorts")).toBe("shorts");
    expect(cabezaDeTermino("short sleeve polo shirt")).toBe("polo shirt");
    expect(cabezaDeTermino("rain trench coat")).toBe("trench coat");
    expect(cabezaDeTermino("t-shirt")).toBe("t-shirt");
  });

  it("elige por NOMBRE las categorías que nombran la prenda, en los tres idiomas, y deja fuera las mezclas", () => {
    const arbolUs = [
      { id: 23386, name: "T-Shirts" },
      { id: 23335, name: "T-Shirts and Tank Tops" },
      { id: 151199, name: "T-Shirts, Sweats & Fleece" },
      { id: 23385, name: "Sweatshirts & Hoodies" },
      { id: 24782, name: "UT: Graphic Tees" },
    ];
    expect(categoriasQueEmpatan(arbolUs, "t-shirt")).toEqual(["23386", "23335"]);
    expect(categoriasQueEmpatan(arbolUs, "sweatshirt")).toEqual(["23385"]);
    expect(categoriasQueEmpatan([{ id: 57995, name: "티셔츠 (긴팔 & 반팔)" }, { id: 150429, name: "팬츠" }], "t-shirt")).toEqual(["57995"]);
    expect(categoriasQueEmpatan([{ id: 1568, name: "Tシャツ・カットソー" }], "long t-shirt")).toEqual(["1568"]);
    // Sin entrada en el diccionario (top) o sin árbol: no se filtra.
    expect(categoriasQueEmpatan(arbolUs, "top")).toEqual([]);
    expect(categoriasQueEmpatan(null, "t-shirt")).toEqual([]);
  });

  it("consultarUniqloEnCategoria: dos pasos, y si el filtro deja vacío se queda la primera", async () => {
    const con = (items: UniqloItem[], categories: { id: number; name: string }[]) =>
      ({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ status: "ok", result: { items, aggregations: { tree: { categories } } } }),
      }) as unknown as Response;
    const arbol = [{ id: 95665, name: "Sweaters" }, { id: 23385, name: "Sweatshirts & Hoodies" }];
    const llamadas: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      llamadas.push(String(url));
      return String(url).includes("categoryId=95665") ? con(items.slice(0, 2), arbol) : con(items, arbol);
    });
    const out = await consultarUniqloEnCategoria("us", "sweater", { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(llamadas).toHaveLength(2);
    expect(llamadas[1]).toContain("q=sweater");
    expect(llamadas[1]).toContain("categoryId=95665");
    expect(out.items).toHaveLength(2);
    expect(out.filtradaPorCategoria).toBe(true);

    const fetchVacia = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("categoryId=") ? con([], arbol) : con(items, arbol)
    );
    const sinFiltro = await consultarUniqloEnCategoria("us", "sweater", { fetchImpl: fetchVacia as unknown as typeof fetch });
    expect(sinFiltro.items).toHaveLength(items.length);
    expect(sinFiltro.filtradaPorCategoria).toBeUndefined();

    // Sin categoría que nombre la prenda, UNA sola llamada (como hasta hoy).
    const fetchUna = vi.fn(async () => con(items, [{ id: 1, name: "Bottoms" }]));
    await consultarUniqloEnCategoria("us", "sweater", { fetchImpl: fetchUna as unknown as typeof fetch });
    expect(fetchUna).toHaveBeenCalledTimes(1);
  });
});

describe("escalones de búsqueda: bajar sólo cuando hay cero, nunca cuando falla", () => {
  it("del término completo a la prenda, a la palabra base y, en JP/KR, al nombre local medido", () => {
    expect(consultasPara("leather ankle boots", "jp")).toEqual(["leather ankle boots", "ankle boots", "boots"]);
    expect(consultasPara("hoodie sweatshirt", "jp")).toEqual(["hoodie sweatshirt", "sweatshirt", "スウェット"]);
    expect(consultasPara("knit beanie", "kr")).toEqual(["knit beanie", "beanie", "비니"]);
    // EE. UU. nunca recibe el nombre local; un término sin modificadores es un solo escalón.
    expect(consultasPara("hoodie sweatshirt", "us")).toEqual(["hoodie sweatshirt", "sweatshirt"]);
    expect(consultasPara("sweater", "us")).toEqual(["sweater"]);
    expect(consultasPara("  ", "us")).toEqual([]);
  });

  const resp = (items: UniqloItem[], categories: { id: number; name: string }[] = []) =>
    ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({ status: "ok", result: { items, aggregations: { tree: { categories } } } }),
    }) as unknown as Response;

  it("con cero baja al siguiente escalón y devuelve la palabra que sí trajo algo", async () => {
    const pedidas: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const q = new URL(String(url)).searchParams.get("q")!;
      pedidas.push(q);
      return q === "boots" ? resp(items.slice(0, 1)) : resp([]);
    });
    const r = await consultarVitrina("jp", "leather ankle boots", { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(pedidas).toEqual(["leather ankle boots", "ankle boots", "boots"]);
    expect(r.q).toBe("boots");
    expect(r.items).toHaveLength(1);
  });

  it("baja también cuando lo que vino no SIRVE (nada pasa los filtros), y si nada sirve se queda con lo más específico", async () => {
    const pedidas: string[] = [];
    const gris = { ...items[0], productId: "GRIS", colors: [{ name: "GRAY", displayCode: "03" }] };
    const negro = { ...items[0], productId: "NEGRO", colors: [{ name: "BLACK", displayCode: "09" }] };
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const q = new URL(String(url)).searchParams.get("q")!;
      pedidas.push(q);
      return q === "turtleneck knit sweater" ? resp([gris]) : q === "turtleneck sweater" ? resp([gris, negro]) : resp([]);
    });
    const sirve = (its: UniqloItem[]) => its.some((i) => i.colors?.some((c) => c.name === "BLACK"));
    const r = await consultarVitrina("us", "turtleneck knit sweater", { fetchImpl: fetchImpl as unknown as typeof fetch, sirve });
    expect(pedidas).toEqual(["turtleneck knit sweater", "turtleneck sweater"]);
    expect(r.q).toBe("turtleneck sweater");

    // Nada sirve en ningún escalón: el más específico que trajo algo (de ahí sale la cercana).
    const nada = await consultarVitrina("us", "turtleneck knit sweater", { fetchImpl: fetchImpl as unknown as typeof fetch, sirve: () => false });
    expect(nada.q).toBe("turtleneck knit sweater");
    expect(nada.items.map((i) => i.productId)).toEqual(["GRIS"]);
  });

  it("si la API falla, NO baja de escalón (no multiplica esperas) y avisa una vez", async () => {
    const avisos: string[] = [];
    const f403 = vi.fn(async () => ({ ok: false, status: 403, headers: { get: () => null }, json: async () => ({}) }) as unknown as Response);
    const r = await consultarVitrina("kr", "knit beanie", { fetchImpl: f403 as unknown as typeof fetch, onError: (m, msg) => void avisos.push(`${m}:${msg}`) });
    expect(f403).toHaveBeenCalledTimes(1);
    expect(r.fallo).toBe(true);
    expect(avisos).toEqual(["kr:http 403"]);
  });

  it("con el nombre local, la categoría se elige por la PRENDA buscada, no por la palabra japonesa", async () => {
    const pedidas: string[] = [];
    const arbol = [{ id: 7, name: "スウェット" }, { id: 8, name: "パンツ・ズボン" }];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const u = new URL(String(url));
      pedidas.push(`${u.searchParams.get("q")}${u.searchParams.get("categoryId") ? `#${u.searchParams.get("categoryId")}` : ""}`);
      return u.searchParams.get("q") === "スウェット" ? resp(items.slice(0, 2), arbol) : resp([], arbol);
    });
    const r = await consultarVitrina("jp", "zip sweatshirt", { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.q).toBe("スウェット");
    expect(pedidas.at(-1)).toBe("スウェット#7");
    expect(r.filtradaPorCategoria).toBe(true);
  });
});

describe("temporada en los dos sentidos: de frío no recibe verano, de calor no recibe térmico", () => {
  it("una pieza de calor no recibe HEATTECH, forro polar, borrego ni plumas, en los tres idiomas", () => {
    const calor = { nombre: "Camiseta esmeralda", temporada: "calor" };
    expect(temporadaCompatible("HEATTECH Cashmere Blend T-Shirt | Extra Warm | Turtleneck", calor)).toBe(false);
    expect(temporadaCompatible("極暖ヒートテックカシミヤブレンドリブハイネックT", calor)).toBe(false);
    expect(temporadaCompatible("히트텍캐시미어블렌드터틀넥T(긴팔)엑스트라웜", calor)).toBe(false);
    expect(temporadaCompatible("Fleece Full-Zip Jacket", calor)).toBe(false);
    expect(temporadaCompatible("Supima Cotton Crew Neck T-Shirt", calor)).toBe(true);
    expect(temporadaCompatible("AIRism Cotton T-Shirt", calor)).toBe(true);
  });

  it("la regla de frío sigue igual, y 'todo el año' sin viaje frío no filtra nada", () => {
    expect(temporadaCompatible("Linen Blend Dress", { nombre: "Vestido midi rubí", temporada: "frio" })).toBe(false);
    expect(temporadaCompatible("HEATTECH Ribbed Beanie", { nombre: "Gorro de punto negro", temporada: "frio" })).toBe(true);
    expect(temporadaCompatible("HEATTECH Ribbed Beanie", { nombre: "Gorro negro", temporada: "todo-el-año" })).toBe(true);
  });
});

describe("el orden: parecido con la pieza en los tres idiomas; las estrellas sólo desempatan", () => {
  const p = (nombreFicha: string, pieza: Parameters<typeof puntosDeParecido>[1]) => puntosDeParecido(nombreFicha, pieza);
  it("suma lo que la pieza pide y la ficha dice, en japonés y coreano también", () => {
    const abrigo = { termino: "long wool coat", nombre: "Abrigo largo de lana negro", temporada: "frio", formalidad: "formal-casual" };
    expect(p("더블페이스릴랙스롱코트", abrigo)).toBeGreaterThan(p("트렌치코트", abrigo));
    const cuello = { termino: "turtleneck sweater", nombre: "Suéter de cuello alto negro" };
    expect(p("カシミヤタートルネックセーター", cuello)).toBeGreaterThan(p("3Dモックネックセーター", cuello));
    const cardigan = { termino: "long knit cardigan", nombre: "Cárdigan largo de punto negro" };
    expect(p("メリノVネックカーディガン", cardigan)).toBeGreaterThan(p("スムースコットンフルジップカーディガン", cardigan));
  });

  it("resta lo que contradice la pieza: forrado para ligero, cepillado para popelina, plumas para lana, borrego para punto", () => {
    const pantalon = { termino: "smart pants", nombre: "Pantalón de vestir negro ligero" };
    expect(p("ウォームスマートパンツ", pantalon)).toBeLessThan(p("2Wayストレッチスマートパンツ", pantalon));
    const camisa = { termino: "shirt", nombre: "Camisa de popelina negra" };
    expect(p("ブラッシュドコットンシャツ", camisa)).toBeLessThan(p("スーパーノンアイロンスリムシャツ/セミワイド", camisa));
    const abrigo = { termino: "long wool coat", nombre: "Abrigo largo de lana negro" };
    expect(p("シームレスダウンロングコート", abrigo)).toBeLessThan(p("ダブルフェイスリラックスロングコート", abrigo));
    const cardigan = { termino: "long knit cardigan", nombre: "Cárdigan largo de punto negro" };
    expect(p("보아후리스릴랙스가디건", cardigan)).toBeLessThan(p("플러피캐시미어릴랙스가디건", cardigan));
  });

  it("'manga larga' no cuenta como 'largo' de la prenda", () => {
    expect(p("Long Coat", { nombre: "Playera de manga larga rayas" })).toBe(0);
  });

  it("en elegirPrendas: una sin reseñas que se parece más gana a una de 4.9 que se parece menos", () => {
    const base = items.find((i) => i.genderCategory === "WOMEN" && i.colors?.some((c) => c.name === "BLACK"))!;
    const negro = (productId: string, name: string, average: number) => ({
      ...base,
      productId,
      name,
      colors: [{ name: "BLACK", displayCode: "09" }],
      rating: { average },
      images: { main: { "09": { image: `https://image.uniqlo.com/UQ/${productId}.jpg` } } },
    });
    const out = elegirPrendas(
      [negro("TRENCH", "Trench Coat", 4.9), negro("DOBLE", "Double Face Relaxed Long Coat", 0)],
      { segmento: "mujer", colorFamilia: "negro", termino: "long wool coat", nombre: "Abrigo largo de lana negro" },
      "us",
      null,
      1
    );
    expect(out.map((x) => x.productId)).toEqual(["DOBLE"]);
  });
});

describe("lo que un filtro exige va en la búsqueda (2026-10-21: el suéter de cuello alto que se quedaba vacío)", () => {
  it("el cuello alto o en V entra al término, venga del tipo, del nombre o de la descripción", () => {
    expect(terminoDe("sueter-cuello-alto", "Suéter de cuello alto negro")).toBe("turtleneck sweater");
    expect(terminoDe("sueter", "Suéter de punto vino", "punto medio, cuello alto suelto, manga globo discreta")).toBe("turtleneck knit sweater");
    expect(terminoDe("sueter", "Suéter de punto vino", "punto fino, cuello en V suave, silueta entallada")).toBe("v-neck knit sweater");
    // Cuello redondo es el de siempre: no se pide.
    expect(terminoDe("sueter", "Suéter de punto esmeralda", "punto grueso, cuello redondo, hombro caído")).toBe("knit sweater");
    // La cabeza "cuello" ya dice turtleneck: no se duplica.
    expect(terminoDe("cuello-alto", "Cuello alto negro")).toBe("turtleneck");
  });

  it("de la descripción sólo entra lo que filtra (piel, impermeable), no lo que ordena (punto, lana)", () => {
    expect(terminoDe("bolso", "Bolso pequeño de hombro negro", "piel estructurada, correa corta")).toContain("leather");
    expect(terminoDe("pantalon-vestir", "Pantalón de vestir gris recto", "lana fría, pinzas, tiro alto")).not.toContain("wool");
  });

  it("escalones: atributo + prenda en inglés, luego la frase local con el atributo, y sólo después se suelta", () => {
    expect(consultasPara("turtleneck sweater", "us")).toEqual(["turtleneck sweater", "sweater"]);
    expect(consultasPara("turtleneck knit sweater", "jp")).toEqual(["turtleneck knit sweater", "turtleneck sweater", "タートルネックセーター", "sweater"]);
    expect(consultasPara("v-neck knit sweater", "kr")).toEqual(["v-neck knit sweater", "v-neck sweater", "브이넥 스웨터", "sweater"]);
    expect(consultasPara("short sleeve shirt", "jp")).toEqual(["short sleeve shirt", "半袖シャツ", "shirt"]);
    expect(consultasPara("leather jacket", "kr")).toEqual(["leather jacket", "레더 재킷", "jacket"]);
    expect(consultasPara("rain jacket", "jp")).toEqual(["rain jacket", "ブロックテック", "jacket"]);
    expect(consultasPara("smart straight pants", "jp")).toEqual(["smart straight pants", "smart pants", "スラックス", "pants"]);
  });

  it("con nombres reales: el cuello de tortuga pasa en los tres idiomas; medio cierre y cuello redondo no", () => {
    const pieza = "Suéter de cuello alto negro";
    expect(cuelloCompatible("Cashmere Turtleneck Sweater", pieza)).toBe(true);
    expect(cuelloCompatible("3Dモックネックセーター", pieza)).toBe(true);
    expect(cuelloCompatible("3D니트터틀넥스웨터", pieza)).toBe(true);
    expect(cuelloCompatible("Cashmere Quarter-Zip Sweater", pieza)).toBe(false);
    expect(cuelloCompatible("Merino Crew Neck Sweater", pieza)).toBe(false);
  });
});

describe("lo que se perdió al bajar de escalón pasa a filtrar (medido en las 61 prendas recuperadas)", () => {
  it("sin escalón no se exige nada nuevo: EE. UU. con el término completo queda igual", () => {
    expect(respetaModificadores("Jeans", "straight jeans", "straight jeans")).toBe(true);
    expect(respetaModificadores("Jeans", "straight jeans", null)).toBe(true);
  });

  it("recto: basta con no contradecirlo (EZY Jeans pasa; skinny, wide y barrel no), en los tres idiomas", () => {
    expect(respetaModificadores("EZYジーンズ/丈長め", "straight jeans", "jeans")).toBe(true);
    expect(respetaModificadores("ウルトラストレッチスキニージーンズ", "straight jeans", "jeans")).toBe(false);
    expect(respetaModificadores("ハイライズワイドジーンズ", "straight jeans", "jeans")).toBe(false);
    expect(respetaModificadores("バギーバレルレッグジーンズ/丈長め", "straight jeans", "jeans")).toBe(false);
  });

  it("largo: fuera lo corto ('ショート', '쇼트'); un abrigo largo que no dice 'long' pasa", () => {
    expect(respetaModificadores("ノンキルトダウンショートコート", "long wool coat", "coat")).toBe(false);
    expect(respetaModificadores("울블렌드쇼트코트", "long wool coat", "coat")).toBe(false);
    expect(respetaModificadores("ダブルフェイスリラックスロングコート", "long wool coat", "coat")).toBe(true);
    expect(respetaModificadores("더플코트", "long wool coat", "coat")).toBe(true);
  });

  it("mezclilla, capucha y botín: la ficha tiene que decirlo", () => {
    expect(respetaModificadores("해링턴재킷", "denim jacket", "jacket")).toBe(false);
    expect(respetaModificadores("데님재킷", "denim jacket", "jacket")).toBe(true);
    expect(respetaModificadores("ハーフボタンスウェットプルオーバー", "hoodie sweatshirt", "スウェット")).toBe(false);
    expect(respetaModificadores("スウェットプルパーカ", "hoodie sweatshirt", "スウェット")).toBe(true);
    expect(respetaModificadores("Boots", "leather ankle boots", "boots")).toBe(false);
    expect(respetaModificadores("サイドゴアブーツ", "leather ankle boots", "boots")).toBe(true);
  });

  it("lino: si se perdió al bajar, la ficha tiene que decirlo (shorts de sudadera no cubren un short de lino)", () => {
    expect(respetaModificadores("スウェットワイドショーツ", "linen shorts", "shorts")).toBe(false);
    expect(respetaModificadores("リネンブレンドイージーショーツ", "linen shorts", "shorts")).toBe(true);
    expect(respetaModificadores("옥스포드오버사이즈셔츠", "linen shirt", "shirt")).toBe(false);
    expect(respetaModificadores("프리미엄린넨셔츠", "linen shirt", "shirt")).toBe(true);
  });

  it("'long sleeve' habla de la manga, no del largo: no exige nada de largo", () => {
    expect(respetaModificadores("Crew Neck T-Shirt | Short Body", "long sleeve t-shirt", "t-shirt")).toBe(true);
  });

  it("una sudadera no es un pantalón de sudadera, en los tres idiomas", () => {
    expect(nombreCoincide("スウェットワイドパンツ", "hoodie sweatshirt")).toBe(false);
    expect(nombreCoincide("스웨트팬츠(다리길이65~71cm)", "sweatshirt")).toBe(false);
    expect(nombreCoincide("Sweat Pants", "sweatshirt")).toBe(false);
    expect(nombreCoincide("スウェットプルパーカ", "sweatshirt")).toBe(true);
  });

  it("rompevientos no baja a 'jacket': es otra prenda", () => {
    expect(consultasPara("windbreaker", "kr")).toEqual(["windbreaker"]);
  });

  it("manga corta pedida en una camisa: también en japonés y coreano la ficha tiene que decirla", () => {
    expect(mangaCompatible("イージーケアソフトシャツ", "corta", "short sleeve shirt")).toBe(false);
    expect(mangaCompatible("オープンカラーシャツ（半袖）", "corta", "short sleeve shirt")).toBe(true);
    expect(mangaCompatible("오픈칼라셔츠(반팔)", "corta", "short sleeve shirt")).toBe(true);
    // Una playera es de manga corta por defecto: no tiene que decirlo.
    expect(mangaCompatible("クルーネックT", "corta", "t-shirt")).toBe(true);
  });
});

describe("la descripción visual también manda: cuello, manga y material que el nombre calla", () => {
  it("textoDePieza junta nombre y visual; sin visual, el nombre", () => {
    expect(textoDePieza({ nombre: "Suéter de punto vino", visual: "punto medio, cuello alto suelto" })).toBe("Suéter de punto vino. punto medio, cuello alto suelto");
    expect(textoDePieza({ nombre: "Jeans negros", visual: null })).toBe("Jeans negros");
  });

  it("cuello redondo es el de siempre: no exige que la ficha lo diga, sólo que no diga otro", () => {
    expect(cuelloCompatible("Merino Sweater", "Suéter de punto esmeralda. punto grueso, cuello redondo")).toBe(true);
    expect(cuelloCompatible("Crew Neck T-Shirt", "cuello redondo")).toBe(true);
    expect(cuelloCompatible("Cashmere V-Neck Sweater", "cuello redondo")).toBe(false);
    expect(cuelloCompatible("Merino Turtleneck Sweater", "cuello redondo")).toBe(false);
    // Alto y V siguen exigiendo que la ficha lo diga.
    expect(cuelloCompatible("Merino Sweater", "cuello alto suelto")).toBe(false);
    expect(cuelloCompatible("Merino Sweater", "cuello en V suave")).toBe(false);
  });

  it("en elegirPrendas: 'cuello alto' en la descripción descarta el suéter de cuello redondo", () => {
    const base = items.find((i) => i.genderCategory === "WOMEN" && i.colors?.some((c) => c.name === "WINE"))!;
    const redondo = { ...base, productId: "CREW", name: "Cashmere Crew Neck Sweater" };
    const alto = { ...base, productId: "TURTLE", name: "Cashmere Turtleneck Sweater" };
    const sinVisual = elegirPrendas([redondo, alto], { segmento: "mujer", colorFamilia: "vino", termino: "sweater", nombre: "Suéter de punto vino" }, "us");
    expect(sinVisual.map((p) => p.id.split(":")[1]).sort()).toEqual(["CREW", "TURTLE"]);
    const conVisual = elegirPrendas(
      [redondo, alto],
      { segmento: "mujer", colorFamilia: "vino", termino: "sweater", nombre: "Suéter de punto vino", visual: "punto medio, cuello alto suelto, manga globo discreta" },
      "us"
    );
    expect(conVisual.map((p) => p.id.split(":")[1])).toEqual(["TURTLE"]);
  });
});

describe("tono por código de Uniqlo: 'GREEN' es la familia, el código es el tono", () => {
  it("el nombre de la pieza asciende la familia al tono que pide, sin saltar de familia", () => {
    expect(familiaDePieza("verde", "Camiseta esmeralda")).toBe("esmeralda");
    expect(familiaDePieza("azul", "Suéter azul rey de punto fino")).toBe("azul rey");
    expect(familiaDePieza("negro", "Jeans negros rectos")).toBe("negro");
    // "rojo" dentro de una pieza negra no cambia nada: no cabe en la familia de nombres.
    expect(familiaDePieza("negro", "Bufanda negra con rojo")).toBe("negro");
    expect(familiaDePieza("vino", null)).toBe("vino");
  });

  it("el nombre sólo estrecha, nunca ensancha: 'azul marino' con `marino` sigue siendo marino, y con `azul` se vuelve marino", () => {
    // "marino" y "azul marino" son la misma familia (NAVY): lo que importa es que no se abra a BLUE.
    expect(coloresDe(familiaDePieza("marino", "Jogger urbano azul marino"))).toEqual(["NAVY"]);
    expect(coloresDe(familiaDePieza("azul", "Jogger urbano azul marino"))).toEqual(["NAVY"]);
    expect(familiaDePieza("azul claro", "Camisa azul claro de lino")).toBe("azul claro");
    expect(familiaDePieza("gris carbón", "Pantalón gris carbón")).toBe("gris carbon");
    // Con `marino`, la palabra "azul" no abre la familia a 64-69.
    expect(vecinosDe(familiaDePieza("marino", "Polo azul marino"), "polo shirt")).toEqual([]);
  });

  it("familiasEnTexto cuenta familias distintas sin contar dos veces 'azul' dentro de 'azul marino'", () => {
    expect(familiasEnTexto("Playera de rayas blanco y negro")).toBe(2);
    expect(familiasEnTexto("Jogger urbano azul marino")).toBe(1);
    expect(familiasEnTexto("Cinturón de piel negro con hebilla dorada")).toBe(1);
    expect(familiasEnTexto(null)).toBe(0);
  });

  it("las familias con tono exigen el código; las demás van sólo por nombre", () => {
    expect(tonosDe("esmeralda")).toEqual(["55"]);
    expect(tonosDe("azul rey")).toEqual(["67"]);
    expect(tonosDe("negro")).toBeNull();
    expect(tonosDe("vino")).toBeNull();
  });

  it("un verde pálido (51) no cubre 'esmeralda' aunque Uniqlo lo llame GREEN; el 55 sí", () => {
    const colors = [
      { name: "GREEN", displayCode: "51" },
      { name: "GREEN", displayCode: "55" },
      { name: "BLACK", displayCode: "09" },
    ];
    expect(colorQueEmpata(colors, { colorFamilia: "verde", nombre: "Camiseta esmeralda" })).toEqual({
      color: { name: "GREEN", displayCode: "55" },
      porNombre: true,
    });
    expect(colorQueEmpata([colors[0]], { colorFamilia: "verde", nombre: "Camiseta esmeralda" })).toEqual({ color: null, porNombre: true });
    // Sin tono pedido, el primer GREEN vale, como antes.
    expect(colorQueEmpata(colors, { colorFamilia: "verde", nombre: "Playera verde" })?.color?.displayCode).toBe("55");
    expect(colorQueEmpata(colors, { colorFamilia: "negro" }).color?.displayCode).toBe("09");
  });

  it("'azul claro' ya alcanza los celestes que Uniqlo llama BLUE (61-63); 'azul rey' sólo el 67", () => {
    const colors = [
      { name: "BLUE", displayCode: "62" },
      { name: "BLUE", displayCode: "67" },
      { name: "NAVY", displayCode: "69" },
    ];
    expect(colorQueEmpata(colors, { colorFamilia: "azul claro" }).color?.displayCode).toBe("62");
    expect(colorQueEmpata(colors, { colorFamilia: "azul rey" }).color?.displayCode).toBe("67");
    expect(colorQueEmpata(colors, { colorFamilia: "azul" }).color?.displayCode).toBe("67");
    expect(colorQueEmpata(colors, { colorFamilia: "marino" }).color?.displayCode).toBe("69");
  });

  it("en elegirPrendas: 'rubí' ya no acepta el coral (14)", () => {
    const base = items.find((i) => i.genderCategory === "WOMEN" && i.colors?.some((c) => c.name === "RED"))!;
    const coral = { ...base, productId: "CORAL", colors: [{ name: "RED", displayCode: "14" }], images: { main: { "14": { image: "https://image.uniqlo.com/UQ/x.jpg" } } } };
    const rubi = { ...base, productId: "RUBI", colors: [{ name: "RED", displayCode: "17" }], images: { main: { "17": { image: "https://image.uniqlo.com/UQ/y.jpg" } } } };
    const out = elegirPrendas([coral, rubi], { segmento: "mujer", colorFamilia: "rubí" }, "us");
    expect(out.map((p) => p.id)).toEqual(["us:RUBI:17"]);
  });
});

describe("la más cercana: una sola prenda que cede únicamente el tono, hacia vecinos escritos a mano", () => {
  const polo = (productId: string, codes: string[], name = "DRY-EX Polo Shirt", genderCategory = "MEN"): UniqloItem => ({
    productId,
    name,
    genderCategory,
    colors: codes.map((c) => ({ name: c === "69" ? "NAVY" : c === "63" ? "BLUE" : "BLUE", displayCode: c })),
    prices: { base: { value: 29.9 } },
    rating: { average: 4.5 },
    images: { main: Object.fromEntries(codes.map((c) => [c, { image: `https://image.uniqlo.com/UQ/${c}.jpg` }])) },
  });
  const hueco = { segmento: "hombre" as const, colorFamilia: "azul", nombre: "Polo azul rey", termino: "polo shirt" };

  it("azul rey: sin 67 no hay exacta; la cercana es el vecino más próximo que exista (66 > 65 > 64), con su palabra", () => {
    const items = [polo("TINTA", ["68", "69"]), polo("INTENSO", ["64"]), polo("MEDIO", ["65"])];
    expect(elegirPrendas(items, hueco, "us")).toEqual([]);
    const out = elegirCercana(items, hueco, "us");
    expect(out).toHaveLength(1);
    expect(out[0].productId).toBe("MEDIO");
    expect(out[0].colorCode).toBe("65");
    expect(out[0].cercana).toBe("azul medio");
    expect(out[0].url).toContain("colorDisplayCode=65");
  });

  it("el 68 (tinta) y el marino no son vecinos de azul rey: si sólo hay eso, no hay cercana", () => {
    expect(elegirCercana([polo("TINTA", ["68", "69"])], hueco, "us")).toEqual([]);
  });

  it("la cercana pasa los MISMOS filtros que la exacta: un polo de mujer o a rayas no entra por ceder el tono", () => {
    const items = [polo("MUJER", ["64"], "DRY-EX Polo Shirt", "WOMEN"), polo("RAYAS", ["64"], "DRY Pique Striped Polo Shirt")];
    expect(elegirCercana(items, hueco, "us")).toEqual([]);
  });

  it("una pieza que nombra dos colores no tiene cercana (no sabemos cuál ceder)", () => {
    expect(elegirCercana([polo("INTENSO", ["64"])], { ...hueco, nombre: "Polo azul rey con cuello blanco" }, "us")).toEqual([]);
  });

  it("`azul` a secas cede al celeste 63 sólo arriba (camisa), no en un pantalón; vino no cede nunca", () => {
    expect(vecinosDe("azul", "linen shirt")).toEqual(["63"]);
    expect(vecinosDe("azul", "pants")).toEqual([]);
    expect(vecinosDe("vino", "sweater")).toEqual([]);
    expect(vecinosDe("esmeralda", "knit sweater")).toEqual(["58"]);
    expect(vecinosDe("rubi", "midi dress")).toEqual(["16"]);
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

  // Hasta v0.2.410 "sin reseñas" contaba como 0 y quedaba al final. Se cambió
  // a propósito (2026-10-21): las estrellas no predicen si la prenda cubre el
  // hueco, y una prenda nueva sin reseñas no es peor que una de 3.1.
  it("tope de dos; con el mismo parecido desempatan las estrellas, y sin reseñas cuenta como la mediana (4.7)", () => {
    const base = items.find((i) => i.genderCategory === "WOMEN")!;
    const clon = (id: string, rating: number | null): UniqloItem => ({
      ...base,
      productId: id,
      rating: rating === null ? null : { average: rating },
      colors: [{ name: "BLACK", displayCode: "09" }],
      images: { main: { "09": { image: "https://image.uniqlo.com/UQ/ST3/us/imagesgoods/x/item/x_09.jpg" } } },
    });
    const out = elegirPrendas([clon("E1-000", 3.1), clon("E2-000", null), clon("E3-000", 4.9)], { segmento: "mujer", colorFamilia: "negro" }, "jp");
    expect(out.map((p) => p.id)).toEqual(["jp:E3-000:09", "jp:E2-000:09"]);
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

// LO QUE SE VIO EN PRODUCCIÓN EL 2026-10-21: a "Short de lino negro" le salió
// "AIRism Boxer Briefs | Striped" y "Wide Sweat Shorts". El tipo venía a secas
// ("short"), nadie exigía que el nombre dijera "shorts" y nadie sacaba la ropa
// interior. Esto blinda las tres cosas.
describe("lo que no es la prenda, aunque la búsqueda lo devuelva", () => {
  it("terminoDe toma los modificadores también del nombre de la pieza", () => {
    expect(terminoDe("short", "Short de lino negro")).toBe("linen shorts");
    expect(terminoDe("sueter", "Suéter de punto vino")).toBe("knit sweater");
    expect(terminoDe("short-lino", "Short de lino negro")).toBe("linen shorts"); // no repite
    expect(terminoDe("jeans", "Jeans negros rectos")).toBe("straight jeans");
  });

  it("esRopaInterior saca bóxers, briefs, calcetines y pijama en los tres idiomas, salvo que eso se busque", () => {
    expect(esRopaInterior("AIRism Boxer Briefs | Striped")).toBe(true);
    expect(esRopaInterior("HEATTECH Socks | 3 Pairs")).toBe(true);
    expect(esRopaInterior("Flannel Pajamas | Long Sleeve")).toBe(true);
    expect(esRopaInterior("エアリズムボクサーブリーフ")).toBe(true);
    expect(esRopaInterior("에어리즘 드로즈")).toBe(true);
    expect(esRopaInterior("Linen Blend Shorts | 9.5\"")).toBe(false);
    // "ボクサー" también nombra el corte de un short de calle en Japón: no se excluye.
    expect(esRopaInterior("コットンボクサーイージーショートパンツ")).toBe(false);
    expect(esRopaInterior("HEATTECH Socks | 3 Pairs", "socks")).toBe(false);
  });

  it("nombreCoincide exige la prenda en nombres en inglés y no juzga los nombres japoneses o coreanos", () => {
    expect(nombreCoincide("Linen Blend Shorts | 9.5\"", "linen shorts")).toBe(true);
    expect(nombreCoincide("Cotton Linen Shirt | Short Sleeve", "linen shorts")).toBe(false);
    expect(nombreCoincide("Wide Sweat Shorts", "linen shorts")).toBe(true);
    expect(nombreCoincide("Souffle Yarn Sweater", "knit sweater")).toBe(true);
    expect(nombreCoincide("Sweat Oversized Full-Zip Hoodie", "knit sweater")).toBe(false);
    expect(nombreCoincide("リネンブレンドイージーショートパンツ", "linen shorts")).toBe(true);
    expect(nombreCoincide("리넨 블렌드 쇼츠", "linen shorts")).toBe(true);
  });

  it("elegirPrendas: para 'linen shorts' de hombre en negro no sale el bóxer ni la camisa de manga corta, y el short de lino va primero", () => {
    const base = (id: string, name: string, rating: number): UniqloItem => ({
      productId: id,
      name,
      genderCategory: "MEN",
      colors: [{ name: "BLACK", displayCode: "09" }],
      prices: { base: { currency: { code: "USD" }, value: 29.9 } },
      rating: { average: rating },
      images: { main: { "09": { image: `https://image.uniqlo.com/UQ/ST3/us/imagesgoods/${id}/item/x_09.jpg` } } },
    });
    const items = [
      base("E1-000", "AIRism Boxer Briefs | Striped", 4.9),
      base("E2-000", "Wide Sweat Shorts", 4.8),
      base("E3-000", "Cotton Linen Shirt | Short Sleeve", 4.8),
      base("E4-000", "Linen Blend Shorts | 9.5\"", 4.5),
    ];
    const out = elegirPrendas(items, { segmento: "hombre", colorFamilia: "negro", termino: "linen shorts" }, "us");
    expect(out.map((p) => p.nombre)).toEqual(["Linen Blend Shorts | 9.5\"", "Wide Sweat Shorts"]);
  });
});

// SEGUNDO CASO REAL DEL 2026-10-21: a "Camisa de manga corta negra" (hombre) la
// vitrina le ofrecía "Waffle T-Shirt" y "Waffle Henley Neck T-Shirt | Long
// Sleeve". Tres huecos: "T-Shirt" contaba como camisa, nadie miraba la manga, y
// la única camisa de manga corta negra que había era ESTAMPADA. Los ítems de
// abajo son los nombres reales que devolvió la API ese día.
describe("camisa no es playera; la manga y lo liso se respetan", () => {
  const item = (id: string, name: string, rating = 4.5): UniqloItem => ({
    productId: id,
    name,
    genderCategory: "UNISEX",
    colors: [{ name: "BLACK", displayCode: "09" }],
    prices: { base: { currency: { code: "USD" }, value: 29.9 } },
    rating: { average: rating },
    images: { main: { "09": { image: `https://image.uniqlo.com/UQ/ST3/us/imagesgoods/${id}/item/x_09.jpg` } } },
  });

  it("terminoDe busca la manga cuando contradice la convención de Uniqlo", () => {
    expect(terminoDe("camisa", "Camisa de manga corta negra")).toBe("short sleeve shirt");
    expect(terminoDe("camisa", "Camisa blanca de vestir")).toBe("shirt");
    expect(terminoDe("playera", "Playera de manga larga gris")).toBe("long sleeve t-shirt");
    expect(terminoDe("playera", "Playera blanca")).toBe("t-shirt");
  });

  it("mangaDe lee la manga del nombre de la pieza", () => {
    expect(mangaDe("Camisa de manga corta negra")).toBe("corta");
    expect(mangaDe("Playera de manga larga")).toBe("larga");
    expect(mangaDe("Top sin mangas negro")).toBe("sin");
    expect(mangaDe("Camisa oxford azul")).toBeNull();
  });

  it("mangaCompatible: lo que la ficha dice en contra descarta; en camisas, la manga corta tiene que estar escrita", () => {
    expect(mangaCompatible("Waffle Henley Neck T-Shirt | Long Sleeve", "corta", "short sleeve shirt")).toBe(false);
    expect(mangaCompatible("Super Non-Iron Slim Shirt | Regular Collar", "corta", "short sleeve shirt")).toBe(false);
    expect(mangaCompatible("Linen Shirt | Short Sleeve", "corta", "short sleeve shirt")).toBe(true);
    expect(mangaCompatible("Crew Neck T-Shirt", "larga", "long sleeve t-shirt")).toBe(false);
    expect(mangaCompatible("Crew Neck T-Shirt | Long Sleeve", "larga", "long sleeve t-shirt")).toBe(true);
    expect(mangaCompatible("リネンシャツ（長袖）", "corta", "short sleeve shirt")).toBe(false);
    expect(mangaCompatible("リネンシャツ（半袖）", "corta", "short sleeve shirt")).toBe(true);
    expect(mangaCompatible("Oxford Slim Shirt", null, "shirt")).toBe(true);
  });

  it("estampadoNoPedido: liso pedido → fuera rayas y estampados; si la pieza los pide, entran", () => {
    expect(estampadoNoPedido("Open Collar Shirt | Short Sleeve | Printed", "Camisa de manga corta negra")).toBe(true);
    expect(estampadoNoPedido("Linen Cotton Shorts | Striped", "Short de lino negro")).toBe(true);
    expect(estampadoNoPedido("Linen Blend Shorts | 9.5\"", "Short de lino negro")).toBe(false);
    expect(estampadoNoPedido("Linen Cotton Shorts | Striped", "Short de lino a rayas")).toBe(false);
    expect(estampadoNoPedido("ボーダーTシャツ", "Playera negra")).toBe(true);
  });

  it("el caso completo con los nombres reales: ni playeras, ni manga larga, ni estampada; la lisa de manga corta sí", () => {
    const items = [
      item("E1-000", "Waffle T-Shirt", 4.8),
      item("E2-000", "Waffle Henley Neck T-Shirt | Long Sleeve", 4.8),
      item("E3-000", "Super Non-Iron Slim Shirt | Regular Collar", 4.6),
      item("E4-000", "Open Collar Shirt | Short Sleeve | Printed", 5),
      item("E5-000", "Sweatshirt", 4.7),
      item("E6-000", "Linen Shirt | Short Sleeve", 4.2),
    ];
    const q = terminoDe("camisa", "Camisa de manga corta negra")!;
    const out = elegirPrendas(items, { segmento: "hombre", colorFamilia: "negro", termino: q, nombre: "Camisa de manga corta negra" }, "us");
    expect(out.map((p) => p.nombre)).toEqual(["Linen Shirt | Short Sleeve"]);
    // Sin la camisa lisa de manga corta, la respuesta honesta es nada.
    const sinLisa = elegirPrendas(items.slice(0, 5), { segmento: "hombre", colorFamilia: "negro", termino: q, nombre: "Camisa de manga corta negra" }, "us");
    expect(sinLisa).toEqual([]);
  });
});

// TERCERA TANDA (2026-10-21), sacada de correr la vitrina sobre los 50 huecos
// reales: en Japón y Corea no se juzgaba el nombre y a una boina le salió un
// cinturón; a unos botines, "Long Boots"; varias palabras no se traducían.
describe("Japón y Corea también se juzgan; botín no es bota alta; palabras que faltaban", () => {
  it("en coreano y japonés el nombre tiene que decir la prenda (sin entrada, no pasa)", () => {
    expect(nombreCoincide("이탈리안레더롱벨트", "wool beret")).toBe(false);
    expect(nombreCoincide("울 베레모", "wool beret")).toBe(true);
    expect(nombreCoincide("レースアップシューズ", "ankle boots")).toBe(false);
    expect(nombreCoincide("ロングブーツ", "ankle boots")).toBe(false);
    expect(nombreCoincide("ショートブーツ", "ankle boots")).toBe(true);
    expect(nombreCoincide("ウォッシャブル3Dクルーネックセーター", "sweater")).toBe(true);
    expect(nombreCoincide("ドライEXクルーネックTシャツ", "shirt")).toBe(false);
    expect(nombreCoincide("リネンシャツ", "shirt")).toBe(true);
  });

  it("en inglés un botín excluye 'Long Boots' y acepta 'Booties'", () => {
    expect(nombreCoincide("Long Boots", "ankle boots")).toBe(false);
    expect(nombreCoincide("Side Gore Booties", "ankle boots")).toBe(true);
  });

  it("terminoDe traduce las palabras que faltaban en los huecos reales", () => {
    expect(terminoDe("botines", "Botines negros resistentes")).toBe("ankle boots");
    expect(terminoDe("botas-altas", "Botas altas negras de piel")).toBe("long leather boots");
    expect(terminoDe("vestido", "Vestido camisero negro")).toBe("shirt dress");
    expect(terminoDe("bolso", "Bolso pequeño de hombro negro")).toBe("mini shoulder bag");
    expect(terminoDe("chamarra", "Chamarra impermeable negra")).toBe("rain jacket");
    expect(terminoDe("pantalon", "Pantalón de vestir gris recto")).toBe("smart straight pants");
  });
});

// CUARTA TANDA (2026-10-21), de la segunda corrida sobre los 50 huecos reales.
describe("cuello, impermeable, temporada y patrón pedido", () => {
  it("la manga en el TIPO tampoco es largo de prenda", () => {
    expect(terminoDe("playera-manga-larga", "Playera de manga larga rayas blanco y negro")).toBe("long sleeve t-shirt");
  });

  it("si la pieza pide rayas, una ficha lisa no es esa pieza", () => {
    expect(estampadoNoPedido("Waffle Henley Neck T-Shirt | Long Sleeve", "Playera de manga larga rayas blanco y negro")).toBe(true);
    expect(estampadoNoPedido("Soft Ribbed T-Shirt | Long Sleeve | Stripe", "Playera de manga larga rayas blanco y negro")).toBe(false);
  });

  it("cuello alto exige turtleneck/mock neck; cuello redondo no lo cubre", () => {
    expect(cuelloCompatible("ダブルフェイスクルーネックセーター", "Suéter de cuello alto negro")).toBe(false);
    expect(cuelloCompatible("Extra Fine Merino Turtleneck Sweater", "Suéter de cuello alto negro")).toBe(true);
    expect(cuelloCompatible("スフレヤーンタートルネックセーター", "Suéter de cuello alto negro")).toBe(true);
    expect(cuelloCompatible("Double Face Knit Sleeveless Dress", "Vestido de punto negro cuello alto")).toBe(false);
    expect(cuelloCompatible("Crew Neck T-Shirt", "Playera blanca")).toBe(true);
  });

  it("impermeable exige lluvia o repelente al agua en la ficha", () => {
    expect(funcionCompatible("ボアフリースコンビネーションジャケット", "Chamarra impermeable negra")).toBe(false);
    expect(funcionCompatible("BLOCKTECH Parka", "Chamarra impermeable negra")).toBe(true);
    expect(funcionCompatible("ブロックテックパーカ", "Chamarra impermeable negra")).toBe(true);
    expect(funcionCompatible("Duffle Coat", "Abrigo largo de lana negro")).toBe(true);
  });

  it("pieza de frío no recibe lino ni AIRism, salvo que pida lino", () => {
    expect(temporadaCompatible("Linen Blend Tiered Dress", { nombre: "Vestido midi rubí", temporada: "frio" })).toBe(false);
    expect(temporadaCompatible("Knitted Polo Dress", { nombre: "Vestido midi rubí", temporada: "frio" })).toBe(true);
    expect(temporadaCompatible("Linen Blend Tiered Dress", { nombre: "Vestido midi rubí", temporada: "calor" })).toBe(true);
    expect(temporadaCompatible("Linen Shirt", { nombre: "Camisa de lino", temporada: "frio" })).toBe(true);
  });
});

describe("temporada por el clima del viaje, polo no es suéter, piel pedida", () => {
  it("un vestido 'todo el año' en un viaje de 5-17 °C no recibe lino", () => {
    expect(viajeEsFrio([{ temp_max: 14 }, { temp_max: 17 }])).toBe(true);
    expect(viajeEsFrio([{ temp_max: 14 }, { temp_max: 29 }])).toBe(false);
    expect(viajeEsFrio([])).toBeNull();
    expect(temporadaCompatible("Linen Blend Tiered Dress", { nombre: "Vestido midi rubí", temporada: "todo-el-año", viajeFrio: true })).toBe(false);
    expect(temporadaCompatible("Linen Blend Tiered Dress", { nombre: "Vestido midi rubí", temporada: "todo-el-año", viajeFrio: false })).toBe(true);
  });

  it("un polo no es un suéter tejido tipo polo", () => {
    expect(nombreCoincide("3D니트폴로스웨터", "polo shirt")).toBe(false);
    expect(nombreCoincide("에어리즘 코튼 피케 폴로셔츠", "polo shirt")).toBe(true);
    expect(nombreCoincide("AIRism Cotton Pique Polo Shirt", "polo shirt")).toBe(true);
    expect(nombreCoincide("3D Knit Polo Sweater", "polo shirt")).toBe(false);
  });

  it("si la pieza pide piel, la ficha tiene que decir piel", () => {
    expect(materialCompatible("Coated Cotton Shoulder Bag", "Bolsa cruzada de piel negra")).toBe(false);
    expect(materialCompatible("Italian Leather Long Belt", "Cinturón de piel negro")).toBe(true);
    expect(materialCompatible("レザーショルダーバッグ", "Bolsa de piel negra")).toBe(true);
    expect(materialCompatible("Drawstring Bag", "Bolso pequeño de hombro negro")).toBe(true);
  });
});

// LO QUE LA VUELVE ÚTIL EN EL VIAJE (2026-10-21): "la compré", modo tienda y pesos.
describe("modo tienda, pesos y la compra", () => {
  it("el número de producto es el de la etiqueta (seis dígitos)", () => {
    expect(numeroDeProducto("E488243-000")).toBe("488243");
    expect(numeroDeProducto("488243")).toBe("488243");
  });

  it("pesos aproximados redondeados a decenas; sin tasa, nada (nunca inventado)", () => {
    const tasas = { USD: 18.52, JPY: 0.1171, KRW: 0.01395 };
    expect(pesosAprox("USD", 29.9, tasas)).toBe("≈ $550 MXN");
    expect(pesosAprox("JPY", 3990, tasas)).toBe("≈ $470 MXN");
    expect(pesosAprox("KRW", 129000, tasas)).toBe("≈ $1,800 MXN");
    expect(pesosAprox("USD", 29.9, null)).toBeNull();
    expect(pesosAprox("EUR", 29.9, tasas)).toBeNull();
  });

  it("pesos para México o país sin dato; no para Colombia", () => {
    expect(mostrarPesos("MX")).toBe(true);
    expect(mostrarPesos(null)).toBe(true);
    expect(mostrarPesos("CO")).toBe(false);
  });

  it("tasasAMxn invierte la tasa del BCE y falla en silencio", async () => {
    const ok = vi.fn(async (_u: string, _o?: RequestInit) => ({ ok: true, json: async () => ({ rates: { USD: 0.05399, JPY: 8.5375, KRW: 71.691 } }) }) as unknown as Response);
    const t = await tasasAMxn(ok as unknown as typeof fetch);
    expect(t?.USD).toBeCloseTo(18.52, 1);
    expect(t?.JPY).toBeCloseTo(0.1171, 3);
    const mal = vi.fn(async () => { throw new Error("red"); });
    expect(await tasasAMxn(mal as unknown as typeof fetch)).toBeNull();
  });

  it("validarCompra: sólo foto de image.uniqlo.com, ficha de uniqlo.com y entrada con forma de mercado:producto:color", () => {
    const buena = {
      entrada: "us:E482788-000:09",
      tienda: "Uniqlo EE. UU.",
      producto: "Linen Blend Easy Shorts",
      url: "https://www.uniqlo.com/us/en/products/E482788-000/00?colorDisplayCode=09",
      foto: "https://image.uniqlo.com/UQ/ST3/us/imagesgoods/482788/item/usgoods_09_482788_3x4.jpg",
      precio: 29.9,
      moneda: "usd",
    };
    expect(validarCompra(buena)?.moneda).toBe("USD");
    expect(validarCompra({ ...buena, foto: "https://evil.com/x.jpg" })).toBeNull();
    expect(validarCompra({ ...buena, url: "https://evil.com/products/1" })).toBeNull();
    expect(validarCompra({ ...buena, entrada: "x" })).toBeNull();
    expect(validarCompra(null)).toBeNull();
  });
});
