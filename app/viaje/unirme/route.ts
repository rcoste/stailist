import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_INVITACION, tokenValido } from "@/lib/viaje-invitacion";

// Quien llegó por una invitación y acaba de terminar su onboarding: Hoy lo
// manda aquí, se borra la cookie (una sola vez) y entra al asistente de viaje
// con la ruta puesta. Si la cookie no sirve, a Hoy como siempre.
export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_INVITACION)?.value;
  const res = NextResponse.redirect(new URL(tokenValido(token) ? `/viaje?invitacion=${token}` : "/hoy?inicio=1", request.url), 303);
  res.cookies.delete(COOKIE_INVITACION);
  return res;
}
