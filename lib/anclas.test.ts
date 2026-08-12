import { describe, expect, it } from "vitest";
import { MAX_ANCLAS, motivoBloqueo } from "@/lib/anclas";

// LA GUARDA QUE NACIÓ CON EL PLURAL.
//
// Con una sola ancla no existía: cualquier prenda era fijable. Con varias
// aparece "¿y si elige dos pantalones?", y la respuesta NO puede ser "que el
// motor lo resuelva": el motor tiene orden de no soltar ninguna ancla —regla
// dura del prompt más dos redes en código— así que obedecería y devolvería un
// look con dos pantalones.
//
// Lo que se blinda es dónde está el límite: la regla caza lo IMPOSIBLE, no lo
// feo. De lo feo opina el motor.

describe("motivoBloqueo — lo que un cuerpo no puede llevar dos veces", () => {
  it("dos pantalones, no", () => {
    expect(motivoBloqueo("bottom", ["bottom"])).toContain("pantalón");
  });

  it("dos calzados, no", () => {
    expect(motivoBloqueo("calzado", ["calzado"])).toContain("zapatos");
  });

  it("vestido y pantalón no conviven, en ningún orden", () => {
    expect(motivoBloqueo("vestido", ["bottom"])).toBeTruthy();
    expect(motivoBloqueo("bottom", ["vestido"])).toBeTruthy();
  });
});

describe("motivoBloqueo — lo que SÍ se lleva junto", () => {
  it("DOS TOPS SÍ: camisa + suéter es un look en capas, no un error", () => {
    // Es la trampa evidente de esta regla. Si contara los tops como el pantalón,
    // prohibiría media sastrería masculina.
    expect(motivoBloqueo("top", ["top"])).toBeNull();
  });

  it("saco y abrigo también: uno va debajo del otro", () => {
    expect(motivoBloqueo("abrigo", ["saco"])).toBeNull();
    expect(motivoBloqueo("saco", ["abrigo"])).toBeNull();
  });

  it("un pantalón con un top, obviamente", () => {
    expect(motivoBloqueo("bottom", ["top"])).toBeNull();
  });

  it("varios accesorios", () => {
    expect(motivoBloqueo("accesorio", ["accesorio", "accesorio"])).toBeNull();
  });

  it("una categoría que no conocemos NO se bloquea", () => {
    // El catálogo de categorías crece; una regla que bloquea lo que no entiende
    // convierte cada categoría nueva en un bug silencioso.
    expect(motivoBloqueo("sombrero-raro", ["top"])).toBeNull();
    expect(motivoBloqueo(null, ["top"])).toBeNull();
  });
});

describe("motivoBloqueo — el tope", () => {
  it(`al llegar a ${MAX_ANCLAS} ya no entra nada, ni siquiera algo compatible`, () => {
    const llenas = Array(MAX_ANCLAS).fill("accesorio");
    expect(motivoBloqueo("top", llenas)).toBeTruthy();
  });

  it("el tope manda su motivo y ofrece la salida", () => {
    // Un tope sin salida es un muro. La salida es el probador, que dibuja
    // exactamente lo que elijas sin opinar — el otro deseo, con su pantalla.
    const razon = motivoBloqueo("top", Array(MAX_ANCLAS).fill("accesorio"))!;
    expect(razon).toContain("pruébate un look");
  });

  it("por debajo del tope, deja seguir", () => {
    expect(motivoBloqueo("top", ["accesorio"])).toBeNull();
  });
});
