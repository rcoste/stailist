import { describe, expect, it } from "vitest";
import { subgroupsFor } from "./closet-subgrupos";

// LOS NOMBRES SON LOS REALES DEL CLÓSET DE ROBERTO (147 prendas, 2026-09-08).
// Un test con nombres inventados fija el regex contra sí mismo; éste fija la
// taxonomía contra el clóset que la motivó. Si alguien afina un patrón y un
// traje de baño vuelve a caer entre los pantalones de traje, truena aquí.
const p = (nombre: string) => ({ nombre });
const grupo = (
  cat: string,
  nombres: string[],
  label = "cat"
): Record<string, string[]> =>
  Object.fromEntries(
    (subgroupsFor(cat, nombres.map(p), label) ?? []).map((g) => [
      g.label,
      g.prendas.map((x) => x.nombre),
    ])
  );

describe("subgrupos del clóset — con el clóset real que los motivó", () => {
  it("abajo: el traje de baño NO cae entre los pantalones de traje", () => {
    const g = grupo("bottom", [
      "Pantalón de traje azul marino",
      "Pantalón de vestir gris",
      "Pantalón de smoking negro",
      "Jeans negros",
      "Chinos beige",
      "Pantalón cargo negro",
      "Pantalón de lino",
      "Pantalón técnico",
      "Bermuda caqui",
      "Short de lino azul marino",
      "Pantalón deportivo negro",
      "Traje de baño estampado",
      "Traje de baño negro liso",
    ]);
    expect(g["Trajes de baño"]).toEqual(["Traje de baño estampado", "Traje de baño negro liso"]);
    expect(g["De vestir"]).toEqual([
      "Pantalón de traje azul marino",
      "Pantalón de vestir gris",
      "Pantalón de smoking negro",
    ]);
    expect(g["Jeans"]).toEqual(["Jeans negros"]);
    expect(g["Shorts y bermudas"]).toEqual(["Bermuda caqui", "Short de lino azul marino"]);
    expect(g["Deportivos"]).toEqual(["Pantalón deportivo negro"]);
    // Chinos, lino, cargo y técnico son el mismo cajón casual.
    expect(g["Chinos y casuales"]).toContain("Pantalón cargo negro");
    expect(g["Chinos y casuales"]).toContain("Pantalón técnico");
  });

  it("arriba: camisa, camiseta y polo no se roban entre sí (el \\b importa)", () => {
    const g = grupo("top", [
      "Camisa oxford azul",
      "Camisa de mezclilla",
      "Camiseta blanca",
      "Playera verde lima",
      "Polo de manga larga marino",
      "Suéter half-zip gris",
      "Cárdigan marino",
      "Cuello tortuga negro",
      "Hoodie gris",
      "Jersey de México verde",
    ]);
    expect(g["Camisas"]).toEqual(["Camisa oxford azul", "Camisa de mezclilla"]);
    expect(g["Playeras y camisetas"]).toEqual(["Camiseta blanca", "Playera verde lima", "Jersey de México verde"]);
    expect(g["Polos"]).toEqual(["Polo de manga larga marino"]);
    expect(g["Suéteres y punto"]).toEqual(["Suéter half-zip gris", "Cárdigan marino", "Cuello tortuga negro"]);
    expect(g["Sudaderas"]).toEqual(["Hoodie gris"]);
  });

  it("abrigos: la ultraligera no va con la de piel (es la queja original)", () => {
    const g = grupo("abrigo", [
      "Abrigo de lana negro largo",
      "Blazer marrón de lana",
      "Chamarra ultraligera",
      "Chamarra acolchada azul marino",
      "Abrigo impermeable técnico azul marino",
      "Chamarra de piel negra",
      "Chaqueta técnica negra",
      "Bomber negro",
      "Overshirt oliva",
    ]);
    // El blazer de lana ES un abrigo (Roberto lo confirmó): va con los abrigos.
    // La etiqueta NO es "Abrigos" a secas: chocaría con el nombre de la categoría.
    expect(g["Abrigos y gabardinas"]).toEqual(["Abrigo de lana negro largo", "Blazer marrón de lana"]);
    expect(g["Parkas y plumas"]).toEqual([
      "Chamarra ultraligera",
      "Chamarra acolchada azul marino",
      "Abrigo impermeable técnico azul marino",
    ]);
    expect(g["Chamarras"]).toEqual(["Chamarra de piel negra", "Chaqueta técnica negra", "Bomber negro"]);
    expect(g["Sobrecamisas"]).toEqual(["Overshirt oliva"]);
  });

  it("calzado: tenis, mocasines, botines y vestir, cada uno en lo suyo", () => {
    const g = grupo("calzado", [
      "Zapato Oxford de piel negra",
      "Zapato derby de piel chocolate",
      "Mocasines burdeos",
      "Mocasín de ante chocolate",
      "Botines Chelsea de gamuza",
      "Botas de senderismo negras",
      "Tenis blancos urbanos",
      "Sandalia de piel negra",
    ]);
    expect(g["De vestir"]).toEqual(["Zapato Oxford de piel negra", "Zapato derby de piel chocolate"]);
    expect(g["Mocasines"]).toEqual(["Mocasines burdeos", "Mocasín de ante chocolate"]);
    expect(g["Botines y botas"]).toEqual(["Botines Chelsea de gamuza", "Botas de senderismo negras"]);
    expect(g["Tenis"]).toEqual(["Tenis blancos urbanos"]);
    expect(g["Sandalias"]).toEqual(["Sandalia de piel negra"]);
  });

  it("accesorios: corbatas, cinturones, lentes y relojes dejan de ser un cajón", () => {
    const g = grupo("accesorio", [
      "Corbata de seda vino",
      "Moño negro",
      "Cinturón café",
      "Bufanda de lana rubí",
      "Gafas de sol wayfarer",
      "Gorra negra",
      "Reloj negro",
    ]);
    expect(g["Corbatas y moños"]).toEqual(["Corbata de seda vino", "Moño negro"]);
    expect(g["Cinturones"]).toEqual(["Cinturón café"]);
    expect(g["Bufandas y pañuelos"]).toEqual(["Bufanda de lana rubí"]);
    expect(g["Lentes"]).toEqual(["Gafas de sol wayfarer"]);
    expect(g["Gorras y sombreros"]).toEqual(["Gorra negra"]);
    expect(g["Relojes y joyería"]).toEqual(["Reloj negro"]);
  });

  it("una categoría homogénea NO gana encabezados de más", () => {
    // Tres camisas y nada más: partirlo en un solo grupo llamado "Camisas"
    // sobre una categoría llamada "Arriba" es ruido, no orden.
    expect(subgroupsFor("top", [p("Camisa blanca"), p("Camisa negra")], "Arriba")).toBeNull();
  });

  it("lo que no encaja cae al final, con la etiqueta que le pase quien llama", () => {
    // El clóset le pasa "Otros" cuando el encabezado de categoría ya está a la
    // vista (sin filtro) y el nombre de la categoría cuando no lo está — sin
    // eso quedaba "PANTALONES › Pantalones".
    const g = subgroupsFor("calzado", [p("Tenis grises"), p("Pantufla de casa")], "Otros");
    expect(g?.at(-1)).toEqual({ label: "Otros", prendas: [{ nombre: "Pantufla de casa" }] });
  });

  it("una categoría sin taxonomía (saco: 9 prendas) no se parte", () => {
    expect(subgroupsFor("saco", [p("Saco de traje negro"), p("Blazer marino")], "Sacos")).toBeNull();
  });
});
