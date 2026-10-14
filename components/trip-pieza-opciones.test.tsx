// @vitest-environment jsdom
//
// Lo que viaja desde las hojas nuevas de la maleta (bloque B, 2026-10-14). No
// el markup: la DECISIÓN que sale hacia la base — qué nombre guarda "tengo uno
// parecido" y qué motivo y qué nota se van con "ninguna de las dos me va".

import { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ParecidoSheet } from "./trip-pieza-opciones";
import { MotivoSheet } from "./motivo-sheet";
import { MOTIVOS_VIAJE, type VetoReason } from "@/lib/capsule";
import type { VariantePieza } from "@/lib/trip-actions";

afterEach(cleanup);

describe("ParecidoSheet — 'tengo uno parecido'", () => {
  it("el caso real: cambia la hebilla a plateada y eso es lo que se guarda", async () => {
    const onGuardar = vi.fn((_v: VariantePieza) => {});
    render(
      <ParecidoSheet
        open
        onClose={() => {}}
        sugerida={{ nombre: "Cinturón negro con hebilla dorada", color: "negro" }}
        busy={false}
        onGuardar={onGuardar}
        onFoto={() => {}}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "plateado" }));
    await userEvent.click(screen.getByRole("button", { name: "piel" }));
    await userEvent.click(screen.getByRole("button", { name: /guardar en mi clóset/ }));
    expect(onGuardar.mock.calls.at(-1)![0]).toEqual({
      nombre: "Cinturón negro con hebilla plateada",
      color: "negro",
      material: "piel",
    });
  });

  it("un suéter no ofrece herraje", () => {
    render(
      <ParecidoSheet
        open
        onClose={() => {}}
        sugerida={{ nombre: "Suéter de cashmere vino", color: "vino" }}
        busy={false}
        onGuardar={() => {}}
        onFoto={() => {}}
      />
    );
    expect(screen.queryByRole("button", { name: "plateado" })).toBeNull();
  });
});

describe("MotivoSheet del viaje — 'ninguna de las dos me va'", () => {
  it("el motivo de función y lo que escribió viajan juntos a la búsqueda", async () => {
    const onReemplazar = vi.fn((_r: VetoReason, _n: string | null) => {});
    function Hoja() {
      const [motivo, setMotivo] = useState<VetoReason | null>(null);
      return (
        <MotivoSheet
          open
          onClose={() => {}}
          motivo={motivo}
          onMotivo={setMotivo}
          puedeReemplazar
          onReemplazar={onReemplazar}
          onQuitar={() => {}}
          motivos={MOTIVOS_VIAJE}
          conNota
          textoReemplazar="búscame otra de mi clóset"
          textoQuitar="déjala en compras"
        />
      );
    }
    render(<Hoja />);
    await userEvent.type(screen.getByPlaceholderText(/con tus palabras/), "vamos a caminar todo el día");
    await userEvent.click(screen.getByRole("button", { name: "no es práctico para caminar" }));
    await userEvent.click(screen.getByRole("button", { name: "búscame otra de mi clóset" }));
    expect(onReemplazar.mock.calls.at(-1)).toEqual(["no-practico", "vamos a caminar todo el día"]);
  });

  it("'no lo necesito' (sin reemplazo): el chip resuelve directo, con su nota", async () => {
    const onQuitar = vi.fn((_r: VetoReason, _n: string | null) => {});
    render(
      <MotivoSheet
        open
        onClose={() => {}}
        motivo={null}
        onMotivo={() => {}}
        puedeReemplazar={false}
        onReemplazar={() => {}}
        onQuitar={onQuitar}
        motivos={MOTIVOS_VIAJE}
        conNota
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "no va con el clima" }));
    expect(onQuitar.mock.calls.at(-1)).toEqual(["no-va-clima", null]);
  });
});
