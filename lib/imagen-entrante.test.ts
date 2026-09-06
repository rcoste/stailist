import { describe, it, expect } from "vitest";
import {
  MAX_BYTES,
  MOTIVO_IMAGEN,
  bytesDeBase64,
  leerImagenEntrante,
  tipoRealDe,
} from "./imagen-entrante";

// Prefijos base64 reales de cada formato (los primeros bytes de la cabecera).
const JPEG = "/9j/4AAQSkZJRg" + "A".repeat(40);
const PNG = "iVBORw0KGgoAAAANSUhEUg" + "A".repeat(40);
const WEBP = "UklGRiQAAABXRUJQ" + "A".repeat(40);
const url = (tipo: string, b64: string) => `data:${tipo};base64,${b64}`;

describe("qué es de verdad la foto", () => {
  it("reconoce los tres formatos por sus bytes", () => {
    expect(tipoRealDe(JPEG)).toBe("image/jpeg");
    expect(tipoRealDe(PNG)).toBe("image/png");
    expect(tipoRealDe(WEBP)).toBe("image/webp");
  });

  it("no reconoce lo que no es imagen", () => {
    // "PDF-1.4…" y un SVG en base64: los dos pasaban el regex `image/\w+`.
    expect(tipoRealDe("JVBERi0xLjQK")).toBeNull();
    expect(tipoRealDe("PHN2ZyB4bWxucz0i")).toBeNull();
  });
});

describe("la etiqueta no manda, los bytes sí", () => {
  it("un SVG disfrazado de PNG se rechaza", () => {
    const r = leerImagenEntrante(url("image/png", "PHN2ZyB4bWxucz0i"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("tipo");
  });

  it("un JPEG etiquetado como PNG se acepta CON SU TIPO REAL", () => {
    // Importa para lo que se guarda en Storage: antes se guardaba el tipo que
    // declaraba el cliente, así que el archivo quedaba mintiendo sobre sí mismo.
    const r = leerImagenEntrante(url("image/png", JPEG));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mediaType).toBe("image/jpeg");
  });

  it("image/svg+xml ya no pasa ni declarándose", () => {
    const r = leerImagenEntrante(url("image/svg+xml", "PHN2ZyB4bWxucz0i"));
    expect(r.ok).toBe(false);
  });
});

describe("tamaño", () => {
  it("calcula los bytes sin decodificar, con y sin relleno", () => {
    expect(bytesDeBase64("QUJD")).toBe(3); // "ABC"
    expect(bytesDeBase64("QUI=")).toBe(2); // "AB"
    expect(bytesDeBase64("QQ==")).toBe(1); // "A"
  });

  it("deja pasar una foto normal", () => {
    expect(leerImagenEntrante(url("image/jpeg", JPEG)).ok).toBe(true);
  });

  it("corta lo que pasa de 3 MB", () => {
    const enorme = "/9j/" + "A".repeat(Math.ceil((MAX_BYTES * 4) / 3) + 8);
    const r = leerImagenEntrante(url("image/jpeg", enorme));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("grande");
  });

  it("el tamaño se revisa ANTES que el tipo: el mensaje útil gana", () => {
    // Un archivo enorme que además no es imagen debe decir "pesa demasiado",
    // que es lo accionable, y no "no es una foto".
    const enorme = "JVBER" + "A".repeat(Math.ceil((MAX_BYTES * 4) / 3) + 8);
    const r = leerImagenEntrante(url("application/pdf", enorme));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("grande");
  });
});

describe("entradas rotas", () => {
  it("sin foto", () => {
    const r = leerImagenEntrante(undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("falta");
  });

  it("una cadena que no es data-URL", () => {
    const r = leerImagenEntrante("https://ejemplo.com/foto.jpg");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("formato");
  });

  it("una data-URL sin contenido", () => {
    expect(leerImagenEntrante("data:image/jpeg;base64,").ok).toBe(false);
  });
});

describe("los mensajes", () => {
  it("hay uno por motivo y ninguno dice 'error'", () => {
    for (const m of Object.values(MOTIVO_IMAGEN)) {
      expect(m.length).toBeGreaterThan(10);
      expect(m.toLowerCase()).not.toMatch(/error|inválid|denegad/);
    }
  });
});
