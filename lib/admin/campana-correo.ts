import { SANS, SERIF, SITE, WORDMARK, boton, kicker, serifItalica } from "@/lib/email-marca";
import { fmtSegundos } from "@/lib/admin/embudo-tiempos";
import { MODULOS, type Estado } from "@/lib/admin/objetivos";
import {
  PARO_MINIMO_VOLVIERON,
  PARO_MUESTRA,
  campanasParaCorreo,
  costoPor,
  type DatosCorreoDiario,
  type EstadoParo,
  type ResumenCampana,
} from "@/lib/admin/campana";

// EL CORREO DIARIO, CON FORMATO.
//
// POR QUÉ EXISTE: hasta el 2026-10-04 el correo de las 8 am era el texto plano
// metido en un <pre>. Roberto lo lee en el celular con el café y pidió que se
// viera "bonito, no vil texto": con texto corrido, el dato que importa (¿volvió
// alguien?) quedaba enterrado en el mismo gris que el gasto de IA.
//
// Mismos números que la versión de texto (correoDiario en campana.ts), que
// sigue saliendo como alternativa del mismo correo: esto es solo la forma.
//
// Reusa el membrete de los correos a usuarias (lib/email-marca.ts) para que se
// vea de la misma casa, pero con su propio shell: este es un reporte interno
// (sin pie de baja) y más ancho, porque lleva tablas. Los colores van en hex
// inline por la misma razón que en email-marca: Gmail borra las variables CSS.
// Son la traducción de los tokens de app/globals.css (tinta, papel, líneas y
// los tres de estado: --c-success, --c-warning, --c-error).

const TINTA = "#141414";
const TINTA2 = "#363636";
const GRIS = "#6f6f6f";
const GRIS_CLARO = "#9a9a9a";
const LINEA = "#e4e3e0";
const PAPEL = "#f4f3f1";
const SUPERFICIE = "#ffffff";
const NEGRO = "#0a0a0a";

const COLOR_ESTADO: Record<Estado, string> = {
  bien: "#4c7a5e",
  vigilar: "#8a6d1f",
  alarma: "#b3261e",
  "sin-datos": GRIS_CLARO,
};
const TEXTO_ESTADO: Record<Estado, string> = {
  bien: "va bien",
  vigilar: "vigilar",
  alarma: "alarma",
  "sin-datos": "faltan datos",
};

/** Todo lo que viene de la base (correos, campañas) se escapa: nada se interpreta como HTML. */
export function esc(s: string | number | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const usd = (n: number) => `$${n.toFixed(2)}`;
const mxn = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("es-MX")}`);
const num = (n: number | null) => (n == null ? "—" : n.toLocaleString("es-MX"));

/** "2026-10-03" → "sábado 3 de octubre". Al mediodía UTC para que ningún huso lo mueva de día. */
export function diaEnPalabras(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dia;
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(d);
}

function fila(padding: string, contenido: string): string {
  return `<tr><td style="padding:${padding};">${contenido}</td></tr>`;
}

function titulo(texto: string): string {
  return `<div style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${GRIS};padding-bottom:10px;border-bottom:1px solid ${LINEA};">${texto}</div>`;
}

/** Una cifra grande con su etiqueta: el vistazo de arriba. */
function cifra(valor: string, etiqueta: string, sub?: string): string {
  return `<td width="50%" valign="top" style="padding:6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SUPERFICIE};border:1px solid ${LINEA};border-radius:6px;">
        <tr><td style="padding:16px 16px 14px;">
          <div style="font-size:30px;font-weight:700;letter-spacing:-0.03em;line-height:1;color:${TINTA};">${valor}</div>
          <div style="margin-top:8px;font-size:13px;font-weight:700;color:${TINTA2};">${etiqueta}</div>
          ${sub ? `<div style="margin-top:2px;font-size:12px;color:${GRIS};">${sub}</div>` : ""}
        </td></tr>
      </table>
    </td>`;
}

