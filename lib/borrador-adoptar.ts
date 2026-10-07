import { withDb } from "@/lib/db";

// EL BORRADOR SE VUELVE CUENTA (ver lib/borrador.ts).
//
// POR QUÉ NO "PONERLE CORREO AL BORRADOR". Era el camino obvio
// (`updateUser({ email })` sobre la sesión anónima), y se probó: Supabase manda
// entonces un correo de fábrica, en inglés y con un link ("Confirm your new
// email address"), que NO es la plantilla "Change email address" del panel —
// Roberto la pegó y guardó, y el correo siguió saliendo igual—. La pantalla sólo
// sabe recibir un código de 6 dígitos.
//
// LO QUE SE HACE: el correo se verifica con el login de siempre
// (`signInWithOtp` + `verifyOtp`), que usa las dos plantillas ya probadas y crea
// —o encuentra— la cuenta de ese correo. Y aquí, del lado del servidor, se le
// pasa a esa cuenta todo lo que el borrador contestó. De regalo: si el correo
// ya tenía cuenta, la persona entra a SU cuenta en vez de chocar con un error.
//
// Va por Postgres directo y no con la sesión de la persona: son dos cuentas
// distintas y la RLS —con razón— no deja a una leer a la otra. Lo que lo hace
// seguro es de dónde salen los dos ids: quien llama los toma de sesiones ya
// validadas en ESE request (el borrador antes de verificar, la cuenta después),
// nunca del formulario. Y aquí se vuelve a exigir que el origen sea anónimo.

/** Lo que el onboarding escribe en el perfil antes del correo. Lo demás (correo,
 *  admin, suscripciones, avatar, cápsula…) es de la cuenta y no se pisa. */
const COLUMNAS = [
  "gender",
  "age_range",
  "minor_ack_at",
  "minor_parent_email",
  "minor_consent_token",
  "minor_consent_verified_at",
  "minor_consent_last_sent_at",
  "como_nos_conocio",
  "taste_tags",
  "style_archetype",
  "style_questions",
  "style_words",
  "palette_season",
  "palette_quiz",
  "palette_flow",
  "fit_pref",
  "acento_apetito",
  "acento_apetito_fuente",
  "last_objective",
  "lifestyle",
  "onboarding_step",
  "onboarding_started_at",
] as const;

export type Adopcion =
  /** Cuenta nueva: recibió el borrador entero. Sigue al primer look. */
  | "adoptado"
  /** Ese correo ya era de una cuenta con su propio avance: se entra a ella y el borrador se tira. */
  | "existente"
  /** No había borrador que pasar (o no era anónimo): no se tocó nada. */
  | "nada";

export async function adoptarBorrador(borradorId: string, cuentaId: string): Promise<Adopcion> {
  if (!borradorId || !cuentaId || borradorId === cuentaId) return "nada";
  return withDb(async (c) => {
    await c.query("begin");
    try {
      const origen = await c.query<{ is_anonymous: boolean }>(
        `select is_anonymous from auth.users where id = $1 for update`,
        [borradorId]
      );
      if (!origen.rows[0]?.is_anonymous) {
        await c.query("rollback");
        return "nada" as const;
      }
      const destino = await c.query<{ con_avance: boolean }>(
        `select (p.gender is not null
                 or exists (select 1 from public.items i where i.user_id = p.id)
                 or exists (select 1 from public.outfits o where o.user_id = p.id)) as con_avance
           from public.profiles p where p.id = $1 for update`,
        [cuentaId]
      );
      if (!destino.rows[0]) {
        await c.query("rollback");
        return "nada" as const;
      }

      if (destino.rows[0].con_avance) {
        // Ya era usuaria: su cuenta manda. El borrador se borra (perfil, básicos
        // marcados y eventos se van en cascada).
        await c.query(`delete from auth.users where id = $1 and is_anonymous`, [borradorId]);
        await c.query("commit");
        return "existente" as const;
      }

      // Lo que vive en otras tablas se cambia de dueña ANTES de borrar el
      // borrador (items y events cuelgan del perfil con borrado en cascada).
      for (const tabla of ["items", "events", "ai_calls"]) {
        await c.query(`update public.${tabla} set user_id = $2 where user_id = $1`, [borradorId, cuentaId]);
      }
      await c.query(
        `update public.profiles d
            set ${COLUMNAS.map((col) => `${col} = b.${col}`).join(", ")},
                -- De dónde llegó: gana lo que ya traía el borrador (ahí se
                -- guardó el anuncio); si no, lo que tuviera la cuenta.
                origen = coalesce(b.origen, d.origen),
                -- Desde dónde y con qué arrancó (migración 0171): se escribe
                -- al arrancar, o sea en el BORRADOR. Sin estas tres líneas se
                -- perdían justo en el camino por el que entra casi todo el
                -- mundo (cazado el 2026-10-06 con la primera cuenta así).
                dispositivo = coalesce(b.dispositivo, d.dispositivo),
                pais = coalesce(b.pais, d.pais),
                region = coalesce(b.region, d.region),
                updated_at = now()
           from public.profiles b
          where b.id = $1 and d.id = $2`,
        [borradorId, cuentaId]
      );
      await c.query(`delete from auth.users where id = $1 and is_anonymous`, [borradorId]);
      await c.query("commit");
      return "adoptado" as const;
    } catch (e) {
      await c.query("rollback").catch(() => null);
      throw e;
    }
  });
}
