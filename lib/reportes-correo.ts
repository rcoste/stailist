import { SITE, boton, kicker } from "@/lib/email-marca";
import { OCRE, ROJO, TINTA, TINTA2, envolturaInterna, esc, fila, tablaDatos } from "@/lib/admin/correo-interno";

// EL CORREO DE UN REPORTE (lib/reportes.ts): lo que escribió la persona, de
// quién es y desde qué pantalla. Vive aparte porque reportes.ts es "use
// server" y ahí sólo se exportan funciones async. Usa el sobre de los correos
// internos (lib/admin/correo-interno.ts) desde el 2026-10-07; antes era el
// texto metido en un <pre>.

export function correoReporteHtml(r: {
  tipo: "idea" | "problema";
  texto: string;
  de: string;
  userId: string;
  pantalla: string;
  version: string;
  fallosIa: string[];
}): string {
  const esIdea = r.tipo === "idea";
  const cuerpo = [
    fila(
      "26px 6px 0",
      `${kicker(esIdea ? "Una idea de una usuaria" : "Un problema que reportaron")}<div style="margin-top:10px;font-size:22px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:${TINTA};word-break:break-word;">${esc(r.de)}</div>`
    ),
    fila(
      "18px 6px 0",
      `<div style="border-left:3px solid ${esIdea ? TINTA : ROJO};padding:4px 0 4px 14px;font-size:16px;line-height:1.55;color:${TINTA2};white-space:pre-wrap;word-break:break-word;">${esc(r.texto)}</div>`
    ),
    fila(
      "22px 6px 0",
      tablaDatos([
        ["Pantalla", r.pantalla],
        ["Versión", r.version],
        ["Fallos de IA (2 h)", r.fallosIa.length ? r.fallosIa.join(", ") : "ninguno"],
      ])
    ),
    r.fallosIa.length
      ? fila(
          "14px 6px 0",
          `<p style="margin:0;font-size:13px;line-height:1.5;color:${OCRE};">Tuvo fallos de IA justo antes de escribir: puede que lo que reporta sea eso.</p>`
        )
      : "",
    fila("28px 6px 0", boton({ href: `${SITE}/admin/usuarios/${r.userId}`, texto: "Ver su ficha" })),
  ]
    .filter(Boolean)
    .join("\n");
  return envolturaInterna(
    cuerpo,
    "Llegó desde el botón de reportar de la app. El reporte completo, con lo último que hizo, queda guardado en la base."
  );
}
