import { NextResponse, type NextRequest } from "next/server";
import { withDb } from "@/lib/db";

// Baja de un clic desde el link del correo — SIN login. El token es el secreto
// (único por usuario); con él ponemos email_semanal='off'. Página de confirmación
// mínima en HTML (el usuario llega aquí desde su cliente de correo, no la app).
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  // Estilo alineado a la landing v3: papel hueso, tinta negra, wordmark con el
  // "ai" en serif itálica (Georgia, web-safe). Sin fuentes propias — es una
  // página que se abre desde el cliente de correo.
  const sans =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif";
  const serif = "Georgia,'Times New Roman',serif";
  const page = (msg: string) =>
    new NextResponse(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>stailist</title></head><body style="margin:0;background:#f4f3f1;font-family:${sans};color:#141414;"><div style="max-width:440px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;text-align:center;"><div style="font-size:26px;font-weight:700;letter-spacing:-0.045em;line-height:1;">st<span style="font-family:${serif};font-style:italic;font-weight:400;letter-spacing:0;">ai</span>list</div><p style="margin:26px 0 0;font-size:18px;line-height:1.5;color:#363636;max-width:34ch;">${msg}</p><a href="https://stailist.co/hoy" style="display:inline-block;margin-top:26px;font-size:14px;font-weight:700;letter-spacing:-0.01em;color:#141414;text-decoration:none;border-bottom:1.5px solid #141414;padding-bottom:1px;">Ir a la app &rarr;</a></div></body></html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );

  if (!token) return page("Link inválido.");

  // Validación de forma (UUID) antes de tocar la DB — el token viene de un query
  // param arbitrario. La query es parametrizada (sin riesgo de inyección) pero un
  // UUID mal formado la haría fallar; lo cortamos antes.
  if (!/^[0-9a-f-]{36}$/i.test(token)) return page("Link inválido.");

  const rows = await withDb((c) =>
    c
      .query(`update profiles set email_semanal = 'off' where email_unsub_token = $1 returning id`, [token])
      .then((r) => r.rowCount ?? 0)
  );

  if (rows === 0) {
    return page("No encontramos tu suscripción. Puede que ya te hayas dado de baja.");
  }
  // Dice "correos" en plural desde que existe el reenganche de 48h: una sola
  // preferencia (`email_semanal`) apaga los dos, y prometer solo el semanal
  // dejaría a alguien creyendo que apagó menos de lo que apagó.
  return page("Listo, ya no te mandaremos correos. Puedes volver a activarlos desde la app cuando quieras.");
}
