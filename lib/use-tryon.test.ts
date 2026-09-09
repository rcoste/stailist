import { describe, expect, it } from "vitest";
import { mensajeDeErrorTryon } from "./use-tryon";

// EL CASO DE VAL (2026-09-09): cuatro intentos seguidos de verse un look, los
// cuatro con timeout a los 52 segundos exactos porque el modelo de imagen de
// Google estaba caído. Lo que la puso a reintentar tres veces más fue el
// mensaje "Inténtalo de nuevo" — sobre un fallo que no se arregla repitiendo.
describe("mensajeDeErrorTryon — de quién es la culpa", () => {
  it("un fallo del proveedor NO invita a repetir de inmediato", () => {
    const m = mensajeDeErrorTryon("generacion");
    expect(m).not.toMatch(/int[eé]ntalo de nuevo\.$/i);
    expect(m).toMatch(/par de minutos/i);
  });

  it("y dice que no es culpa suya: si no, asume que algo hizo mal", () => {
    expect(mensajeDeErrorTryon("generacion")).toMatch(/no tuyo|de mi lado/i);
  });

  it("los errores nuestros sí se reintentan: ahí repetir puede funcionar", () => {
    for (const codigo of ["descarga", "guardar", "avatar", undefined, null]) {
      expect(mensajeDeErrorTryon(codigo)).toBe("No pude crear tu look. Inténtalo de nuevo.");
    }
  });

  it("sin la llave configurada, el mensaje es el suyo (no es un fallo de red)", () => {
    expect(mensajeDeErrorTryon("sin_api_key")).toBe("El try-on aún no está conectado.");
  });

  it("cero jerga: no dice 'proveedor', 'API', 'timeout' ni '502'", () => {
    for (const codigo of ["generacion", "descarga", "sin_api_key"]) {
      expect(mensajeDeErrorTryon(codigo)).not.toMatch(/proveedor|API|timeout|502|servidor|Google/i);
    }
  });
});
