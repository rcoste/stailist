import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_INVITACION, INVITACION_MAX_AGE_S, tokenValido } from "@/lib/viaje-invitacion";
import { ONBOARDING_COMPLETE } from "@/lib/onboarding";

// "ARMAR MI MALETA" desde el link de invitación. Tres casos:
//  - ya tiene cuenta y terminó el onboarding → directo al asistente de viaje,
//    pre-llenado con la ruta (/viaje?invitacion=…).
//  - tiene sesión a medias → "/" lo manda a su paso del onboarding; la cookie
//    lo trae al viaje cuando llegue a Hoy (ver /viaje/unirme).
//  - no tiene sesión → la misma puerta sin correo de la landing (/empezar, por
//    POST: el 307 conserva el método). Primero su primer look, como todos;
//    luego el viaje.
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tokenValido(token)) return NextResponse.redirect(new URL("/", request.url), 303);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let destino: NextResponse;
  if (user) {
    const { data: perfil } = await supabase.from("profiles").select("onboarding_step").eq("id", user.id).maybeSingle();
    const listo = Number(perfil?.onboarding_step ?? 0) >= ONBOARDING_COMPLETE;
    destino = NextResponse.redirect(new URL(listo ? `/viaje?invitacion=${token}` : "/", request.url), 303);
    if (listo) return destino;
  } else {
    destino = NextResponse.redirect(new URL("/empezar", request.url), 307);
  }
  destino.cookies.set(COOKIE_INVITACION, token, {
    path: "/",
    maxAge: INVITACION_MAX_AGE_S,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return destino;
}

// Quien teclea la dirección: a la página del link.
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return NextResponse.redirect(new URL(tokenValido(token) ? `/v/${token}` : "/", request.url), 303);
}
