import { describe, it, expect } from "vitest";
import { tipoDePrenda } from "@/lib/engine/vocabulario";

// borrowArchetypeImage vive tras "server-only" y pide un cliente de Supabase, así
// que lo que se prueba aquí es la DECISIÓN que la hacía fallar: si dos nombres son
// el mismo tipo de prenda. Es la línea exacta que cambió — antes, coincidencia de
// palabras sueltas; ahora, tipo canónico.
describe("prestar la imagen de otra prenda: el criterio de tipo", () => {
  const mismoTipo = (a: string, b: string) =>
    tipoDePrenda(a)?.tipo != null && tipoDePrenda(a)?.tipo === tipoDePrenda(b)?.tipo;

  it("un suéter NO presta su foto a una camisa, aunque los dos sean esmeralda", () => {
    // El caso real: 30 prendas de la base muestran la foto de otra prenda. La
    // lista negra de colores no incluía "esmeralda", así que "Camisa de lino
    // esmeralda" y "Suéter esmeralda" coincidían en esa palabra y el código las
    // daba por el mismo tipo. Roberto lo cazó en un look para 30°C, donde el
    // render le puso un suéter de lana.
    expect(mismoTipo("Camisa de lino esmeralda", "Suéter esmeralda de lana fina")).toBe(false);
  });

  it("los colores que la lista negra no tenía ya no confunden nada", () => {
    // esmeralda, turquesa, coral, salvia, burdeos, teal, cobalto: ninguno estaba.
    for (const color of ["esmeralda", "turquesa", "coral", "salvia", "burdeos", "teal", "cobalto"]) {
      expect(mismoTipo(`Camisa ${color}`, `Suéter ${color}`), color).toBe(false);
    }
  });

  it("sí presta entre prendas del mismo tipo", () => {
    expect(mismoTipo("Jeans azul oscuro", "Jeans negros rectos")).toBe(true);
    expect(mismoTipo("Mocasines café", "Mocasines negros")).toBe(true);
  });

  it("un nombre irreconocible no presta nada (mejor el render limpio)", () => {
    expect(tipoDePrenda("Mi prenda favorita")).toBeNull();
  });
});
