// LA FIRMA "HECHO CON RAICODE.AI" (2026-09-24).
//
// Es la pastilla de raicode, no un componente de stailist, y por eso va TAL
// CUAL la entrega raicode: sus estilos en línea, su forma de pastilla y sus
// tamaños en px. Todo eso rompe DESIGN.md a propósito (radio "full" reservado
// a indicadores, escala de espacios de 4/8/12…), así que un review NO la debe
// "corregir" a tokens: la marca es de ellos. Lo único de stailist es el color:
// texto y borde salen de `currentColor`, del contenedor que la envuelve, que
// va en el gris secundario de cada pantalla.
//
// Dónde vive (y dónde no): el pie de la landing, el login y las páginas
// legales, y el final de la pestaña Cuenta de Perfil. En las pantallas de la
// app con barra de abajo NO: ahí estorba. "Más" es una hoja, no una pantalla.
//
// La imagen se carga de raicode.ai: esa petición le dice a su servidor la IP
// de quien ve la página (no viaja nada de la cuenta). Si el aviso de
// privacidad llega a pedirlo, se sirve el PNG desde stailist.co.
export function FirmaRaicode() {
  return (
    <a
      href="https://raicode.ai/?utm_source=app&utm_medium=badge&utm_campaign=stailist"
      target="_blank"
      rel="noopener"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px 4px 8px",
        border: "1px solid color-mix(in srgb, currentColor 35%, transparent)",
        borderRadius: 9999,
        fontSize: 13,
        lineHeight: 1,
        color: "inherit",
        textDecoration: "none",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen de raicode, tal cual la entregan */}
      <img
        src="https://raicode.ai/badge/rai.png"
        alt=""
        width={18}
        height={19}
        style={{ imageRendering: "pixelated" }}
      />
      <span>
        Hecho con <strong>raicode.ai</strong>
      </span>
    </a>
  );
}
