// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ItemSheet, type ClosetItem } from "@/components/closet-grid";

afterEach(cleanup);

// LA FICHA DE UNA PRENDA DEL CLÓSET — lo que se blinda es el PATCH, no la
// pantalla.
//
// Esta hoja es el único lugar donde una persona corrige lo que la IA supuso de
// su ropa: 635 de las 1064 prendas de la base tienen `certeza: 'asumida'`. Lo
// que se guarda aquí es exactamente lo que el motor va a leer para armar looks,
// así que un campo que se pierde en el camino no truena nada — sólo empeora los
// outfits en silencio, que es la peor clase de bug de este producto.
//
// Los tests miran el `updateItemAttrs` que sale. El markup (chips, secciones,
// siluetas) cambia con cada rebrand; lo que no puede cambiar sin que alguien lo
// decida es qué viaja a la base.

const { updateItemAttrs } = vi.hoisted(() => ({
  updateItemAttrs: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/app/closet/actions", () => ({
  updateItemAttrs,
  removeItem: vi.fn(async () => ({ ok: true })),
  atarConjunto: vi.fn(async () => ({ ok: true })),
  crearPantalonDelTraje: vi.fn(async () => ({ ok: true, id: "nuevo" })),
}));

// next/image pide un loader y un servidor; aquí sólo estorba.
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span data-img={alt} />,
}));

const prenda = (over: Partial<ClosetItem> = {}): ClosetItem => ({
  id: "i1",
  nombre: "Jeans rectos",
  imagen: null,
  swatch: "#1F2A44",
  colorNombre: "azul marino",
  category: "bottom",
  formalidad: "casual",
  temporada: "todo-el-año",
  material: "mezclilla",
  patron: "liso",
  colorSecundario: "",
  source: "photo",
  corte: "recto",
  corteConfirmado: false,
  conjunto: "",
  ...over,
});

function abrirFicha(over: Partial<ClosetItem> = {}, todas: ClosetItem[] = []) {
  return render(
    <ItemSheet
      item={prenda(over)}
      todas={todas}
      onClose={() => {}}
      onRemove={() => {}}
      onSaved={() => {}}
    />
  );
}

/** El editor de un campo, por su etiqueta. */
const editor = (label: RegExp) => screen.getByText(label).closest("div")!;

beforeEach(() => updateItemAttrs.mockClear());

describe("ItemSheet — el resumen", () => {
  it("los chips DICEN el valor de la prenda, no el nombre del campo", () => {
    // Es lo que quita el muro: la ficha se abría con doce editores desplegados
    // (1.46 pantallas de scroll) cuando casi siempre se abre por una sola cosa.
    // Si los chips dijeran "tipo" y "color" habría que abrirlos todos para
    // saber qué cree la app de esta prenda, o sea el mismo muro con menos pixeles.
    abrirFicha();
    expect(screen.getByRole("button", { name: /pantalón/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /azul marino/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^casual$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /\+ más/i })).toBeTruthy();
  });

  it("el nombre NO se pliega: se edita sin abrir nada", () => {
    // Es la identidad de la prenda y lo que más se corrige — esconderlo tras un
    // chip cambiaría una pantallota por una búsqueda del tesoro.
    abrirFicha();
    expect(screen.getByDisplayValue("Jeans rectos")).toBeTruthy();
  });

  it("un chip abre SOLO su editor", () => {
    abrirFicha();
    fireEvent.click(screen.getByRole("button", { name: /pantalón/i }));
    expect(screen.getByText(/^Tipo$/)).toBeTruthy();
    expect(screen.queryByText(/^Temporada$/)).toBeNull();
  });

  it("abrir y mirar no ensucia: sin cambios no aparece el guardar", () => {
    // Un "guardar cambios" que sale por abrir un panel entrena a guardar sin
    // haber cambiado nada — y guardar marca campos como confirmados.
    abrirFicha();
    fireEvent.click(screen.getByRole("button", { name: /\+ más/i }));
    expect(screen.queryByRole("button", { name: /guardar cambios/i })).toBeNull();
  });
});

