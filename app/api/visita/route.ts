import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { registrarVisita } from "@/lib/visitas";
import { VIEW_AS_COOKIE } from "@/lib/auth";

// LA VISITA DE QUIEN VUELVE A UNA PESTAÑA ABIERTA (2026-10-10).
//
// La visita se anotaba sólo en getProfile (lib/auth.ts), o sea, cuando el
// servidor pinta una pantalla. Pero en el celular, volver a una pestaña que se
// dejó abierta NO recarga nada: el navegador enseña la página que ya tenía y
// sólo renueva la sesión por debajo. Así se perdieron 3 regresos reales en la
// primera semana de octubre (ultima_visita quieta en su primer día y la sesión
// renovada 1 a 3 días después): Roberto lo notó como "no estás contando bien
// lo de los usuarios que vuelven".
//
// Esto lo llama components/visita-al-volver.tsx cuando la pestaña vuelve a la
// vista en otro día. El candado de una visita al día sigue siendo el de
// registrarVisita, así que llamarlo de más no duplica nada.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse(null, { status: 204 });
  // El admin mirando la cuenta de otra persona no es una visita de nadie.
  if ((await cookies()).get(VIEW_AS_COOKIE)) return new NextResponse(null, { status: 204 });

  const { data: perfil } = await supabase
    .from("profiles")
    .select("id, ultima_visita")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil) return new NextResponse(null, { status: 204 });

  const registrada = await registrarVisita(supabase, perfil);
  return NextResponse.json({ registrada });
}
