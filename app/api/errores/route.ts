import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { VIEW_AS_COOKIE } from "@/lib/auth";
import { registrarError } from "@/lib/errores";

// EL NAVEGADOR AVISA QUE ALGO LE SALIÓ MAL (2026-10-14). Lo llama
// lib/avisar-error.ts. Es la única forma de saber de un corte por tiempo: el
// servidor muere antes de poder escribir nada, y la persona sólo ve el error.
//
// Sin sesión no se anota (la tabla no acepta errores anónimos: sería una
// puerta abierta para llenarla). Tope de 30 por persona por hora: un bucle
// que reintenta no puede inundar la tabla.
const CLAVE = /^[\w\-:/.[\]]{1,120}$/;
const TOPE_POR_HORA = 30;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });
  // El admin mirando la cuenta de otra persona: sus errores no son de ella.
  if ((await cookies()).get(VIEW_AS_COOKIE)) return new NextResponse(null, { status: 204 });

  let body: { clave?: unknown; pantalla?: unknown; mensaje?: unknown; tecnico?: unknown; version?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const clave = texto(body.clave);
  if (!clave || !CLAVE.test(clave)) return new NextResponse(null, { status: 400 });

  const haceUnaHora = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await supabase
    .from("errores")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", haceUnaHora);
  if ((count ?? 0) >= TOPE_POR_HORA) return new NextResponse(null, { status: 204 });

  await registrarError(supabase, {
    userId: user.id,
    origen: "navegador",
    clave,
    pantalla: texto(body.pantalla),
    mensaje: texto(body.mensaje),
    tecnico: texto(body.tecnico),
    version: texto(body.version),
  });
  return new NextResponse(null, { status: 204 });
}
