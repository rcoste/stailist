// @vitest-environment jsdom
//
// LA HOJA DE RAZONES — lo que se blinda es CUÁNTAS VECES se escribe, no el markup.
//
// La hoja se cierra en el mismo frame en que se toca un chip, así que visualmente
// es imposible distinguir un tap de dos. Pero cada tap dispara una escritura
// fire-and-forget (`saveDownReason` / `saveSkipReason`) y, en modo "skip",
// además un `onProceed` que REGENERA un look — o sea, un doble tap costaba una
// generación de más y ensuciaba la señal de feedback con razones duplicadas.
//
// El candado es un `useRef`, no estado: no repinta nada, así que ningún test de
// markup lo tocaría. Este archivo existe para que nadie lo borre "porque no hace
// nada visible".

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SkipReasons } from "@/components/skip-reasons";

afterEach(cleanup);

// Las firmas van COMPLETAS aunque los parámetros no se usen: con
// `vi.fn(async () => …)` el mock declara cero parámetros, `mock.calls` queda
// tipado como `[][]` y cada `calls[0][1]` de abajo es un TS2493 que vitest no ve
// (corre sin tipos) pero `next build` sí.
const { saveDownReason, saveSkipReason } = vi.hoisted(() => ({
  /* eslint-disable @typescript-eslint/no-unused-vars -- los parámetros existen para tipar mock.calls */
  saveDownReason: vi.fn(async (_outfitId: string, _reason: string) => ({ ok: true })),
  saveSkipReason: vi.fn(async (_outfitId: string, _reason: string) => ({ ok: true })),
  /* eslint-enable @typescript-eslint/no-unused-vars */
}));

vi.mock("@/lib/outfit-actions", () => ({ saveDownReason, saveSkipReason }));

beforeEach(() => {
  saveDownReason.mockClear();
  saveSkipReason.mockClear();
});

function abrir(mode: "skip" | "down", handlers: { onProceed?: () => void; onClose?: () => void } = {}) {
  return render(
    <SkipReasons
      outfitId="o1"
      mode={mode}
      onProceed={handlers.onProceed ?? (() => {})}
      onClose={handlers.onClose ?? (() => {})}
    />
  );
}

const chip = (texto: string) => screen.getByRole("button", { name: texto });

describe("SkipReasons — un tap, una escritura", () => {
  it("dos taps sobre el mismo chip escriben la razón UNA vez (modo 👎)", () => {
    const onClose = vi.fn();
    abrir("down", { onClose });

    const c = chip("No es mi estilo");
    fireEvent.click(c);
    fireEvent.click(c); // el doble tap real: mismo frame, la hoja aún no desmonta

    expect(saveDownReason).toHaveBeenCalledTimes(1);
    expect(saveDownReason).toHaveBeenCalledWith("o1", "No es mi estilo");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("en modo skip guarda una vez y regenera una vez (dos taps = un look, no dos)", () => {
    const onProceed = vi.fn();
    abrir("skip", { onProceed });

    const c = chip("Los colores");
    fireEvent.click(c);
    fireEvent.click(c);

    expect(saveSkipReason).toHaveBeenCalledTimes(1);
    expect(saveSkipReason).toHaveBeenCalledWith("o1", "Los colores");
    // onProceed cuesta una generación: que se dispare dos veces es dinero.
    expect(onProceed).toHaveBeenCalledTimes(1);
  });

  it("el candado es de la HOJA, no del chip: tras elegir, otro chip ya no escribe", () => {
    abrir("down");

    fireEvent.click(chip("No es la ocasión"));
    fireEvent.click(chip("No me queda")); // la hoja ya se está yendo

    expect(saveDownReason).toHaveBeenCalledTimes(1);
    expect(saveDownReason).toHaveBeenCalledWith("o1", "No es la ocasión");
  });

  it("cada modo escribe en SU tabla y no en la otra", () => {
    abrir("down");
    fireEvent.click(chip("No es mi estilo"));
    expect(saveSkipReason).not.toHaveBeenCalled();

    cleanup();
    saveDownReason.mockClear();

    abrir("skip");
    fireEvent.click(chip("No es mi estilo"));
    expect(saveDownReason).not.toHaveBeenCalled();
    expect(saveSkipReason).toHaveBeenCalledTimes(1);
  });

  it('"solo ver otro look" NO etiqueta nada — la razón es opcional', () => {
    const onProceed = vi.fn();
    abrir("skip", { onProceed });

    fireEvent.click(screen.getByRole("button", { name: /solo ver otro look/i }));

    expect(saveSkipReason).not.toHaveBeenCalled();
    expect(onProceed).toHaveBeenCalledTimes(1);
  });
});
