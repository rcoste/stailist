import { describe, it, expect, afterEach } from "vitest";
import {
  CUOTAS,
  MENSAJE_CUOTA,
  TOPE_USD_DIA,
  desdeHace24h,
  motorPausado,
  restanteDe,
  revisarCuota,
  type Recurso,
} from "./cuotas";

// Un Supabase de mentira que sólo sabe responder lo que la cuota le pregunta.
// Se le dan las filas de ai_calls y devuelve las que caen en el filtro — así el
// test prueba la ARITMÉTICA de la cuota, que es lo único propio de este archivo.
type Fila = { tarea: string; costo_usd: number | null };
function fakeSupabase(filas: Fila[], revienta = false) {
  return {
    from() {
      const q = {
        _tareas: null as string[] | null,
        select() {
          return q;
        },
        eq() {
          return q;
        },
        in(_col: string, tareas: string[]) {
          q._tareas = tareas;
          return q;
        },
        gte() {
          if (revienta) return Promise.resolve({ data: null, error: new Error("boom") });
          const data = q._tareas
            ? filas.filter((f) => q._tareas!.includes(f.tarea))
            : filas;
          return Promise.resolve({ data, error: null });
        },
      };
      return q;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const repetir = (tarea: string, n: number, costo = 0): Fila[] =>
  Array.from({ length: n }, () => ({ tarea, costo_usd: costo }));

afterEach(() => {
  delete process.env.MOTOR_PAUSADO;
});

describe("la ventana de la cuota", () => {
  it("mira exactamente 24 horas hacia atrás", () => {
    const ahora = new Date("2026-09-02T15:00:00.000Z");
    expect(desdeHace24h(ahora)).toBe("2026-09-01T15:00:00.000Z");
  });
});

describe("el interruptor manual", () => {
  it("apagado por default", () => {
    expect(motorPausado()).toBe(false);
  });

  it("con MOTOR_PAUSADO=1 nada llama al modelo, ni siquiera con cuota de sobra", async () => {
    process.env.MOTOR_PAUSADO = "1";
    const v = await revisarCuota(fakeSupabase([]), "u1", "looks");
    expect(v.permitido).toBe(false);
    if (!v.permitido) expect(v.motivo).toBe("pausa");
  });
});

describe("el tope por recurso", () => {
  it("deja pasar justo por debajo del tope y corta AL llegar", async () => {
    const casi = await revisarCuota(
      fakeSupabase(repetir("motor", CUOTAS.looks - 1)),
      "u1",
      "looks"
    );
    expect(casi.permitido).toBe(true);

    const tope = await revisarCuota(
      fakeSupabase(repetir("motor", CUOTAS.looks)),
      "u1",
      "looks"
    );
    expect(tope.permitido).toBe(false);
    if (!tope.permitido) {
      expect(tope.motivo).toBe("cuota");
      expect(tope.mensaje).toBe(MENSAJE_CUOTA.looks);
    }
  });

  it("el juez NO gasta cuota de looks: una generación es UN look", async () => {
    // 19 generaciones = 19 motor + 19 juez. Si el juez contara, 38 filas
    // pasarían el tope de 20 y la persona se quedaría a la mitad de lo suyo.
    const filas = [...repetir("motor", 19), ...repetir("juez", 19)];
    const v = await revisarCuota(fakeSupabase(filas), "u1", "looks");
    expect(v.permitido).toBe(true);
  });

  it("cada recurso cuenta lo suyo y no lo de al lado", async () => {
    const filas = repetir("tryon", CUOTAS.tryon);
    expect((await revisarCuota(fakeSupabase(filas), "u1", "tryon")).permitido).toBe(false);
    expect((await revisarCuota(fakeSupabase(filas), "u1", "looks")).permitido).toBe(true);
    expect((await revisarCuota(fakeSupabase(filas), "u1", "avatar")).permitido).toBe(true);
  });

  it("el try-on de wishlist gasta la misma cuota que el try-on normal", async () => {
    const filas = [
      ...repetir("tryon", 8),
      ...repetir("tryon-wishlist", CUOTAS.tryon - 8),
    ];
    expect((await revisarCuota(fakeSupabase(filas), "u1", "tryon")).permitido).toBe(false);
  });

  it("el portero de personas no gasta cuota de fotos", async () => {
    // vision-personas corre por foto igual que vision-prendas: si contara, el
    // tope de 120 fotos sería en realidad de 60 sin decirlo.
    const filas = [
      ...repetir("vision-prendas", 60),
      ...repetir("vision-personas", 90),
    ];
    expect((await revisarCuota(fakeSupabase(filas), "u1", "fotos")).permitido).toBe(true);
  });
});

describe("el freno de dinero", () => {
  it("corta cuando el gasto del día llega al tope, aunque queden cuotas", async () => {
    const filas = repetir("motor", 2, TOPE_USD_DIA / 2);
    const v = await revisarCuota(fakeSupabase(filas), "u1", "looks");
    expect(v.permitido).toBe(false);
    if (!v.permitido) expect(v.motivo).toBe("gasto");
  });

  it("va por encima de agotar las cuatro cuotas: el mensaje útil gana", async () => {
    // Si el tope de dinero fuera menor que este total, saltaría ANTES que los
    // topes por recurso y la persona recibiría "necesita un respiro" en vez de
    // "ya te armé 20 looks hoy".
    const peorCaso =
      CUOTAS.looks * 0.049 +
      CUOTAS.avatar * 0.134 +
      CUOTAS.tryon * 0.134 +
      CUOTAS.fotos * 0.0012;
    expect(TOPE_USD_DIA).toBeGreaterThan(peorCaso);
  });
});

describe("cuando la consulta truena", () => {
  it("deja pasar: nadie se queda sin su look por un fallo de la tabla de cuotas", async () => {
    const v = await revisarCuota(fakeSupabase([], true), "u1", "looks");
    expect(v.permitido).toBe(true);
  });

  it("y el restante devuelve la cuota entera", async () => {
    expect(await restanteDe(fakeSupabase([], true), "u1", "fotos")).toBe(CUOTAS.fotos);
  });
});

describe("cuántas quedan (sólo lo usa el lote de fotos)", () => {
  it("descuenta lo ya gastado", async () => {
    expect(await restanteDe(fakeSupabase(repetir("vision-prendas", 20)), "u1", "fotos")).toBe(
      CUOTAS.fotos - 20
    );
  });

  it("nunca es negativo", async () => {
    expect(
      await restanteDe(fakeSupabase(repetir("vision-prendas", CUOTAS.fotos + 9)), "u1", "fotos")
    ).toBe(0);
  });
});

describe("los mensajes", () => {
  const recursos: Recurso[] = ["looks", "avatar", "tryon", "fotos"];

  it("existen para los cuatro recursos", () => {
    for (const r of recursos) expect(MENSAJE_CUOTA[r].length).toBeGreaterThan(10);
  });

  it("ninguno se lee como un error ni culpa a la persona", () => {
    for (const r of recursos) {
      const m = MENSAJE_CUOTA[r].toLowerCase();
      expect(m).not.toMatch(/error|límite excedido|no autorizado|denegado|bloquead/);
    }
  });

  it("todos dicen cuándo vuelve", () => {
    for (const r of recursos) expect(MENSAJE_CUOTA[r]).toMatch(/mañana/);
  });
});
