import { describe, it, expect } from "vitest";
import { contarFaltantesMaleta } from "@/lib/home-trip";
import type {
  CapsuleItem,
  CapsuleMatch,
  CapsuleTarget,
  MatchStatus,
} from "@/lib/capsule";

// Lo que este test blinda: el NÚMERO que la card del home anuncia ("te faltan 2
// artículos") tiene que ser el mismo que la persona encuentra al abrir el
// detalle del viaje. Si la card exagera, el tap se siente como cebo; si se
// queda corta, la maleta sale incompleta.

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

const target = (n: number): CapsuleTarget => ({
  version: 2,
  items: Array.from({ length: n }, (_, i) => item(`prenda-${i}`)),
});

const match = (statuses: MatchStatus[]): CapsuleMatch => ({
  signature: "sig",
  entries: statuses.map((status) => ({ status, by: status === "falta" ? null : "algo" })),
});

describe("contarFaltantesMaleta — el número de la card = el del detalle", () => {
  it("cuenta solo las 'falta' reales", () => {
    const n = contarFaltantesMaleta(
      target(4),
      match(["tienes", "falta", "parecido", "falta"]),
      null,
      null
    );
    expect(n).toBe(2);
  });

  it("sin maleta (match null) no hay faltantes que anunciar", () => {
    expect(contarFaltantesMaleta(target(3), null, null, null)).toBe(0);
    expect(contarFaltantesMaleta(null, null, null, null)).toBe(0);
  });

  it("un sustituto del clóset cubre el hueco — vía su empacado", () => {
    // setTripSubstitute escribe la clave "sub:<i>" Y marca empacado[i]=true.
    // El conteo va por el empacado, que es lo que mira el detalle del viaje.
    const n = contarFaltantesMaleta(
      target(2),
      match(["falta", "falta"]),
      { "sub:0": "mi camisa blanca" } as never,
      { "0": true }
    );
    expect(n).toBe(1);
  });

  it("un sustituto DESempacado vuelve a faltar, igual que en el detalle", () => {
    // El detalle deja desmarcar lo empacado (togglePacked). La primera versión
    // excluía por la clave "sub:" y entonces la card decía 1 mientras el detalle
    // listaba 2 — el tap se sentía como un cebo.
    const n = contarFaltantesMaleta(
      target(2),
      match(["falta", "falta"]),
      { "sub:0": "mi camisa blanca" } as never,
      { "0": false }
    );
    expect(n).toBe(2);
  });

  it("una falta marcada como empacada ya no falta", () => {
    const n = contarFaltantesMaleta(target(2), match(["falta", "falta"]), null, {
      "1": true,
    });
    expect(n).toBe(1);
  });

  it("el rechazo de un 'parecido' lo vuelve falta (misma regla que el detalle)", () => {
    const n = contarFaltantesMaleta(
      target(2),
      match(["parecido", "parecido"]),
      { "0": "reject", "1": "accept" },
      null
    );
    expect(n).toBe(1);
  });
});