/** Barra de avance hecha con dos celdas: la única forma que respetan Gmail y Outlook. */
function barra(parte: number, total: number, color: string, fondo: string = LINEA): string {
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((parte / total) * 100))) : 0;
  const lleno = pct > 0 ? `<td width="${pct}%" style="background:${color};height:8px;font-size:0;line-height:0;">&nbsp;</td>` : "";
  const vacio = pct < 100 ? `<td style="background:${fondo};height:8px;font-size:0;line-height:0;">&nbsp;</td>` : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:4px;overflow:hidden;"><tr>${lleno}${vacio}</tr></table>`;
}

function etiquetaParo(p: EstadoParo): { texto: string; color: string } {
  if (p.estado === "pasa") return { texto: "Pasa", color: COLOR_ESTADO.bien };
  if (p.estado === "no-pasa") return { texto: "No pasa", color: COLOR_ESTADO.alarma };
  return { texto: "Faltan datos", color: GRIS };
}

function bloqueParo(p: EstadoParo): string {
  const e = etiquetaParo(p);
  const explicacion =
    p.estado === "pasa"
      ? `Ya volvieron ${PARO_MINIMO_VOLVIERON} o más de las primeras ${PARO_MUESTRA}.`
      : p.estado === "no-pasa"
        ? `Ya no se puede llegar a ${PARO_MINIMO_VOLVIERON} de ${PARO_MUESTRA}: se para y no se escala.`
        : `Se decide con ${PARO_MINIMO_VOLVIERON} que vuelvan de las primeras ${PARO_MUESTRA} de anuncios con primer look.`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${NEGRO};border-radius:6px;">
      <tr><td style="padding:22px 22px 20px;">
        <span style="font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.55);">Criterio de paro</span>
        <span style="float:right;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;${
          p.estado === "faltan-datos" ? `background:#ffffff;color:${NEGRO};` : `background:${e.color};color:#ffffff;`
        }padding:4px 9px;border-radius:2px;">${e.texto}</span>
        <div style="margin-top:16px;font-family:${SERIF};font-style:italic;font-size:26px;line-height:1.2;color:#ffffff;">${p.volvieron} de ${PARO_MINIMO_VOLVIERON} volvieron</div>
        <div style="margin-top:14px;">${barra(p.volvieron, PARO_MINIMO_VOLVIERON, "#ffffff", "rgba(255,255,255,0.16)")}</div>
        <div style="margin-top:14px;font-size:13px;line-height:1.5;color:rgba(255,255,255,0.72);">
          ${p.conPrimerLook} de ${PARO_MUESTRA} en la muestra · ${p.cerradas} ya cumplieron su semana.<br>${explicacion}
        </div>
      </td></tr>
    </table>`;
}

function bloqueQuien(d: DatosCorreoDiario): string {
  const q = d.quienAyer ?? [];
  if (q.length === 0) return "";
  const filas = q
    .map(
      (p) => `<tr><td style="padding:12px 0;border-bottom:1px solid ${LINEA};">
          <div style="font-size:14px;font-weight:700;color:${TINTA};word-break:break-all;">${esc(p.correo)}</div>
          <div style="margin-top:3px;font-size:13px;line-height:1.5;color:${TINTA2};">${esc(p.origen)} · ${esc(p.dispositivo ?? "aparato sin dato")}</div>
          <div style="margin-top:2px;font-size:13px;line-height:1.5;color:${GRIS};">${esc(p.paso)} · ${p.prendas} ${p.prendas === 1 ? "prenda" : "prendas"}${
            p.fotos ? ` (${p.fotos} de foto propia)` : ""
          }</div>
        </td></tr>`
    )
    .join("");
  return `${titulo(`Quién llegó ayer (${q.length})`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table>`;
}

/** El embudo de una campaña en una tira: de la plataforma (clics) a lo que decide (volvieron). */
function tarjetaCampana(c: ResumenCampana): string {
  const pasos: [string, string][] = [
    ["clics", num(c.clics)],
    ["entraron", num(c.entraron)],
    ["primer look", num(c.primerLook)],
    ["volvieron", `${c.volvieron}/${c.ventanaCerrada}`],
  ];
  const celdas = pasos
    .map(
      ([etq, v]) => `<td width="25%" align="center" style="padding:10px 2px;border-left:1px solid ${LINEA};">
          <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:${TINTA};">${v}</div>
          <div style="margin-top:3px;font-size:11px;color:${GRIS};">${etq}</div>
        </td>`
    )
    .join("")
    .replace(`border-left:1px solid ${LINEA};`, "");
  const costoLook = costoPor(c, c.primerLook);
  // Antes de la cuenta (lib/embudo-marcas.ts): sólo si ya hay algo que contar.
  const previo =
    c.landing || c.boton || c.correoVisto
      ? `<tr><td style="padding:2px 16px 10px;font-size:12px;line-height:1.6;color:${TINTA2};">
          Abrieron la landing <b>${c.landing}</b> → tocaron el botón <b>${c.boton}</b> → verificaron su correo <b>${c.correoOk}</b> de ${c.correoVisto}
        </td></tr>`
      : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;background:${SUPERFICIE};border:1px solid ${LINEA};border-radius:6px;">
      <tr><td style="padding:14px 16px 4px;">
        <span style="font-size:15px;font-weight:700;color:${TINTA};">${esc(c.campana)}</span>
        <span style="font-size:12px;color:${GRIS};"> · ${esc(c.fuente)}</span>
      </td></tr>
      ${previo}
      <tr><td style="padding:0 8px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${celdas}</tr></table></td></tr>
      <tr><td style="padding:4px 16px 14px;font-size:12px;line-height:1.6;color:${GRIS};border-top:1px solid ${LINEA};">
        Gastado ${mxn(c.costoMxn)} MXN · por primer look ${mxn(costoLook)} · tiempo al primer look ${esc(fmtSegundos(c.ttvMedianaS))}${
          c.impresiones != null ? ` · ${num(c.impresiones)} impresiones` : ""
        }
      </td></tr>
    </table>`;
}

function bloqueCampanas(d: DatosCorreoDiario): string {
  const deCampana = campanasParaCorreo(d.campanas);
  if (deCampana.length === 0) {
    return `${titulo("Campañas")}<p style="margin:12px 0 0;font-size:14px;color:${GRIS};">Todavía no hay nada con origen de campaña ni gasto capturado.</p>`;
  }
  return `${titulo(`Campañas · desde ${esc(diaEnPalabras(d.desde))}`)}${deCampana.map(tarjetaCampana).join("")}`;
}

function bloqueObjetivos(d: DatosCorreoDiario): string {
  const lineas = d.objetivosLineas ?? [];
  if (lineas.length === 0) return "";
  const filas = lineas
    .map((l) => {
      const color = COLOR_ESTADO[l.estado];
      return `<tr><td style="padding:11px 0;border-bottom:1px solid ${LINEA};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td valign="top" style="font-size:14px;line-height:1.45;color:${TINTA};">
              <span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${color};margin-right:8px;"></span>${esc(l.objetivo)}
              <div style="margin:2px 0 0 16px;font-size:12px;color:${GRIS};">meta: ${esc(l.meta)}${l.nota && l.estado === "alarma" ? ` · ${esc(l.nota)}` : ""}</div>
            </td>
            <td valign="top" align="right" width="38%" style="padding-left:12px;">
              <div style="font-size:14px;font-weight:700;color:${TINTA};">${esc(l.real)}</div>
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${color};">${TEXTO_ESTADO[l.estado]}</div>
            </td>
          </tr></table>
        </td></tr>`;
    })
    .join("");
  const uso = d.uso;
  const usoTxt =
    uso && uso.personas > 0
      ? `<p style="margin:12px 0 0;font-size:13px;line-height:1.55;color:${TINTA2};">
          <b>Su primera semana</b> (${uso.personas} de anuncios con primer look): ${uso.conRopaPropia} subieron ropa propia,
          mediana de ${uso.looksMediana ?? "—"} looks. Módulos: ${MODULOS.map((m) => `${m.etiqueta} ${uso.modulos[m.clave]}`).join(", ")}.
        </p>`
      : "";
  return `${titulo("Objetivos del plan P-03")}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table>${usoTxt}`;
}

function bloqueAvatar(d: DatosCorreoDiario): string {
  const a = d.avatar;
  if (!a || (a.cara === 0 && a.guardaron === 0)) return "";
  const pasos: [string, number][] = [
    ["generaron la cara", a.cara],
    ["generaron el cuerpo", a.cuerpo],
    ["lo guardaron", a.guardaron],
  ];
  const celdas = pasos
    .map(
      ([etq, n]) => `<td width="33%" align="center" style="padding:10px 4px;">
          <div style="font-size:20px;font-weight:700;color:${TINTA};">${n}</div>
          <div style="font-size:12px;color:${GRIS};">${etq}</div>
        </td>`
    )
    .join("");
  return `${titulo("Avatar · cuentas de la ventana")}<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${celdas}</tr></table>`;
}

function bloqueAparatos(d: DatosCorreoDiario): string {
  const r = d.dispositivos;
  if (!r) return "";
  const partes = (
    [
      ["Computadora", r.computadora],
      ["Celular", r.celular],
      ["Tablet", r.tablet],
      ["Sin dato", r.sinDato],
    ] as const
  ).filter(([, c]) => c.cuentas > 0);
  if (partes.length === 0) return "";
  const celdas = partes
    .map(
      ([n, c]) => `<td align="center" style="padding:10px 4px;">
          <div style="font-size:20px;font-weight:700;color:${TINTA};">${c.cuentas}</div>
          <div style="font-size:12px;color:${GRIS};">${n} · ${c.primerLook} con primer look</div>
        </td>`
    )
    .join("");
  return `${titulo("Por aparato · cuentas de anuncios")}<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${celdas}</tr></table>`;
}

/** El correo diario en HTML. Misma información que `correoDiario().text`, con jerarquía. */
export function correoDiarioHtml(d: DatosCorreoDiario): string {
  const ia = d.iaTop ? `${d.iaAyerLlamadas} llamadas · más: ${esc(d.iaTop.correo)} (${usd(d.iaTop.usd)})` : `${d.iaAyerLlamadas} llamadas`;
  const cuerpo = [
    fila(
      "26px 6px 0",
      `${kicker("Pulso diario")}<div style="margin-top:10px;font-size:28px;line-height:1.1;font-weight:700;letter-spacing:-0.035em;color:${TINTA};">Así fue el ${serifItalica(
        esc(diaEnPalabras(d.ayer))
      )}.</div>`
    ),
    fila(
      "18px 0 0",
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>${cifra(String(d.nuevasAyer), "cuentas nuevas", `${d.nuevasAyerDeCampana} de anuncios`)}${cifra(
          String(d.primerLookAyer),
          "llegaron a su primer look"
        )}</tr>
        <tr>${cifra(usd(d.iaAyerUsd), "gasto de IA", ia)}${cifra(
          `${d.paro.volvieron}/${PARO_MINIMO_VOLVIERON}`,
          "volvieron",
          `de ${d.paro.conPrimerLook} con primer look`
        )}</tr>
      </table>`
    ),
    fila("18px 6px 0", bloqueParo(d.paro)),
    bloqueQuien(d) ? fila("30px 6px 0", bloqueQuien(d)) : "",
    fila("30px 6px 0", bloqueCampanas(d)),
    bloqueObjetivos(d) ? fila("30px 6px 0", bloqueObjetivos(d)) : "",
    bloqueAvatar(d) ? fila("30px 6px 0", bloqueAvatar(d)) : "",
    bloqueAparatos(d) ? fila("30px 6px 0", bloqueAparatos(d)) : "",
    fila("32px 6px 0", boton({ href: `${SITE}/admin/campana`, texto: "Abrir el panel" })),
  ]
    .filter(Boolean)
    .join("\n");

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:${PAPEL};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPEL};">
    <tr><td align="center" style="padding:36px 14px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;font-family:${SANS};">
        <tr><td style="padding:0 6px 18px;border-bottom:1px solid ${LINEA};">${WORDMARK}</td></tr>
${cuerpo}
        <tr><td style="padding:28px 6px 0;font-size:12px;line-height:1.55;color:${GRIS_CLARO};">
          Reporte interno de stailist, para quien administra la campaña. Hora de la Ciudad de México.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
