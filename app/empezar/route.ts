import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MARCA_BORRADOR, TOPE_BORRADORES_POR_IP_HORA, entradaSinCorreo } from "@/lib/borrador";
import { anotarIntento, intentosUltimaHora, ipDe } from "@/lib/ritmo-login";

// LA PUERTA SIN CORREO: el botón de la landing manda aquí por POST y esto abre
// un borrador (sesión anónima) y entra directo al onboarding. Ver lib/borrador.ts.
//
// POST y no GET a propósito: un GET que crea cuentas lo dispara cualquier
// buscador que siga el link, o la vista previa de un chat. Con POST hace falta
// que alguien pulse el botón.
export async function POST(request: NextRequest) {
  const a = (ruta: string) => NextResponse.redirect(new URL(ruta, request.url), 303);
  if (!entradaSinCorreo()) return a("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Ya hay sesión (con correo o borrador a medias): "/" sabe a dónde mandarla.
  if (user) return a("/");

  const ip = ipDe(request.headers);
  const { porIp } = await intentosUltimaHora(MARCA_BORRADOR, ip);
  if (porIp >= TOPE_BORRADORES_POR_IP_HORA) return a("/login");

  const { error } = await supabase.auth.signInAnonymously();
  // Si Supabase no deja (apagado, límite propio, caída), el camino de siempre
  // sigue ahí: nadie se queda sin entrar por esto.
  if (error) return a("/login");
  await anotarIntento(MARCA_BORRADOR, ip);
  return a("/onboarding/genero");
}

// Quien teclea la dirección o llega por un link viejo.
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/", request.url), 303);
}
