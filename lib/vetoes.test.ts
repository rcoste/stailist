import { describe, it, expect } from "vitest";
import { applyVetoes } from "./vetoes";

// LO QUE BLINDAN: que vetar una prenda la QUITE del clóset antes del motor.
// Durante meses el filtro comparaba contra attrs.tipo, que ninguna prenda trae
// (0 de 3044), y no quitaba nada sin que un solo test lo notara. Las prendas
// de aquí son como las reales: con nombre, categoría y color; sin tipo.

const p = (nombre: string, categoria = "top", color?: string) => ({ attrs: { nombre, categoria, color } });
const nombres = (r: { items: { attrs: { nombre: string } }[] }) => r.items.map((i) => i.attrs.nombre);

describe("applyVetoes", () => {
  it("sin vetos devuelve el mismo arreglo (nadie más paga el cambio)", () => {
    const items = [p("Tacones negros", "calzado")];
    expect(applyVetoes(items, { chips: [], free: ["nada de rosa"] }).items).toBe(items);
    expect(applyVetoes(items, null).items).toBe(items);
  });

  it("quita por el nombre aunque la prenda no traiga tipo", () => {
    const items = [p("Tacones de aguja negros", "calzado"), p("Mocasines café", "calzado")];
    const r = applyVetoes(items, { chips: ["tacones"], free: [] });
    expect(nombres(r)).toEqual(["Mocasines café"]);
    expect(r.removed).toBe(1);
  });

  it("la cuña y el stiletto son tacón; la plataforma plana no", () => {
    const items = [p("Sandalias de cuña metálicas", "calzado"), p("Stilettos rojos", "calzado"), p("Tenis de plataforma", "calzado")];
    expect(nombres(applyVetoes(items, { chips: ["tacones"], free: [] }))).toEqual(["Tenis de plataforma"]);
  });

  it("acepta plural, acentos y prefijos de largo", () => {
    const items = [
      p("Botines con tacón", "calzado"),
      p("Minifalda de mezclilla", "bottom"),
      p("Maxivestido floral", "vestido"),
      p("Bermudas caqui", "bottom"),
    ];
    const r = applyVetoes(items, { chips: ["tacones", "faldas", "vestidos", "shorts"], free: [] });
    expect(nombres(r)).toEqual([]);
  });

  it("'cap' de gorra no se lleva la sudadera con capucha", () => {
    const items = [p("Sudadera gris con capucha"), p("Gorra negra", "accesorio"), p("Cap de béisbol azul", "accesorio")];
    expect(nombres(applyVetoes(items, { chips: ["gorras"], free: [] }))).toEqual(["Sudadera gris con capucha"]);
  });

  it("vetar crop tops no veta el pantalón cropped (es un largo, no un top)", () => {
    const items = [p("Top cropped blanco", "top"), p("Pantalón cropped negro", "bottom"), p("Crop top rib", "top")];
    expect(nombres(applyVetoes(items, { chips: ["crop_tops"], free: [] }))).toEqual(["Pantalón cropped negro"]);
  });

  it("los vetos de detalle y el texto libre no filtran: van al prompt y al juez", () => {
    const items = [p("Camisa estampada"), p("Blusa sin mangas")];
    expect(applyVetoes(items, { chips: ["estampados", "sin_mangas"], free: ["nada de lino"] }).removed).toBe(0);
  });

  it("los colores siguen filtrando por attrs.color", () => {
    const items = [p("Suéter", "top", "amarillo mostaza"), p("Suéter", "top", "gris")];
    expect(applyVetoes(items, { chips: ["amarillo"], free: [] }).removed).toBe(1);
  });
});
