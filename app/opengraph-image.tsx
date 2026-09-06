import { ImageResponse } from "next/og";

// LA IMAGEN AL COMPARTIR EL LINK (WhatsApp, iMessage, X).
//
// Hasta la apertura, compartir stailist.co no mostraba nada: ni imagen ni
// título propio. Se genera aquí en vez de guardar un PNG para que el wordmark
// y la línea salgan siempre de la misma fuente que el resto del producto.
// Colores del DS v3 en literal a propósito: esto no es una página, es una
// imagen renderizada fuera del CSS de la app (como los correos).
export const runtime = "edge";
export const alt = "stailist — tu stylist personal con IA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#f4f3f1",
          color: "#141414",
          fontFamily: "Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 56, fontWeight: 700, letterSpacing: -3 }}>
          st
          <span style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 400 }}>
            ai
          </span>
          list
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1.0, letterSpacing: -4, maxWidth: 1000 }}>
            Tu clóset está lleno. Y aun así, no sabes qué ponerte.
          </div>
          <div style={{ fontSize: 34, color: "#6f6f6f" }}>
            Te armo outfits con la ropa que ya tienes.
          </div>
        </div>
      </div>
    ),
    size
  );
}
