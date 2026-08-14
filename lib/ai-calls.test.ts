import { describe, it, expect } from "vitest";
import {
  fmtMs,
  mediana,
  percentil,
  resumenPorTarea,
  totales,
  type AiCall,
} from "./ai-calls";

// Lo que se blinda no es el formato de la tabla: es CÓMO se cuenta.
// Un panel de observabilidad que promedia mal es peor que no tenerlo — se ve
// igual de creíble y manda a optimizar la tarea equivocada.

const AHORA = new Date("2026-08-14T12:00:00Z").getTime();

const call = (over: Partial<AiCall> = {}): AiCall => ({
  created_at: new Date(AHORA - 60_000).toISOString(),
  tarea: "motor",
  proveedor: "anthropic",
  modelo: "claude-opus-5",
  version: null,
  ms: 1000,
  tokens_entrada: 100,
  tokens_salida: 50,
  costo_usd: 0.01,
  ok: true,
  ...over,
});

describe("percentil — con pocas muestras, que no mienta", () => {
  it("lista vacía es 0, no NaN", () => {
    expect(percentil([], 0.95)).toBe(0);
  });

  it("una sola muestra devuelve esa muestra", () => {
    expect(percentil([420], 0.95)).toBe(420);
  });

  it("interpola en vez de devolver siempre el máximo", () => {
    // Con 4 muestras, tomar el índice 0.95 daría 4000 (el peor caso) y la
    // pantalla presentaría el máximo como si fuera una medida robusta.
    const p95 = percentil([1000, 2000, 3000, 4000], 0.95);
    expect(p95).toBeGreaterThan(3000);
    expect(p95).toBeLessThan(4000);
  });

  it("la mediana de un número par de muestras cae entre las dos centrales", () => {
    expect(mediana([10, 20, 30, 40])).toBe(25);
  });
});

describe("resumenPorTarea — los fallos no contaminan los tiempos", () => {
  it("la mediana ignora los fallos (un timeout no infla una tarea sana)", () => {
    const filas = [
      call({ ms: 1000 }),
      call({ ms: 1000 }),
      call({ ms: 60_000, ok: false, costo_usd: null }),
    ];
    const [motor] = resumenPorTarea(filas);
    expect(motor.msMediana).toBe(1000);
    expect(motor.msMedianaFallo).toBe(60_000);
    expect(motor.fallos).toBe(1);
    expect(motor.tasaFallo).toBe(33);
  });

  it("un fallo instantáneo tampoco hace ver rápida a la tarea", () => {
    // Falta la llave → truena en 5ms. Si entrara al promedio, la tarea
    // aparecería el doble de rápida de lo que de verdad es.
    const filas = [call({ ms: 4000 }), call({ ms: 5, ok: false, costo_usd: null })];
    const [motor] = resumenPorTarea(filas);
    expect(motor.msMediana).toBe(4000);
  });

  it("el costo medio solo cuenta las llamadas con precio conocido", () => {
    // Un modelo sin tarifa guarda costo null. Dividir el total entre TODAS
    // daría un número creíble y equivocado.
    const filas = [call({ costo_usd: 0.1 }), call({ costo_usd: null })];
    const [motor] = resumenPorTarea(filas);
    expect(motor.costoTotal).toBeCloseTo(0.1);
    expect(motor.costoPorLlamada).toBeCloseTo(0.1);
  });

  it("sin ninguna llamada con precio, el costo por llamada es null y no cero", () => {
    const [t] = resumenPorTarea([call({ costo_usd: null })]);
    expect(t.costoPorLlamada).toBeNull();
  });

  it("ordena por gasto: primero donde hay que mirar", () => {
    const filas = [
      call({ tarea: "vision-prenda", costo_usd: 0.001 }),
      call({ tarea: "motor", costo_usd: 0.5 }),
      call({ tarea: "juez", costo_usd: 0.05 }),
    ];
    expect(resumenPorTarea(filas).map((t) => t.tarea)).toEqual([
      "motor",
      "juez",
      "vision-prenda",
    ]);
  });

  it("lista los modelos que atendieron la tarea (para ver un cambio a ciegas)", () => {
    const filas = [
      call({ modelo: "claude-opus-5" }),
      call({ modelo: "gemini-3.5-flash" }),
      call({ modelo: "claude-opus-5" }),
    ];
    expect(resumenPorTarea(filas)[0].modelos).toEqual([
      "claude-opus-5",
      "gemini-3.5-flash",
    ]);
  });
});

describe("totales — el pico se ve el día que ocurre", () => {
  it("separa las últimas 24h del acumulado", () => {
    const filas = [
      call({ costo_usd: 1, created_at: new Date(AHORA - 60_000).toISOString() }),
      call({ costo_usd: 5, created_at: new Date(AHORA - 40 * 3600_000).toISOString() }),
    ];
    const t = totales(filas, AHORA);
    expect(t.costo).toBeCloseTo(6);
    expect(t.costo24h).toBeCloseTo(1);
    expect(t.llamadas24h).toBe(1);
  });

  it("sin filas no divide entre cero", () => {
    expect(totales([], AHORA)).toMatchObject({ llamadas: 0, tasaFallo: 0, costo: 0 });
  });
});

describe("fmtMs — tiempos como los diría una persona", () => {
  it("bajo un segundo, en milisegundos", () => {
    expect(fmtMs(820)).toBe("820ms");
  });
  it("segundos con un decimal", () => {
    expect(fmtMs(1400)).toBe("1.4s");
  });
  it("más de un minuto, en minutos y segundos", () => {
    expect(fmtMs(72_000)).toBe("1m 12s");
  });
  it("cero es raya, no '0ms'", () => {
    expect(fmtMs(0)).toBe("—");
  });
});
