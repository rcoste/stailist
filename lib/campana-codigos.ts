import { withDb } from "@/lib/db";
import { parseOrigen } from "@/lib/origen";
import { campanaDe, diaEnZona, fuenteDe } from "@/lib/admin/adquisicion";

// CUÁNTA GENTE PIDIÓ SU CÓDIGO, POR CAMPAÑA (migración 0163).
//
// La punta del embudo que /admin/adquisicion no ve: pidió el código pero nunca
// entró. Se escribe desde la acción del login, ANTES de anotar el intento en
// login_intentos, porque ése es el que dice si ya lo había pedido hoy.
//
// Sólo contadores: ni correo ni IP salen de aquí. `login_intentos` se borra
// cada noche; esto se queda. Best-effort: nunca lanza, porque perder un conteo
// no puede costarle a nadie su código.

/** Las cuentas de desarrollo no cuentan, igual que en el resto del panel. */
export function cuentaParaCampana(correo: string): boolean {
  return !correo.toLowerCase().endsWith("@stailist.app");
}

export async function contarPeticionDeCodigo(
  correo: string,
  cookieOrigen: string | undefined,
  ahora: Date = new Date()
): Promise<void> {
  if (!cuentaParaCampana(correo)) return;
  const o = parseOrigen(cookieOrigen);
  const fuente = fuenteDe(o);
  const campana = campanaDe(o);
  try {
    await withDb((c) =>
      c.query(
        `with previo as (
           select exists (
             select 1 from public.login_intentos
             where correo = $1 and created_at > now() - interval '1 day'
           ) as hay
         ),
         cuenta as (
           select exists (
             select 1 from auth.users
             where lower(email) = $1 and last_sign_in_at is not null
           ) as hay
         )
         insert into public.campana_codigos (dia, fuente, campana, nuevos, recurrentes)
         select $2::date, $3, $4,
                case when cuenta.hay then 0 else 1 end,
                case when cuenta.hay then 1 else 0 end
         from previo, cuenta
         where not previo.hay
         on conflict (dia, fuente, campana) do update set
           nuevos = public.campana_codigos.nuevos + excluded.nuevos,
           recurrentes = public.campana_codigos.recurrentes + excluded.recurrentes`,
        [correo.toLowerCase(), diaEnZona(ahora), fuente, campana]
      )
    );
  } catch (e) {
    console.error(`[campana] no se contó la petición de código: ${e instanceof Error ? e.message : String(e)}`);
  }
}
