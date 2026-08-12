// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DraftCard, type DraftLeida } from "@/components/prenda-draft-card";
import type { PrendaDetectada } from "@/lib/vision-prendas";

afterEach(cleanup);

// LA RED DE SEGURIDAD DE LA TARJETA POR DONDE ENTRA LA ROPA.
//
// Por aquí pasan las altas del carrete (multi-prenda) y las del fit check —
// 303 de las prendas de la base entraron por el primero. No tenía un solo test,
// y lo que se va a mover es justo su vocabulario de chips para compartirlo con
// la ficha del clóset.
//
// Lo que se blinda NO es el markup (cambia con cada rebrand) sino LA DECISIÓN
// QUE VIAJA: qué `patch` sale por `onPatch` al tocar cada chip, y qué campos se
// marcan como tocados. Ese segundo argumento no es cosmético — termina en
// `attrs.confirmados`, que es como el motor sabe si un dato lo confirmó la
// persona o se lo inventó la visión.

const attrs = (over: Partial<PrendaDetectada> = {}): PrendaDetectada => ({
  nombre: "Jeans rectos azules",
  categoria: "bottom",
  color: "azul",
  color_hex: "#3B5A80",
  formalidad: "casual",
  temporada: "todo-el-año",
  confianza: "alta",
  descripcion: "unos jeans",
  ...over,
});

const draft = (over: Partial<DraftLeida> = {}): DraftLeida => ({
  id: "d1",
  attrs: attrs(),
  on: true,
  photoPreview: "data:image/png;base64,x",
  leido: { color: "azul", hex: "#3B5A80" },
  ...over,
});

/** Abre la sección de un chip por su texto y devuelve el contenedor. */
function abrir(nombre: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: nombre }));
}

describe("DraftCard — el resumen en chips", () => {
  it("los chips DICEN el valor actual, no la etiqueta del campo", () => {
    // El chip es el resumen y la puerta a la vez: si dijera "tipo" y "color" en
    // vez de "pantalón" y "azul", habría que abrir los cuatro para saber qué
    // leyó la app — que es exactamente el muro que este patrón vino a quitar.
    render(<DraftCard item={draft()} yaEsta={null} onToggle={() => {}} onPatch={() => {}} />);
    expect(screen.getByRole("button", { name: /pantalón|bottom/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /azul/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /casual/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /\+ más/i })).toBeTruthy();
  });

  it("apagada, la prenda no ofrece nada que tocar", () => {
    // Una prenda que no va a entrar no debe pedir correcciones.
    render(
      <DraftCard item={draft({ on: false })} yaEsta={null} onToggle={() => {}} onPatch={() => {}} />
    );
    expect(screen.queryByRole("button", { name: /\+ más/i })).toBeNull();
  });

  it("un chip abre SOLO su sección", () => {
    render(<DraftCard item={draft()} yaEsta={null} onToggle={() => {}} onPatch={() => {}} />);
    abrir(/pantalón|bottom/i);
    // El editor de tipo aparece…
    expect(screen.getByText(/^Tipo$/i)).toBeTruthy();
    // …y el de formalidad NO (abrir uno no abre los demás).
    expect(screen.queryByText(/^Formalidad$/i)).toBeNull();
  });
});

describe("DraftCard — la decisión que viaja por onPatch", () => {
  it("elegir un tipo manda el campo y lo marca tocado", () => {
    const onPatch = vi.fn();
    render(<DraftCard item={draft()} yaEsta={null} onToggle={() => {}} onPatch={onPatch} />);
    abrir(/pantalón|bottom/i);
    const editor = screen.getByText(/^Tipo$/i).closest("div")!;
    fireEvent.click(within(editor).getByRole("button", { name: /^calzado$/i }));
    expect(onPatch).toHaveBeenCalledWith({ categoria: "calzado" }, ["categoria"]);
  });

  it("elegir CIERRA la sección — corregir es un tap, no una sesión", () => {
    render(<DraftCard item={draft()} yaEsta={null} onToggle={() => {}} onPatch={() => {}} />);
    abrir(/pantalón|bottom/i);
    const editor = screen.getByText(/^Tipo$/i).closest("div")!;
    fireEvent.click(within(editor).getByRole("button", { name: /^calzado$/i }));
    expect(screen.queryByText(/^Tipo$/i)).toBeNull();
  });

  it("la formalidad viaja con su campo tocado", () => {
    const onPatch = vi.fn();
    render(<DraftCard item={draft()} yaEsta={null} onToggle={() => {}} onPatch={onPatch} />);
    abrir(/casual/i);
    const editor = screen.getByText(/^Formalidad$/i).closest("div")!;
    fireEvent.click(within(editor).getByRole("button", { name: /^Formal$/ }));
    expect(onPatch).toHaveBeenCalled();
    const [patch, campos] = onPatch.mock.calls.at(-1)!;
    expect(patch).toHaveProperty("formalidad");
    expect(campos).toContain("formalidad");
  });

  it("el color manda hex Y nombre juntos", () => {
    // Mandar solo el hex dejaría el nombre viejo pegado al color nuevo: la
    // prenda diría "azul" con un swatch negro.
    const onPatch = vi.fn();
    render(<DraftCard item={draft()} yaEsta={null} onToggle={() => {}} onPatch={onPatch} />);
    abrir(/azul/i);
    const swatches = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label") && /^[A-ZÁÉÍÓÚ]/.test(b.getAttribute("aria-label")!));
    expect(swatches.length).toBeGreaterThan(1);
    fireEvent.click(swatches[swatches.length - 1]);
    const [patch, campos] = onPatch.mock.calls.at(-1)!;
    expect(patch).toHaveProperty("color_hex");
    expect(patch).toHaveProperty("color");
    expect(campos).toContain("color");
  });

  it("el nombre se edita y viaja como nombre", () => {
    const onPatch = vi.fn();
    render(<DraftCard item={draft()} yaEsta={null} onToggle={() => {}} onPatch={onPatch} />);
    const input = screen.getByDisplayValue("Jeans rectos azules");
    fireEvent.change(input, { target: { value: "Jeans negros" } });
    expect(onPatch).toHaveBeenCalledWith({ nombre: "Jeans negros" }, ["nombre"]);
  });
});

describe("DraftCard — lo que el modelo no vio bien", () => {
  it("con confianza baja, la sección del campo dudoso arranca ABIERTA", () => {
    // Es el caso en que sí hay algo que arreglar: enterrarlo tras un chip sería
    // esconder justo lo que se debe revisar.
    render(
      <DraftCard
        item={draft({ attrs: attrs({ confianza: "baja", inseguro: ["color"] }) })}
        yaEsta={null}
        onToggle={() => {}}
        onPatch={() => {}}
      />
    );
    expect(screen.getByText(/^Color · /i)).toBeTruthy();
  });

  it("sin dudas, todo arranca cerrado", () => {
    render(<DraftCard item={draft()} yaEsta={null} onToggle={() => {}} onPatch={() => {}} />);
    expect(screen.queryByText(/^Color · /i)).toBeNull();
    expect(screen.queryByText(/^Tipo$/i)).toBeNull();
  });
});
