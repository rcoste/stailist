// EL MEMBRETE DE LOS CORREOS — el shell de marca que comparten todos.
//
// POR QUÉ EXISTE: hasta el 2026-08-14 solo había un correo (el semanal) y su
// membrete —wordmark, font stacks, paleta, pie de baja— vivía dibujado a mano
// dentro de su propia plantilla. Al nacer el segundo correo (el reenganche de
// 48h) tocaba copiarlo, y una copia de marca es una copia que se despega: el
// pendiente estaba anotado en TODOS.md justo con este disparador ("el próximo
// correo standalone nuevo"). Aquí queda el sello; cada correo pone su carta.
//
// POR QUÉ NO USA LOS TOKENS DE app/globals.css, que es la regla del proyecto:
// un correo es HTML que se abre DENTRO de Gmail/Outlook, no en la app. No hay
// hoja de estilos, no hay variables CSS, no hay clases — todo va en `style=`
// inline o el cliente lo borra. Los valores de aquí son la traducción a mano de
// los tokens v3, y cuando cambie la paleta hay que traducirlos otra vez: es la
// duplicación que el medio impone, no una que elegimos.
//
// Tres cosas más que impone el correo y explican lo que parece anticuado:
//   · maquetación con <table>, no flex ni grid (Outlook ignora el resto);
//   · sin fuentes propias (Gmail ignora Arimo/Instrument Serif) → web-safe, con
//     Georgia itálica haciendo de serif de acento;
//   · sin SVG (Gmail lo borra) → el isotipo no viaja, el wordmark va en texto.

export const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stailist.co";

export const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif";
export const SERIF = "Georgia,'Times New Roman',serif";

/** La serif de acento SIEMPRE va en itálica: en redonda parece la Bodoni del
 *  rebrand v2 y esa es una marca muerta. Misma regla que en la app. */
export function serifItalica(texto: string): string {
  return `<span style="font-family:${SERIF};font-style:italic;font-weight:400;letter-spacing:0;">${texto}</span>`;
}

/** Wordmark st·ai·list con el "ai" en serif itálica (la firma de la marca). */
export const WORDMARK = `<span style="font-size:22px;font-weight:700;letter-spacing:-0.045em;color:#141414;line-height:1;">st${serifItalica(
  "ai"
)}list</span>`;

/** Antetítulo en versalitas — el "TU LOOK DE LA SEMANA" de arriba del titular. */
export function kicker(texto: string): string {
  return `<span style="font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#6f6f6f;">${texto}</span>`;
}

/**
 * La CARD NEGRA: el bloque de tinta que sostiene lo concreto del correo. En el
 * semanal es la promesa genérica; en el reenganche es SU look, con nombre y
 * prendas. Misma forma a propósito — es el único elemento con peso visual y
 * quien abre los dos correos tiene que reconocer que son de la misma casa.
 */
export function cardNegra(o: { kicker: string; frase: string; pie: string }): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:6px;">
            <tr><td style="padding:24px 22px;">
              <span style="font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.5);">${o.kicker}</span>
              <div style="margin:11px 0 0;font-family:${SERIF};font-style:italic;font-size:23px;line-height:1.25;color:#ffffff;">${o.frase}</div>
              <div style="margin:16px 0 0;padding-top:15px;border-top:1px solid rgba(255,255,255,0.16);font-size:12.5px;letter-spacing:0.02em;color:rgba(255,255,255,0.66);">${o.pie}</div>
            </td></tr>
          </table>`;
}

/** El CTA principal. Uno por correo — dos botones es no tener ninguno. */
export function boton(o: { href: string; texto: string }): string {
  return `<a href="${o.href}" style="display:inline-block;background:#0a0a0a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:-0.01em;padding:15px 26px;border-radius:3px;">${o.texto} &rarr;</a>`;
}

/**
 * La nota al pie con hairline: una segunda invitación que NO le pelea al CTA.
 * Es un enlace subrayado, nunca un botón — la jerarquía es el mensaje.
 */
export function notaHairline(o: {
  kicker: string;
  titulo: string;
  desc: string;
  cta: string;
  href: string;
}): string {
  return `<tr><td style="padding:30px 6px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e4e3e0;">
        <tr><td style="padding:22px 0 0;font-family:${SANS};">
          <span style="font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#9a9a9a;">${o.kicker}</span>
          <div style="margin:12px 0 0;font-size:17px;font-weight:700;letter-spacing:-0.02em;color:#141414;">${o.titulo}</div>
          <p style="margin:6px 0 0;font-size:14px;line-height:1.55;color:#363636;">${o.desc}</p>
          <a href="${o.href}" style="display:inline-block;margin:12px 0 0;font-size:14px;font-weight:700;letter-spacing:-0.01em;color:#141414;text-decoration:none;border-bottom:1.5px solid #141414;padding-bottom:1px;">${o.cta} &rarr;</a>
        </td></tr>
      </table>
    </td></tr>`;
}

/** Una fila del correo. El padding lateral de 6px es constante en todo el shell. */
export function bloque(padding: string, contenido: string): string {
  return `<tr><td style="padding:${padding};">
          ${contenido}
        </td></tr>`;
}

/**
 * Ensarta las filas del cuerpo con la sangría que espera `documento`. Existe
 * para que la maña de la indentación viva en UN lugar: el HTML de correo se
 * lee a mano cuando algo se ve mal en Outlook, y una columna que baila hace
 * ilegible el diff.
 */
export function filas(rows: string[]): string {
  return rows.map((r) => `\n        ${r}`).join("\n");
}

/** URL de baja de un clic (sin login). El token ES el secreto. */
export function urlBaja(token: string): string {
  return `${SITE}/api/email/baja?token=${token}`;
}

/**
 * El documento completo: papel hueso, columna de 480, wordmark arriba y el pie
 * con la baja. `cuerpo` son las filas <tr> de la carta.
 *
 * `motivo` explica por qué le llega — es requisito de deliverability y de
 * decencia, y cambia por correo ("pediste tu look semanal" vs "activaste los
 * correos"). Sin él, Postmark y Gmail nos castigan la reputación.
 */
export function documento(o: { cuerpo: string; motivo: string; bajaUrl: string }): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f3f1;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f1;">
    <tr><td align="center" style="padding:44px 20px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;font-family:${SANS};">

        <tr><td style="padding:0 6px 20px;border-bottom:1px solid #e4e3e0;">${WORDMARK}</td></tr>
${o.cuerpo}

      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;">
        <tr><td style="padding:28px 6px 0;">
          <p style="margin:0;font-size:12px;line-height:1.55;color:#9a9a9a;font-family:${SANS};">
            ${o.motivo}
            <a href="${o.bajaUrl}" style="color:#9a9a9a;text-decoration:underline;">Date de baja</a> cuando quieras.
          </p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</body></html>`;
}
