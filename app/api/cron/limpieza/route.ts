import { NextResponse, type NextRequest } from "next/server";
import { withDb } from "@/lib/db";
import { clienteDeServicio } from "@/lib/supabase/servicio";
import { borrarArchivos, borrarFilasYAuth, listarCarpeta, rutasDeLaPersona } from "@/lib/borrar-cuenta";
import { borrarCuentasVencidas } from "@/lib/borrar-cuentas-vencidas";

// LIMPIEZA DIARIA (ver vercel.json). Tres cosas:
//
// 1. CUENTAS QUE NUNCA ENTRARON. Con el registro abierto, pedir un código crea
//    el usuario de auth y su perfil ANTES de que la persona teclee nada
//    (shouldCreateUser: true). Quien escribió mal su correo, quien se
//    arrepintió, y quien fue víctima de alguien tecleando correos ajenos dejan
//    una fila en auth.users y otra en profiles con onboarding_step = 0 para
//    siempre. Regla: siete días en paso 0, sin género, sin prendas y sin looks.
//    Borrar el usuario de auth arrastra el perfil por FK. Lo que se borra no era
//    de nadie: una cuenta que nunca se usó no tiene nada que perder.
//
// 2. INTENTOS DE LOGIN de más de un día: sólo se consulta la última hora y
//    guardar correos ajenos más tiempo del necesario es exactamente lo que el
//    aviso de privacidad dice que no hacemos.
//
// 3. CUENTAS CUYO BORRADO PROGRAMADO VENCIÓ (lib/borrado-programado.ts). La
//    dueña ya no tiene sesión, así que las fotos se borran con la llave de
//    servicio (lib/supabase/servicio.ts; este es el ÚNICO archivo que la usa).
//    Sin la llave, este paso no corre: falla cerrado, nada se borra a medias.
export const maxDuration = 60;

const BUCKETS = ["prendas", "referencias"] as const;

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
          and p.borrado_programado_para is null
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

  const servicio = clienteDeServicio();
  let programadas: { borradas: number; fallidas: number } | { omitido: string };
  if (!servicio) {
    console.error("[limpieza] falta la llave de servicio en Vercel: no se borran cuentas programadas (fallo cerrado)");
    programadas = { omitido: "sin_llave_de_servicio" };
  } else {
    const resultado = await borrarCuentasVencidas({
      vencidas: () =>
        withDb(async (c) =>
          (
            await c.query<{ id: string }>(
              `select id from public.profiles
                where borrado_programado_para is not null and borrado_programado_para <= now()
                -- Al azar y no por fecha: si las 25 más viejas fallaran todos
                -- los días, taparían para siempre a las que vienen detrás.
                order by random()
                limit 25`
            )
          ).rows.map((x) => x.id)
        ),
      borrarArchivosDe: async (uid) => {
        await borrarArchivos(servicio, uid, await rutasDeLaPersona(uid));
        // VERIFICAR, no confiar: borrarArchivos es best-effort. La lista
        // estricta lanza ante cualquier error de Storage en cualquier
        // subcarpeta o página: "no pude mirar" nunca pasa por "no queda nada".
        for (const bucket of BUCKETS) {
          const quedan = await listarCarpeta(servicio.storage.from(bucket), uid, { estricto: true });
          if (quedan.length > 0) throw new Error(`quedan ${quedan.length} archivo(s) en ${bucket}`);
        }
      },
      borrarFilasDe: borrarFilasYAuth,
    });
    for (const f of resultado.fallidas) {
      console.error(`[limpieza] no se pudo borrar la cuenta programada ${f.uid} (${f.paso}): ${f.error}`);
    }
    if (resultado.borradas.length > 0) {
      console.log(`[limpieza] ${resultado.borradas.length} cuenta(s) con borrado programado vencido, borradas`);
    }
    programadas = { borradas: resultado.borradas.length, fallidas: resultado.fallidas.length };
  }

  return NextResponse.json({ ok: true, ...r, programadas });
}
