import { describe, it, expect } from "vitest";
import { gestoDeTip, variedadDeGestos } from "./gestos";

// Los tips de ejemplo son REALES: salieron de la corrida 7e10d12b del eval, que
// es la que produjo el diagnóstico (27 de 40 diciendo "deja X abierto").

describe("gestoDeTip", () => {
  it("clasifica los gestos reales del motor", () => {
    const casos: [string, string][] = [
      ["Deja la chamarra de piel abierta para que se vea la camisa azul claro.", "abrir-capa"],
      ["Deja la puffer abierta para que se asome el cuello del suéter vino.", "abrir-capa"],
      ["Enróllate las mangas de la camisa de lino hasta el antebrazo.", "arremangar"],
      ["Arremanga el blazer dos vueltas por encima del puño de la camisa.", "arremangar"],
      ["Métete el suéter apenas al frente y deja el resto suelto.", "fajar"],
      ["Sube el dobladillo una vuelta para que se vea el botín de gamuza.", "cuffear"],
      ["Ponte el reloj de piel café para que hable con los zapatos.", "accesorio"],
      ["Abre el primer botón del polo.", "cuello"],
      ["Abotona el saco al caminar y déjalo cerrado durante la ceremonia.", "abotonar"],
    ];
    for (const [tip, esperado] of casos) expect(gestoDeTip(tip)).toBe(esperado);
  });

  it("un tip vacío o ausente no es un gesto (no infla el denominador)", () => {
    expect(gestoDeTip("")).toBeNull();
    expect(gestoDeTip(null)).toBeNull();
    expect(gestoDeTip("   ")).toBeNull();
  });

  it("lo que no reconoce cae a 'otro', nunca se pierde", () => {
    // Un gesto que el catálogo no contempla sigue contando como variedad: el
    // riesgo de la métrica es subestimar al motor, no sobreestimarlo.
    expect(gestoDeTip("Ponte el suéter sobre los hombros con las mangas al frente.")).toBeTruthy();
  });

  it("'deja el cuello por fuera' NO es abrir-capa aunque empiece con 'deja'", () => {
    // El orden de los patrones importa: abrir-capa es el que absorbe todo si se
    // evalúa primero, y era justo el gesto sobre-representado.
    expect(gestoDeTip("Deja el cuello de la oxford por fuera del half-zip.")).toBe("cuello");
  });
});

describe("variedadDeGestos — la métrica que no se puede adular", () => {
  it("un solo truco da dominancia 1 y equilibrio 0", () => {
    const tips = Array.from({ length: 10 }, () => "Deja el blazer abierto.");
    const v = variedadDeGestos(tips);
    expect(v.distintos).toBe(1);
    expect(v.dominancia).toBe(1);
    expect(v.equilibrio).toBe(0);
  });

  it("reproduce el diagnóstico de la línea base: dominancia alta", () => {
    // 7 de 10 con el mismo gesto — la forma de la corrida real (27 de 40).
    const tips = [
      ...Array.from({ length: 7 }, () => "Deja la chamarra abierta."),
      "Arremanga la camisa dos vueltas.",
      "Fájala apenas al frente.",
      "Abre el primer botón.",
    ];
    const v = variedadDeGestos(tips);
    expect(v.distintos).toBe(4);
    expect(v.dominancia).toBe(0.7);
    expect(v.equilibrio).toBeLessThan(0.8);
  });

  it("repartido entre varios gestos sube el equilibrio y baja la dominancia", () => {
    const tips = [
      "Deja el blazer abierto.",
      "Deja la chamarra abierta.",
      "Arremanga la camisa dos vueltas.",
      "Enróllate las mangas hasta el antebrazo.",
      "Fájala apenas al frente.",
      "Métetela por dentro del pantalón.",
      "Sube el dobladillo una vuelta.",
      "Ponte el reloj de piel café.",
    ];
    const v = variedadDeGestos(tips);
    expect(v.distintos).toBe(5);
    expect(v.dominancia).toBeLessThanOrEqual(0.3);
    expect(v.equilibrio).toBeGreaterThan(0.9);
  });

  it("los looks SIN tip cuentan en total pero no en conTip", () => {
    // Si contaran como gesto, quitar tips subiría la variedad artificialmente.
    const v = variedadDeGestos(["Deja el blazer abierto.", null, "", "Fájala al frente."]);
    expect(v.total).toBe(4);
    expect(v.conTip).toBe(2);
    expect(v.dominancia).toBe(0.5);
  });

  it("sin ningún tip no revienta ni finge variedad", () => {
    const v = variedadDeGestos([null, null]);
    expect(v).toMatchObject({ conTip: 0, distintos: 0, dominancia: 0, equilibrio: 0 });
  });
});

// EL GESTO ES EL VERBO, NO EL SUSTANTIVO. Estos son los falsos positivos que
// inflaban la métrica en su primera versión — todos de tips REALES.
describe("no confundir la prenda del gesto con la que se menciona de paso", () => {
  it("'los botones de la camisa oxford' es cuello, NO calzado", () => {
    // "oxford" en este clóset es más frecuente como camisa que como zapato.
    expect(
      gestoDeTip("Deja los dos primeros botones de la camisa oxford abiertos para que se vea relajado.")
    ).toBe("cuello");
  });

  it("los botines que solo SE VEN no hacen del tip un gesto de calzado", () => {
    expect(
      gestoDeTip("Deja la chamarra de piel abierta para que se vea la camiseta vino contra los botines.")
    ).toBe("abrir-capa");
  });

  it("'abre el blazer' es abrir-capa aunque no diga 'abierto'", () => {
    expect(gestoDeTip("Abre el blazer negro y deja que la camisa blanca respire en el cuello.")).toBe(
      "abrir-capa"
    );
    expect(gestoDeTip("Abre el abrigo charcoal al caminar para que se asome la camisa.")).toBe(
      "abrir-capa"
    );
  });

  it("el nudo de la corbata es un gesto propio (y nuevo del repertorio)", () => {
    expect(
      gestoDeTip("Deja el nudo de la corbata bien ajustado al cuello de la camisa blanca.")
    ).toBe("accesorio");
  });

  it("el calzado cuenta cuando se ACTÚA sobre él", () => {
    expect(gestoDeTip("Ponte los mocasines sin calcetín para bajarle formalidad.")).toBe("calzado");
  });
});
