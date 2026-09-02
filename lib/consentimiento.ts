import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail, type SendResult } from "@/lib/email";
import { fotosBloqueadas, type AgeRange } from "@/lib/edad";

// Token del link de permiso: UUID estricto. La columna es tipo uuid — un string
// de 36 chars que NO sea UUID revienta el cast de Postgres con un 500 crudo en
// el endpoint público, así que validamos la forma exacta antes de tocar la DB.
export const isConsentToken = (t: string | null): t is string =>
  !!t && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);

// Enforcement server-side del bloqueo de fotos de menores: lo llaman los
// endpoints que RECIBEN o RENDEREAN fotos (analizar-prenda/s, avatar,
// estilo-referencia, render-prenda).
// true = bloqueado (menor 13-17 sin permiso parental confirmado).
// Fail-CLOSED ante error de DB: para un gate de consentimiento, un error
// transitorio no debe desactivar el bloqueo. Solo "fila no encontrada"
// (PGRST116, perfil inexistente) pasa como no-bloqueado.
export async function photosBlockedForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("age_range, minor_consent_verified_at")
    .eq("id", userId)
    .single();
  if (error && error.code !== "PGRST116") return true; // query falló → bloquea
  if (!data) return false; // sin perfil no hay señal de menor — no bloquees
  return fotosBloqueadas({
    age_range: (data.age_range as AgeRange | null) ?? null,
    minor_consent_verified_at: (data.minor_consent_verified_at as string | null) ?? null,
  });
}

// Mensaje del bloqueo. Los clientes lo reciben en `message` (con `error` como
// código estable "permiso_pendiente") y lo muestran cuando detectan el 403.
export const PERMISO_PENDIENTE_MSG =
  "Falta el permiso de tus papás o tutores para subir fotos — pídeles que confirmen el correo que les mandamos (puedes reenviarlo desde tu Perfil).";

// Gate único de las 5 rutas de fotos: null = pasa; NextResponse = 403 listo
// para devolver. Un endpoint de fotos futuro solo llama esto.
export async function photosGate(
  supabase: SupabaseClient,
  userId: string
): Promise<NextResponse | null> {
  if (await photosBlockedForUser(supabase, userId)) {
    return NextResponse.json(
      { error: "permiso_pendiente", message: PERMISO_PENDIENTE_MSG },
      { status: 403 }
    );
  }
  return null;
}

// Correo al padre/madre/tutor de un menor (13-17) con el link de permiso.
// Best-effort: si Postmark falla, el flujo NO se bloquea — el link se puede
// compartir/reenviar desde Perfil.
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://stailist.co";

export const permisoUrl = (token: string) => `${SITE}/api/permiso?token=${token}`;

export async function sendParentConsentEmail(
  to: string,
  token: string
): Promise<SendResult> {
  const url = permisoUrl(token);
  const sans =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif";
  const serif = "Georgia,'Times New Roman',serif";
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f4f3f1;font-family:${sans};color:#141414;">
<div style="max-width:480px;margin:0 auto;padding:40px 24px;">
  <div style="font-size:24px;font-weight:700;letter-spacing:-0.045em;">st<span style="font-family:${serif};font-style:italic;font-weight:400;letter-spacing:0;">ai</span>list</div>
  <p style="margin:28px 0 0;font-size:17px;line-height:1.55;">Hola 👋</p>
  <p style="margin:14px 0 0;font-size:17px;line-height:1.55;">Tu hija o hijo quiere usar <b>stailist</b>, una app que arma outfits con la ropa que ya tiene. Como es menor de edad, necesitamos tu permiso antes de que pueda subir fotos.</p>
  <p style="margin:14px 0 0;font-size:15px;line-height:1.55;color:#363636;"><b>Qué datos usaría la app:</b> fotos suyas (cara y cuerpo, para su avatar), fotos de su ropa, y sus gustos de estilo. Todo se guarda en privado, no se comparte con nadie, y tú o él/ella pueden pedirnos borrarlo cuando quieran escribiendo a hola@stailist.co.</p>
  <p style="margin:24px 0 0;"><a href="${url}" style="display:inline-block;background:#141414;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 26px;">Revisar y dar permiso</a></p>
  <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#6b6b6b;">Si no reconoces esta solicitud, ignora este correo y no pasa nada — sin tu permiso no podrá subir fotos.</p>
</div></body></html>`;
  const text = `Tu hija o hijo quiere usar stailist, una app que arma outfits con la ropa que ya tiene. Como es menor de edad, necesitamos tu permiso antes de que pueda subir fotos (de su cara, cuerpo y ropa; todo privado, se puede borrar cuando quieran: hola@stailist.co).\n\nRevisar y dar permiso: ${url}\n\nSi no reconoces esta solicitud, ignora este correo — sin tu permiso no podrá subir fotos.`;

  return sendEmail({
    to,
    subject: "Permiso para que tu hija/o use stailist",
    html,
    text,
  });
}