describe("ItemSheet — lo que viaja a la base", () => {
  it("cambiar la formalidad la manda, y con el resto de los campos intactos", async () => {
    abrirFicha();
    fireEvent.click(screen.getByRole("button", { name: /^casual$/i }));
    fireEvent.click(within(editor(/^Formalidad$/)).getByRole("button", { name: /^Formal$/ }));
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(updateItemAttrs).toHaveBeenCalled());
    const [id, patch] = updateItemAttrs.mock.calls.at(-1)!;
    expect(id).toBe("i1");
    expect(patch).toMatchObject({
      formalidad: "formal",
      nombre: "Jeans rectos",
      categoria: "bottom",
      material: "mezclilla",
      patron: "liso",
    });
  });

  it("el CORTE sólo viaja si se tocó una silueta", async () => {
    // La invariante que sostiene la certeza del dato: el corte llega
    // preseleccionado con lo que supone la visión, así que mandarlo siempre
    // marcaría como confirmado por la persona algo que nadie miró.
    abrirFicha();
    fireEvent.click(screen.getByRole("button", { name: /\+ más/i }));
    fireEvent.change(screen.getByDisplayValue("Jeans rectos"), {
      target: { value: "Jeans azules" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(updateItemAttrs).toHaveBeenCalled());
    expect(updateItemAttrs.mock.calls.at(-1)![1]).not.toHaveProperty("corte");
  });

  it("tocar una silueta sí lo manda", async () => {
    abrirFicha();
    fireEvent.click(screen.getByRole("button", { name: /\+ más/i }));
    fireEvent.click(screen.getByRole("button", { name: /holgado/i }));
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(updateItemAttrs).toHaveBeenCalled());
    expect(updateItemAttrs.mock.calls.at(-1)![1]).toMatchObject({ corte: "holgado" });
  });

  it("el color manda hex Y nombre juntos", async () => {
    // Mandar sólo el hex dejaría el nombre viejo pegado al color nuevo: la
    // prenda diría "azul marino" con un swatch negro, y el motor lee el NOMBRE.
    abrirFicha();
    fireEvent.click(screen.getByRole("button", { name: /azul marino/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Negro$/ }));
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(updateItemAttrs).toHaveBeenCalled());
    expect(updateItemAttrs.mock.calls.at(-1)![1]).toMatchObject({
      color_hex: "#1A1A1A",
      color: "Negro",
    });
  });

  it("sin tocar el color, el color NO viaja", async () => {
    // Va aparte porque el nombre se busca en la paleta y el hex guardado casi
    // nunca es uno de los once atajos: mandarlo siempre reescribiría "azul
    // marino de la visión" como "" en cuanto alguien corrigiera la talla.
    abrirFicha();
    fireEvent.click(screen.getByRole("button", { name: /\+ más/i }));
    fireEvent.change(screen.getByDisplayValue("Jeans rectos"), {
      target: { value: "Jeans azules" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(updateItemAttrs).toHaveBeenCalled());
    const patch = updateItemAttrs.mock.calls.at(-1)![1];
    expect(patch).not.toHaveProperty("color");
    expect(patch).not.toHaveProperty("color_hex");
  });
});

describe("ItemSheet — un material que no está en los chips", () => {
  it("se conserva y se ve elegido (no parece vacío)", () => {
    // 32 materiales distintos viven en la base y los chips son 10: satén,
    // gamuza, terciopelo, gabardina. Si la ficha los mostrara sin nada
    // seleccionado, tocar cualquier chip para "arreglarlo" destruiría un dato
    // más específico que el que lo sustituye.
    abrirFicha({ material: "gamuza" });
    fireEvent.click(screen.getByRole("button", { name: /\+ más/i }));
    const chip = within(editor(/^Material$/)).getByRole("button", { name: /^gamuza$/ });
    expect(chip.className).toContain("border-accent");
  });

  it("y se puede escribir uno nuevo", async () => {
    abrirFicha();
    fireEvent.click(screen.getByRole("button", { name: /\+ más/i }));
    fireEvent.click(screen.getByRole("button", { name: /es otro material/i }));
    fireEvent.change(screen.getByPlaceholderText(/cashmere/i), {
      target: { value: "cashmere" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(updateItemAttrs).toHaveBeenCalled());
    expect(updateItemAttrs.mock.calls.at(-1)![1]).toMatchObject({ material: "cashmere" });
  });
});
