import { describe, expect, it } from "vitest";
import { llaveDeCombo } from "@/lib/tryon-combo";

// LA LLAVE DEL PROBADOR — lo único que separa "cachear" de "servir la imagen
// equivocada".
//
// El try-on de una combinación cuesta una generación de imagen completa. Antes
// no había caché y la razón escrita era buena ("es ad-hoc"), pero tenía un
// hueco: ad-hoc no significa irrepetible. Probar los mismos zapatos con el mismo
// pantalón dos veces ES la forma de una decisión de compra.
//
// Los dos errores posibles son opuestos y los dos son caros: una llave DEMASIADO
// específica no cachea nada (pagas siempre) y una llave DEMASIADO laxa te
// devuelve la imagen de otra combinación —o tu cara vieja—, que es peor porque
// no se nota.

const AVATAR = "u1/avatar-abc.jpg";

describe("llaveDeCombo — lo que cuenta como la misma combinación", () => {
  it("el orden en que elegiste las prendas NO importa", () => {
    // Sin esto, cuatro prendas dan 24 llaves para un solo look: tocar zapatos
    // → pantalón cobra distinto que pantalón → zapatos.
    expect(llaveDeCombo(AVATAR, ["w1", "w2"], ["c1", "c2"])).toBe(
      llaveDeCombo(AVATAR, ["w2", "w1"], ["c2", "c1"])
    );
  });

  it("quitar una prenda cambia la combinación", () => {
    expect(llaveDeCombo(AVATAR, [], ["c1", "c2"])).not.toBe(
      llaveDeCombo(AVATAR, [], ["c1"])
    );
  });

  it("cambiar una prenda por otra cambia la combinación", () => {
    expect(llaveDeCombo(AVATAR, [], ["c1"])).not.toBe(llaveDeCombo(AVATAR, [], ["c2"]));
  });

  it("un deseo y una prenda del clóset con el MISMO id no son lo mismo", () => {
    // Son tablas distintas con uuids independientes. Sin el prefijo de origen,
    // una colisión (astronómicamente rara, pero silenciosa) mezclaría un zapato
    // que quieres comprar con uno que ya tienes.
    expect(llaveDeCombo(AVATAR, ["x"], [])).not.toBe(llaveDeCombo(AVATAR, [], ["x"]));
  });
});

describe("llaveDeCombo — el avatar es parte de la llave", () => {
  it("regenerar tu avatar invalida las combinaciones viejas", () => {
    // ES LA PROPIEDAD QUE VUELVE ESTO UN CACHÉ CORRECTO. La imagen lleva tu
    // cara: si no estuviera el avatar en la llave, te enseñaría tu cara vieja
    // para siempre y nadie sabría por qué. Así se invalida sola, sin lógica de
    // invalidación que mantener.
    expect(llaveDeCombo("u1/avatar-VIEJO.jpg", [], ["c1"])).not.toBe(
      llaveDeCombo("u1/avatar-NUEVO.jpg", [], ["c1"])
    );
  });

  it("el mismo avatar y las mismas prendas dan la misma llave, siempre", () => {
    // Determinista: sin fecha, sin azar, sin orden de llegada. Es lo que hace
    // que diez intentos de la misma combinación sean UN archivo y no diez.
    const a = llaveDeCombo(AVATAR, ["w1"], ["c1"]);
    const b = llaveDeCombo(AVATAR, ["w1"], ["c1"]);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });
});
