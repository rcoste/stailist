import { NextResponse, type NextRequest } from "next/server";
import { withDb } from "@/lib/db";

// Baja de un clic desde el link del correo — SIN login. El token es el secreto
// (único por usuario); con él ponemos email_semanal='off'. Página de confirmación
// mínima en HTML (el usuario llega aquí desde su cliente de correo, no la app).
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const page = (msg: string) =>
    new NextResponse(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>stailist</title></head><body style="margin:0;background:#f4f3f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1a1a1a;"><div style="max-width:420px;margin:80px auto;padding:0 24px;text-align:center;"><div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#8a857e;font-weight:700;">stailist</div><p style="margin-top:20px;font-size:17px;line-height:1.5;">${msg}</p><a href="https://stailist.co/hoy" style="display:inline-block;margin-top:24px;color:#1a1a1a;">Ir a la app →</a></div></body></html>`,
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
  return page("Listo, ya no te mandaremos el correo semanal. Puedes volver a activarlo desde la app cuando quieras.");
}
