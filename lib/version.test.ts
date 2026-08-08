import { describe, it, expect } from "vitest";
import { hayVersionNueva, VERSION_DESCONOCIDA } from "@/lib/version";

describe("hayVersionNueva — avisa sólo con dos versiones de verdad", () => {
  it("el caso que costó dos investigaciones: servidor adelantado", () => {
    // Se desplegó el arreglo, Roberto probó desde su teléfono con el bundle
    // anterior, no funcionó, y nadie sospechó del navegador.
    expect(hayVersionNueva("0.2.171.0", "0.2.172.0")).toBe(true);
  });

  it("mismas versiones: ni una palabra", () => {
    expect(hayVersionNueva("0.2.172.0", "0.2.172.0")).toBe(false);
  });

  it("no le importa cuál es mayor, sólo que sean distintas", () => {
    // Una reversión también deja al navegador corriendo código que ya no es el
    // desplegado, y recargar sigue siendo la respuesta correcta.
    expect(hayVersionNueva("0.2.172.0", "0.2.171.0")).toBe(true);
  });

  it("sin dato NO se avisa — en ninguna de las dos direcciones", () => {
    // Un fallo de red o un despliegue sin el archivo no pueden convertirse en
    // "tu app está vieja": a la tercera barra falsa nadie le vuelve a creer, y
    // ahí el aviso queda inservible para cuando de verdad importe.
    expect(hayVersionNueva(undefined, "0.2.172.0")).toBe(false);
    expect(hayVersionNueva("0.2.172.0", undefined)).toBe(false);
    expect(hayVersionNueva("", "0.2.172.0")).toBe(false);
    expect(hayVersionNueva("0.2.172.0", "")).toBe(false);
    expect(hayVersionNueva(VERSION_DESCONOCIDA, "0.2.172.0")).toBe(false);
    expect(hayVersionNueva("0.2.172.0", VERSION_DESCONOCIDA)).toBe(false);
  });

  it("espacios de más no son una versión distinta", () => {
    expect(hayVersionNueva("0.2.172.0", " 0.2.172.0\n")).toBe(false);
  });
});
