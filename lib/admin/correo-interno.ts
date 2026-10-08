import { SANS, WORDMARK } from "@/lib/email-marca";

// EL SOBRE DE LOS CORREOS INTERNOS: los que le llegan a quien administra
// stailist (el resumen de las 8, la alarma de la IA, los reportes de las
// usuarias). Nació el 2026-10-07: el resumen ya tenía formato, pero la alarma
// y los reportes llegaban como texto plano metido en un <pre>, y Roberto pidió
// que todos se vieran igual de cuidados.
//
// La paleta es la traducción a hex de los tokens de app/globals.css (tinta,
// papel, líneas y los tres de estado: --c-success, --c-warning, --c-error),
// por la misma razón que lib/email-marca.ts: Gmail borra las variables CSS.

export const TINTA = "#141414";
export const TINTA2 = "#363636";
export const GRIS = "#6f6f6f";
export const GRIS_CLARO = "#9a9a9a";
export const LINEA = "#e4e3e0";
export const PAPEL = "#f4f3f1";
export const SUPERFICIE = "#ffffff";
export const NEGRO = "#0a0a0a";
export const VERDE = "#4c7a5e";
export const OCRE = "#8a6d1f";
export const ROJO = "#b3261e";

/** Todo lo que viene de la base (correos, textos de usuarias) se escapa: nada se interpreta como HTML. */
export function esc(s: string | number | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Una fila del cuerpo. */
export function fila(padding: string, contenido: string): string {
  return `<tr><td style="padding:${padding};">${contenido}</td></tr>`;
}

/** El documento entero: membrete, el cuerpo que se le pase y un pie gris. */
export function envolturaInterna(cuerpo: string, pie: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:${PAPEL};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPEL};">
    <tr><td align="center" style="padding:36px 14px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;font-family:${SANS};">
        <tr><td style="padding:0 6px 18px;border-bottom:1px solid ${LINEA};">${WORDMARK}</td></tr>
${cuerpo}
        <tr><td style="padding:28px 6px 0;font-size:12px;line-height:1.55;color:${GRIS_CLARO};">
          ${pie}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Un aviso con su franja de color a la izquierda: título fuerte, explicación debajo, enlace opcional. */
export function bloqueAviso(o: { color: string; etiqueta: string; titulo: string; detalle: string; enlace?: { href: string; texto: string } }): string {
  return `<div style="border-left:3px solid ${o.color};padding:4px 0 4px 14px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${o.color};">${esc(o.etiqueta)}</div>
      <div style="margin-top:6px;font-size:17px;line-height:1.3;font-weight:700;color:${TINTA};word-break:break-word;">${esc(o.titulo)}</div>
      <p style="margin:8px 0 0;font-size:14px;line-height:1.55;color:${TINTA2};">${esc(o.detalle)}</p>
      ${o.enlace ? `<p style="margin:10px 0 0;font-size:14px;"><a href="${o.enlace.href}" style="color:${TINTA};font-weight:700;">${esc(o.enlace.texto)} &rarr;</a></p>` : ""}
    </div>`;
}

/** Pares etiqueta / valor en dos columnas, para los datos de contexto. */
export function tablaDatos(pares: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINEA};">${pares
    .map(
      ([k, v]) => `<tr>
        <td style="padding:9px 0;border-bottom:1px solid ${LINEA};font-size:12px;color:${GRIS};width:34%;vertical-align:top;">${esc(k)}</td>
        <td style="padding:9px 0;border-bottom:1px solid ${LINEA};font-size:14px;color:${TINTA};word-break:break-word;">${esc(v)}</td>
      </tr>`
    )
    .join("")}</table>`;
}
