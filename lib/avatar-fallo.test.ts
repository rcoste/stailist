import { describe, expect, it } from "vitest";
import { falloDeRespuesta, textoFallo } from "@/lib/avatar-fallo";
import { CUOTAS, MENSAJE_CUOTA } from "@/lib/cuotas";

describe("falloDeRespuesta: cada respuesta del API a su causa", () => {
  it("el 429 del tope es un límite con el mensaje del servidor, no un error", () => {
    const f = falloDeRespuesta(429, { error: "cuota", motivo: "cuota", mensaje: MENSAJE_CUOTA.avatar });
    expect(f).toEqual({ tipo: "limite", mensaje: MENSAJE_CUOTA.avatar });
  });

  it("el 429 sin mensaje igual es un límite", () => {
    expect(falloDeRespuesta(429, null).tipo).toBe("limite");
  });

  it("el 403 del permiso parental trae su mensaje", () => {
    expect(falloDeRespuesta(403, { error: "permiso_pendiente", message: "falta permiso" })).toEqual({
      tipo: "permiso",
      mensaje: "falta permiso",
    });
  });

  it("Google respondiendo sin imagen es un rechazo por la foto", () => {
    const f = falloDeRespuesta(502, { error: "generacion", detalle: "respondió sin imagen (IMAGE_SAFETY)" });
    expect(f.tipo).toBe("rechazo");
  });

  it("un 500 o un timeout de Google es una falla pasajera del dibujo", () => {
    expect(falloDeRespuesta(502, { error: "generacion", detalle: "HTTP 500: internal" }).tipo).toBe("dibujo");
    expect(falloDeRespuesta(504, null).tipo).toBe("dibujo");
  });

  it("sin sesión", () => {
    expect(falloDeRespuesta(401, { error: "no_auth" }).tipo).toBe("sesion");
  });
});

describe("textoFallo: qué se dice y qué botón se ofrece", () => {
  it("en el límite NO se ofrece reintentar: chocaría con el mismo tope", () => {
    const t = textoFallo({ tipo: "limite", mensaje: MENSAJE_CUOTA.avatar }, 3);
    expect(t.accion).toBeNull();
    expect(t.detalle).toMatch(/^Por hoy/);
  });

  it("si falló el guardado, el botón guarda otra vez en vez de redibujar", () => {
    expect(textoFallo({ tipo: "guardar" }, 0).accion?.tipo).toBe("guardar");
  });

  it("el rechazo manda a cambiar la foto: las mismas fotos darían lo mismo", () => {
    expect(textoFallo({ tipo: "rechazo" }, 1).accion?.tipo).toBe("fotos");
  });

  it("la segunda falla pasajera ya no dice 'dale otra vez'", () => {
    expect(textoFallo({ tipo: "dibujo" }, 1).detalle).toMatch(/otra vez/);
    expect(textoFallo({ tipo: "dibujo" }, 2).detalle).not.toMatch(/Dale otra vez/);
  });

  it("ningún mensaje es el genérico de antes", () => {
    const tipos = [
      { tipo: "limite", mensaje: "x" },
      { tipo: "permiso", mensaje: "x" },
      { tipo: "sesion" },
      { tipo: "rechazo" },
      { tipo: "dibujo" },
      { tipo: "red" },
      { tipo: "guardar" },
    ] as const;
    for (const f of tipos) expect(textoFallo(f, 0).titulo).not.toBe("No pude generar tu avatar.");
  });
});

describe("el tope del avatar alcanza para un avatar con ajustes", () => {
  it("cara + cuerpo + hoja de 3 vistas, con dos ajustes y un redibujo automático, cabe", () => {
    // 1 cara + 2 ajustes + 1 redibujo automático + 1 cuerpo + 1 hoja = 6.
    // Con el tope en 5 (hasta 2026-10-08) una usuaria se quedó sin avatar así.
    expect(CUOTAS.avatar).toBeGreaterThanOrEqual(6);
  });
});
