import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { isMinor, type AgeRange } from "@/lib/edad";

// EL ÚNICO SQL QUE ESCRIBE LA EDAD.
//
// Lo comparten el onboarding (primera vez) y Perfil (corregirla). Las columnas
// de edad y consentimiento están blindadas por trigger contra escrituras del
// cliente (migración 0082), así que las dos puertas pasan por Postgres directo
// (`withDb`) y este archivo es donde vive la regla para que no deriven.
//
// La regla del menor va en el SQL, no en quien llama: si el rango que entra es
// 13-17, el consentimiento previo se INVALIDA (verified_at = null) y se genera
// token nuevo. Es lo que hace imposible el bypass "me pongo 13, subo fotos con
// permiso, me cambio a 30, me cambio de vuelta a 13 sin permiso".

export type ResultadoEdad = {
  onboarding_step: number;
  /** El token del link de permiso, sólo cuando el rango es de menor. */
  token: string | null;
};

export async function guardarEdad(
  c: Client,
  args: {
    uid: string;
    range: AgeRange;
    /** Obligatorio si es menor. */
    parentEmail: string | null;
    /** true = onboarding (sólo escribe si aún no hay edad). false = Perfil. */
    soloSiVacia: boolean;
  }
): Promise<ResultadoEdad | null> {
  const menor = isMinor(args.range);
  if (menor && !args.parentEmail) return null;
  const token = menor ? randomUUID() : null;
  const r = await c.query<{ onboarding_step: number }>(
    `update profiles set
       age_range = $2,
       minor_ack_at = case when $3::boolean then now() else null end,
       minor_parent_email = $4,
       minor_consent_token = $5::uuid,
       minor_consent_verified_at = null,
       minor_consent_last_sent_at = case when $3::boolean then now() else null end,
       updated_at = now()
     where id = $1 ${args.soloSiVacia ? "and age_range is null" : ""}
     returning onboarding_step`,
    [args.uid, args.range, menor, menor ? args.parentEmail : null, token]
  );
  const row = r.rows[0];
  return row ? { onboarding_step: row.onboarding_step, token } : null;
}
