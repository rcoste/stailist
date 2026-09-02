"use client";

import { useEffect } from "react";

// EL ERROR QUE SE COME EL LAYOUT.
//
// global-error sustituye al layout raíz entero, así que aquí NO hay <html> ni
// <body> ni globals.css: los pone este archivo o no los pone nadie. Por eso —y
// sólo por eso— los colores van en estilos inline con los valores literales del
// DS v3, igual que en las plantillas de correo: si la hoja de estilos es
// justamente lo que no cargó, `var(--c-bg)` pintaría transparente sobre blanco.
// Es la única excepción a "cero hex en componentes" fuera de los correos.
//
// `lang="es"` es parte del arreglo: el cartel de fábrica de Next salía en
// inglés y sin idioma declarado.
const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ margin: 0, background: "#f4f3f1", fontFamily: SANS }}>
        <div
          style={{
            maxWidth: 430,
            margin: "0 auto",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            padding: 24,
            boxSizing: "border-box",
            textAlign: "center",
            color: "#141414",
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.045em" }}>
            st
            <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400 }}>
              ai
            </span>
            list
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 32,
              lineHeight: 1.15,
              fontWeight: 600,
              letterSpacing: "-0.035em",
            }}
          >
            Algo se me atoró.
          </h1>
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: "#6f6f6f" }}>
            No es tu culpa. Dale otra vez y seguimos donde estábamos.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 48,
              padding: "0 32px",
              border: "none",
              borderRadius: 4,
              background: "#0a0a0a",
              color: "#ffffff",
              fontSize: 16,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            vuelve a intentar
          </button>
        </div>
      </body>
    </html>
  );
}
