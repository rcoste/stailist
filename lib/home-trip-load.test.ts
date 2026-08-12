import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadHomeTrip } from "./home-trip";
import { VENTANA_VIAJE_DIAS } from "./trip-context";
import type { CapsuleItem, CapsuleMatch, CapsuleTarget } from "./capsule";

// Lo que este test blinda es CUÁNDO aparece la card de viaje y a dónde manda.
// contarFaltantesMaleta (el número) ya está en home-trip.test.ts; esto cubre el
// otro lado: la ventana de 7 días —"un viaje a dos meses no es contexto de hoy"—
// y el viaje EN CURSO, que llega con días negativos y sin el Math.max saldría
// como "en -2 días".
//
// El reloj va congelado: con la fecha real, un test de "faltan 3 días" caduca.

const HOY = "2026-08-11";

const item = (nombre: string): CapsuleItem => ({
  nombre,
  tipo: nombre,
  category: "top" as CapsuleItem["category"],
  colorFamilia: "neutro",
  formalidad: "casual" as CapsuleItem["formalidad"],
  temporada: "todo-el-año",
  prioridad: 1,
  porque: "porque sí",
});
const target: CapsuleTarget = { version: 2, items: [item("camisa"), item("tenis")] };
const match: CapsuleMatch = {
  signature: "sig",
  entries: [
    { status: "falta", by: null },
    { status: "tienes", by: "mi camisa" },
  ],
};

function supabaseFalso(trips: Record<string, unknown>[]) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "gte", "order", "limit"]) chain[m] = () => chain;
  chain.then = (resolve: (r: { data: Record<string, unknown>[] }) => unknown) =>
    Promise.resolve(resolve({ data: trips }));
  return { from: () => chain } as never;
}

const viaje = (f: Record<string, unknown> = {}) => ({
  id: "t1",
  lugar: "Cancún",
  fecha_inicio: "2026-08-14",
  fecha_fin: "2026-08-18",
  ocasiones: ["playa"],
  capsule_target: null,
  capsule_match: null,
  overrides: null,
  empacado: null,
  ...f,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${HOY}T15:00:00Z`));
});
afterEach(() => vi.useRealTimers());

describe("loadHomeTrip — cuándo aparece la card de viaje", () => {
  it("sin viajes vivos no hay card", async () => {
    expect(await loadHomeTrip(supabaseFalso([]), "u1")).toBeNull();
  });

  it("la ventana del server lleva UN día de colchón; el recorte fino es del cliente", async () => {
    // El server cuenta en UTC y la persona no vive en UTC: a las 18:00 de CDMX
    // aquí ya es mañana. Por eso deja pasar un día de más en los dos bordes y
    // HomeTripCard vuelve a contar con la fecha del dispositivo (y no dibuja
    // nada si con esa cuenta el viaje aún queda fuera de la ventana).
    const dentro = await loadHomeTrip(
      supabaseFalso([viaje({ fecha_inicio: "2026-08-18" })]), // +7
      "u1"
    );
    expect(dentro?.dias).toBe(VENTANA_VIAJE_DIAS);

    const colchon = await loadHomeTrip(
      supabaseFalso([viaje({ fecha_inicio: "2026-08-19" })]), // +8 → pasa el server
      "u1"
    );
    expect(colchon?.dias).toBe(VENTANA_VIAJE_DIAS + 1);

    const fuera = await loadHomeTrip(
      supabaseFalso([viaje({ fecha_inicio: "2026-08-20" })]), // +9 → ni con colchón
      "u1"
    );
    expect(fuera).toBeNull();
  });

  it("un viaje EN CURSO dice 0 días, nunca negativos", async () => {
    const card = await loadHomeTrip(
      supabaseFalso([viaje({ fecha_inicio: "2026-08-09", fecha_fin: "2026-08-20" })]),
      "u1"
    );
    expect(card?.dias).toBe(0);
  });

  it("sin maleta manda a armarla; con maleta, al detalle y con el número de faltantes", async () => {
    // Si la card llevara al detalle sin maleta, la persona aterriza en una
    // pantalla vacía; y el número tiene que ser el mismo que el detalle enseña.
    const sinMaleta = await loadHomeTrip(supabaseFalso([viaje()]), "u1");
    expect(sinMaleta?.href).toBe("/viaje/lista");
    expect(sinMaleta?.maletaLista).toBe(false);
    expect(sinMaleta?.faltan).toBe(0);

    const conMaleta = await loadHomeTrip(
      supabaseFalso([
        viaje({
          capsule_target: target,
          capsule_match: match,
          // Ocasiones sucias: la card las usa para elegir foto de respaldo, así
          // que un null colado ahí rompería el `includes` sin avisar.
          ocasiones: ["playa", null, 7],
        }),
      ]),
      "u1"
    );
    expect(conMaleta?.href).toBe("/viaje/t1");
    expect(conMaleta?.maletaLista).toBe(true);
    expect(conMaleta?.faltan).toBe(1);
    expect(conMaleta?.ocasiones).toEqual(["playa"]);
    expect(conMaleta?.fechaInicio).toBe("2026-08-14");
  });
});
