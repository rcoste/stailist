import { NextResponse, type NextRequest } from "next/server";
import { withDb } from "@/lib/db";

// LIMPIEZA DE CUENTAS QUE NUNCA ENTRARON. Corre a diario (ver vercel.json).
//
// Con el registro abierto, pedir un código crea el usuario de auth y su perfil
// ANTES de que la persona teclee nada (shouldCreateUser: true). Quien escribió
// mal su correo, quien se arrepintió, y quien fue víctima de alguien tecleando
// correos ajenos dejan una fila en auth.users y otra en profiles con
// onboarding_step = 0 para siempre. Ya pasaba en la beta: los "perfiles sin
// género que nunca entraron" del brief de la auditoría eran esto.
//
// Regla: siete días en paso 0, sin género, sin prendas y sin looks. Borrar el
// usuario de auth arrastra el perfil por FK. Lo que se borra no era de nadie:
// una cuenta que nunca se usó no tiene nada que perder.
//
// También se tira el registro de intentos de login con más de un día: sólo se
// consulta la última hora y guardar correos ajenos más tiempo del necesario es
// exactamente lo que el aviso de privacidad dice que no hacemos.
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }

  const r = await withDb(async (c) => {
    const cuentas = await c.query<{ id: string }>(
      `delete from auth.users u
        using public.profiles p
        where p.id = u.id
          and p.onboarding_step = 0
          and p.gender is null
          and p.created_at < now() - interval '7 days'
          and not exists (select 1 from public.items i where i.user_id = p.id)
          and not exists (select 1 from public.outfits o where o.user_id = p.id)
        returning u.id`
    );
    const intentos = await c.query(
      `delete from public.login_intentos where created_at < now() - interval '1 day'`
    );
    return { cuentas: cuentas.rowCount ?? 0, intentos: intentos.rowCount ?? 0 };
  });

  if (r.cuentas > 0) console.log(`[limpieza] ${r.cuentas} cuenta(s) que nunca entraron, borradas`);
  return NextResponse.json({ ok: true, ...r });
}
