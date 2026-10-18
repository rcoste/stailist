import { describe, it, expect } from "vitest";
import { revisarCapsula } from "./capsule-revision";
import { revisarMaleta } from "./trip-revision";
import { aplicarReparacion, completarPieza, listaComoRespuesta, pedidoDeReparacion } from "./reparar-lista";
import { esAbrigoDeInvierno, esJeansAzul, esParaLluvia, visualDeNoche } from "./piezas-tipo";
import type { CapsuleItem } from "@/lib/capsule";

// LO QUE BLINDAN (2026-10-18): las reglas nuevas de los jueces, con los casos
// reales de la corrida en seco, y que la segunda pasada sólo toque lo señalado.

const p = (nombre: string, category: string, extra: Partial<CapsuleItem> = {}): CapsuleItem =>
  ({ nombre, tipo: "", category, colorFamilia: "negro", formalidad: "casual", temporada: "todo-el-año", prioridad: 1, ...extra }) as CapsuleItem;

describe("qué es cada pieza", () => {
  it("un abrigo de invierno no es una gabardina ni un bomber", () => {
    expect(esAbrigoDeInvierno(p("Abrigo largo de lana chocolate", "abrigo"))).toBe(true);
    expect(esAbrigoDeInvierno(p("Gabardina impermeable negra", "abrigo"))).toBe(false);
    expect(esAbrigoDeInvierno(p("Chamarra bomber negra", "abrigo"))).toBe(false);
  });
  it("lluvia, jeans azules y descripción de noche", () => {
    expect(esParaLluvia(p("Botín impermeable negro", "calzado"))).toBe(true);
    expect(esJeansAzul(p("Jeans de mezclilla índigo oscuro", "bottom", { colorFamilia: "azul" }))).toBe(true);
    expect(esJeansAzul(p("Jeans negros rectos", "bottom"))).toBe(false);
    expect(visualDeNoche("crepé mate, escote recto, tirante ancho, caída recta al piso")).toBe(false);
    expect(visualDeNoche("terciopelo denso, manga larga, abertura lateral")).toBe(true);
  });
});

describe("juez de esenciales: reglas nuevas", () => {
  const ctx = { gender: "mujer" as const, clima: "templado", viajeClima: "frio,calor", lluvia: "temporada", trabajo: "oficina_casual,remoto", vetos: [] };
  it("el caso de su cápsula: dos abrigos, nada para lluvia, sin jeans azules, gala de diario", () => {
    const reglas = revisarCapsula(
      [
        p("Abrigo largo de lana negro", "abrigo"),
        p("Abrigo largo de paño chocolate", "abrigo"),
        p("Jeans negros", "bottom"),
        p("Tenis blancos", "calzado"),
        p("Vestido largo negro de gala", "vestido", { formalidad: "formal", visual: "crepé mate, escote recto, tirante ancho" }),
        p("Zapatilla de tacón negra", "calzado", { formalidad: "formal" }),
      ],
      ctx
    ).map((h) => h.regla);
    expect(reglas).toEqual(expect.arrayContaining(["abrigo-de-mas", "sin-lluvia", "sin-jeans-azules", "noche-sin-noche"]));
  });
  it("viajar a frío permite UN abrigo; sin lluvia contestada no se exige; un veto de jeans apaga esa regla", () => {
    const reglas = revisarCapsula(
      [p("Abrigo largo de lana negro", "abrigo"), p("Pantalón negro", "bottom"), p("Tenis", "calzado")],
      { ...ctx, lluvia: null, vetos: ["jeans de mezclilla"] }
    ).map((h) => h.regla);
    expect(reglas).not.toContain("abrigo-de-mas");
    expect(reglas).not.toContain("sin-lluvia");
    expect(reglas).not.toContain("sin-jeans-azules");
  });
});

