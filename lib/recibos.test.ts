import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// LO QUE SE BLINDA AQUÍ ES **EL FALLO**.
//
// El éxito se nota: si `medir` dejara de escribir el recibo bueno, la tabla se
// vacía y salta a la vista en el panel. El fallo no se nota NUNCA — una llamada
// que truena no deja rastro por definición, así que "el motor no ha fallado en
// dos semanas" y "hace dos semanas que no registramos un fallo" se leen igual.
//
// Y es justo lo que ya pasó: de los dos únicos caminos instrumentados a mano
// antes de `medir`, sólo uno anotaba los errores. O sea que ni siquiera donde
// SÍ había datos se podía contestar cada cuánto truena el motor. Por eso el
// caso raro es el que lleva test.

const llamar = vi.fn();
vi.mock("@/lib/proveedores", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/proveedores")>()),
  llamar: (...args: unknown[]) => llamar(...args),
}));

const { medir } = await import("./recibos");

const MODELO = { proveedor: "anthropic" as const, id: "modelo-x", etiqueta: "Modelo X" };
const PETICION = { modelo: MODELO, system: "eres una stylist", texto: "hola" };

/** Un cliente de Supabase falso que se queda con lo que se le insertó. */
function supabaseFalso() {
  const insertados: Record<string, unknown>[] = [];
  const cliente = {
    from: (tabla: string) => ({
      insert: async (fila: Record<string, unknown>) => {
        insertados.push({ tabla, ...fila });
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient;
  return { cliente, insertados };
}

beforeEach(() => {
  llamar.mockReset();
});

describe("medir", () => {
  it("guarda el recibo cuando la llamada sale bien", async () => {
    llamar.mockResolvedValue({
      texto: "{}",
      tokens: { entrada: 100, salida: 20 },
      costoUsd: 0.004,
      ms: 1234,
      truncada: false,
    });
    const { cliente, insertados } = supabaseFalso();

    await medir({ supabase: cliente, userId: "u1", tarea: "motor", version: "v51" }, PETICION);

    expect(insertados).toHaveLength(1);
    expect(insertados[0]).toMatchObject({
      tabla: "ai_calls",
      user_id: "u1",
      tarea: "motor",
      proveedor: "anthropic",
      modelo: "modelo-x",
      version: "v51",
      ms: 1234,
      tokens_entrada: 100,
      tokens_salida: 20,
      costo_usd: 0.004,
      ok: true,
    });
  });

  it("registra el FALLO y relanza el error", async () => {
    llamar.mockRejectedValue(new Error("529 overloaded"));
    const { cliente, insertados } = supabaseFalso();

    await expect(
      medir({ supabase: cliente, userId: "u1", tarea: "espejo", version: "espejo-v4" }, PETICION)
    ).rejects.toThrow("529 overloaded");

    // El error SIGUE saliendo (quien llama decide qué enseñar), pero ya no se
    // pierde: queda la fila con ok=false, su tarea y su modelo.
    expect(insertados).toHaveLength(1);
    expect(insertados[0]).toMatchObject({
      tabla: "ai_calls",
      user_id: "u1",
      tarea: "espejo",
      modelo: "modelo-x",
      version: "espejo-v4",
      ok: false,
    });
    // Y CON SU TIEMPO: cuánto tarda en tronar es la mitad de la respuesta a
    // "¿cuánto tarda esta tarea?" — sin esto, el promedio sólo cuenta los
    // éxitos y miente hacia el lado optimista.
    expect(typeof insertados[0].ms).toBe("number");
  });

  it("con ctx null no registra nada, ni al fallar", async () => {
    // El comparador, los evales y los scripts. No es un olvido: es que sus
    // corridas no son de nadie y contarlas movería los promedios de uso real.
    const { cliente, insertados } = supabaseFalso();
    void cliente;

    llamar.mockResolvedValue({
      texto: "{}",
      tokens: { entrada: 1, salida: 1 },
      costoUsd: null,
      ms: 10,
      truncada: false,
    });
    await medir(null, PETICION);

    llamar.mockRejectedValue(new Error("tronó"));
    await expect(medir(null, PETICION)).rejects.toThrow("tronó");

    expect(insertados).toEqual([]);
  });

  it("un problema al guardar el recibo NO le cuesta la respuesta a la persona", async () => {
    // La regla de oro de la instrumentación aquí: falla hacia adelante. Si la
    // tabla no acepta el insert (RLS, columna nueva, lo que sea), se pierde un
    // renglón de telemetría — no el consejo que alguien está esperando.
    const cliente = {
      from: () => ({
        insert: async () => {
          throw new Error("RLS dijo que no");
        },
      }),
    } as unknown as SupabaseClient;
    llamar.mockResolvedValue({
      texto: "{ok}",
      tokens: { entrada: 1, salida: 1 },
      costoUsd: null,
      ms: 5,
      truncada: false,
    });

    const recibo = await medir(
      { supabase: cliente, userId: "u1", tarea: "vision-prenda" },
      PETICION
    );
    expect(recibo.texto).toBe("{ok}");
  });
});
