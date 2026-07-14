import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VIEW_AS_COOKIE } from "@/lib/auth";

// Entra al modo "ver como": pone la cookie y te manda a /hoy viendo la app
// con los datos del usuario objetivo. Solo admins; solo lectura (el proxy
// bloquea todo POST mientras la cookie exista). Expira sola a las 2 horas
// por si se te olvida salir.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) return NextResponse.redirect(new URL("/", request.url));

  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", id)
    .single();
  if (!target) {
    return NextResponse.redirect(new URL("/admin/usuarios", request.url));
  }

  const res = NextResponse.redirect(new URL("/hoy", request.url));
  res.cookies.set(VIEW_AS_COOKIE, target.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 2,
  });
  return res;
}
