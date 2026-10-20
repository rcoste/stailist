"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { registrarEvento } from "@/lib/telemetria";
import { VIEW_AS_COOKIE } from "@/lib/auth";

// LOS DOS EVENTOS DE LA VITRINA DE UNIQLO (2026-10-20). Son la lectura entera de
// la prueba (docs/designs/vitrina-de-tienda.md): si se vio la franja y si se
// tocó la tienda. Lo que viaja en `data` es lo que la consulta de lectura cruza;
// cambiarlo rompe la lectura sin que nada truene. Nunca fallan hacia la
// pantalla: la franja ya se pintó, un renglón perdido no puede costarle nada.

export type DesdeVitrina = "maleta" | "esenciales" | "wishlist";

const limpia = (s: string, max = 160) => s.slice(0, max);

/** La cuenta que firma el evento, o null si no hay sesión o el admin está
 *  mirando a otra persona (eso no es una vista ni un clic de nadie). */
async function quien(): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; userId: string } | null> {
  if ((await cookies()).get(VIEW_AS_COOKIE)) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}

export async function registrarVitrinaVista(
  clave: string,
  entradas: string[],
  tienda: string,
  desde: DesdeVitrina
): Promise<void> {
  if (!clave || entradas.length === 0) return;
  const q = await quien();
  if (!q) return;
  await registrarEvento(q.supabase, {
    user_id: q.userId,
    type: "vitrina_vista",
    data: { clave: limpia(clave), entradas: entradas.slice(0, 4).map((e) => limpia(e)), tienda: limpia(tienda, 40), desde },
  });
}

export async function registrarTiendaClick(
  clave: string,
  entrada: string,
  tienda: string,
  desde: DesdeVitrina
): Promise<void> {
  if (!clave || !entrada) return;
  const q = await quien();
  if (!q) return;
  await registrarEvento(q.supabase, {
    user_id: q.userId,
    type: "tienda_click",
    data: { clave: limpia(clave), entrada: limpia(entrada), tienda: limpia(tienda, 40), desde },
  });
}