describe("juez de la maleta", () => {
  const base = { ocasiones: ["ciudad"], dias: 10, capacidad: 16 };
  it("mínima de 0°C sin abrigo de invierno (parka impermeable, bomber y chaleco no lo son)", () => {
    const r = revisarMaleta([p("Parka impermeable", "abrigo"), p("Bomber negro", "abrigo"), p("Chaleco acolchado", "abrigo"), p("Botines", "calzado")], { ...base, paradas: [{ lugar: "Mineápolis", temp_c: 6, temp_min: 0, temp_max: 11 }] });
    expect(r.map((h) => h.regla)).toContain("sin-abrigo-para-la-minima");
  });
  it("lluvia en una parada, trabajo sin nada formal y equipaje de mano que no alcanza", () => {
    const ropa = Array.from({ length: 13 }, (_, i) => p(`Prenda ${i}`, "top"));
    const r = revisarMaleta([...ropa, p("Tenis", "calzado")], { ocasiones: ["trabajo"], dias: 5, capacidad: 11, paradas: [{ lugar: "París", temp_c: 14, condition: "lluvia" }] }).map((h) => h.regla);
    expect(r).toEqual(expect.arrayContaining(["sin-lluvia", "sin-formal", "no-cabe"]));
  });
  it("frío y calor en el mismo viaje piden piezas ligeras", () => {
    const r = revisarMaleta([p("Abrigo de lana", "abrigo"), p("Botines", "calzado")], { ...base, paradas: [{ temp_c: 2, temp_min: 0 }, { temp_c: 28, temp_max: 30 }] });
    expect(r.map((h) => h.regla)).toContain("sin-bloque-de-calor");
  });
  it("una maleta bien hecha no dispara nada", () => {
    const r = revisarMaleta([p("Abrigo largo de lana", "abrigo"), p("Gabardina", "abrigo"), p("Botines", "calzado"), p("Camisa de lino", "top", { temporada: "calor" })], { ...base, paradas: [{ temp_c: 2, temp_min: 0, condition: "lluvia" }, { temp_c: 28, temp_max: 30 }] });
    expect(r).toEqual([]);
  });
});

describe("la segunda pasada sólo toca lo señalado", () => {
  const lista = [p("Abrigo largo de lana negro", "abrigo"), p("Abrigo largo de paño chocolate", "abrigo"), p("Jeans negros", "bottom")];
  it("quita por nombre (sin importar acentos ni mayúsculas) y agrega al final, sin repetir", () => {
    const out = aplicarReparacion(lista, {
      quitar: ["abrigo largo de pano chocolate"],
      agregar: [p("Gabardina impermeable negra", "abrigo"), p("Jeans negros", "bottom")],
    });
    expect(out.map((x) => x.nombre)).toEqual(["Abrigo largo de lana negro", "Jeans negros", "Gabardina impermeable negra"]);
  });
  it("la conversación lleva la lista como su respuesta y el hallazgo como pedido, y prohíbe tocar lo demás", () => {
    expect(listaComoRespuesta(lista)).toContain("Abrigo largo de paño chocolate");
    const m = pedidoDeReparacion([{ regla: "sin-lluvia", detalle: "No hay nada para lluvia." }]);
    expect(m).toContain("No hay nada para lluvia.");
    expect(m).toContain("No toques nada que no esté en lo que encontré");
  });
});

describe("una pieza del tercer intento (schema reducido)", () => {
  it("se completa con lo que le falta y se descarta si la categoría no existe", () => {
    const ok = completarPieza({ nombre: "Gabardina negra", tipo: "gabardina", category: "abrigo", colorFamilia: "negro", formalidad: "rarísima" as never, temporada: "", visual: "algodón encerado" } as never);
    expect(ok).toMatchObject({ nombre: "Gabardina negra", formalidad: "casual", temporada: "todo-el-año", porque: "" });
    expect(completarPieza({ nombre: "Cosa", category: "sombrero-raro" } as never)).toBeNull();
  });
});
