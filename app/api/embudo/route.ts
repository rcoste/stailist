import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_ORIGEN } from "@/lib/origen";
import { marcarPaso, sujetoValido } from "@/lib/embudo-marcas";

// "ABRIÓ LA LANDING": la única marca del embudo que manda el navegador (las
// demás las pone el servidor en /empezar y en la pantalla del correo). Ver
// lib/embudo-marcas.ts y la migración 0168.
//
// Sólo acepta ese paso: los otros tres no se pueden fingir desde fuera. El
// sujeto es un id aleatorio que el navegador guarda en su localStorage; cada
// uno cuenta una vez. Responde 204 siempre: es una medición, nadie espera nada.
export async function POST(request: NextRequest) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    /* cuerpo vacío o roto: no se cuenta */
  }
  const sujeto = (body as { sujeto?: unknown } | null)?.sujeto;
  if (sujetoValido(sujeto)) {
    await marcarPaso("landing", sujeto, request.cookies.get(COOKIE_ORIGEN)?.value);
  }
  return new NextResponse(null, { status: 204 });
}
