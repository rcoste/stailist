import { NextResponse, type NextRequest } from "next/server";
import { withDb } from "@/lib/db";
import { isConsentToken } from "@/lib/consentimiento";

// Permiso parental para menores (13-17) — SIN login: el tutor llega desde el
// link del correo. GET muestra qué es Stailist y qué datos usa (informar antes
// de consentir); POST confirma. La confirmación va por POST a propósito: los
// escáneres de links de los clientes de correo siguen GETs y darían el permiso
// solos.
const sans =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif";
const serif = "Georgia,'Times New Roman',serif";

const shell = (inner: string) =>
  new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>stailist</title></head><body style="margin:0;background:#f4f3f1;font-family:${sans};color:#141414;"><div style="max-width:480px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:32px 24px;box-sizing:border-box;"><div style="font-size:26px;font-weight:700;letter-spacing:-0.045em;line-height:1;">st<span style="font-family:${serif};font-style:italic;font-weight:400;letter-spacing:0;">ai</span>list</div>${inner}</div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );

const invalid = () =>
  shell(
    `<p style="margin:26px 0 0;font-size:18px;line-height:1.5;color:#363636;">Este link no es válido o ya no está activo. Pídele a tu hija/o que te lo reenvíe desde su perfil de Stailist.</p>`
  );

// UUID estricto (lib/consentimiento): un 36-chars no-UUID reventaría el cast
// de la columna uuid con un 500 crudo; con esto cae en la página de inválido.
const okToken = isConsentToken;

// Rate limit ingenuo por instancia (serverless: vive por lambda caliente).
// withDb abre una conexión Postgres directa por request y este endpoint es
// público — sin esto, un loop de curl agota el pool de conexiones. No es
// perfecto entre instancias; el WAF de Vercel es el siguiente nivel (TODO).
const hits = new Map<string, { n: number; t: number }>();
function rateLimited(req: NextRequest): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) {
    if (hits.size > 500) hits.clear(); // tope de memoria
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  h.n += 1;
  return h.n > 10;
}

const tooMany = () =>
  shell(
    `<p style="margin:26px 0 0;font-size:18px;line-height:1.5;color:#363636;">Demasiados intentos seguidos — espera un minuto y vuelve a abrir el link.</p>`
  );

export async function GET(request: NextRequest) {
  if (rateLimited(request)) return tooMany();
  const token = request.nextUrl.searchParams.get("token");
  if (!okToken(token)) return invalid();

  const row = await withDb((c) =>
    c
      .query(
        `select minor_consent_verified_at from profiles where minor_consent_token = $1`,
        [token]
      )
      .then((r) => r.rows[0] as { minor_consent_verified_at: string | null } | undefined)
  );
  if (!row) return invalid();

  if (row.minor_consent_verified_at) {
    return shell(
      `<p style="margin:26px 0 0;font-size:18px;line-height:1.5;color:#363636;">Este permiso ya está confirmado — no tienes que hacer nada más. Gracias.</p>`
    );
  }

  return shell(`
<h1 style="margin:26px 0 0;font-size:24px;line-height:1.2;letter-spacing:-0.02em;">Tu hija o hijo quiere usar Stailist</h1>
<p style="margin:16px 0 0;font-size:16px;line-height:1.55;color:#363636;">Stailist es una app que arma outfits con la ropa que ya tiene, con ayuda de inteligencia artificial. Como es menor de edad, te pedimos permiso antes de que pueda subir fotos.</p>
<p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#363636;"><b>Si das tu permiso, la app podrá guardar:</b></p>
<ul style="margin:8px 0 0;padding-left:20px;font-size:15px;line-height:1.6;color:#363636;">
  <li>Fotos suyas (cara y cuerpo) para crear su avatar.</li>
  <li>Fotos de su ropa, para armarle outfits con lo que tiene.</li>
  <li>Sus gustos de estilo y colores.</li>
</ul>
<p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#363636;">Todo se guarda en privado y no se comparte con nadie. Puedes retirar el permiso y pedir que borremos sus datos cuando quieras, escribiendo a <a href="mailto:hola@stailist.co" style="color:#141414;">hola@stailist.co</a>.</p>
<form method="post" action="/api/permiso?token=${token}" style="margin:28px 0 0;">
  <button type="submit" style="display:inline-block;background:#141414;color:#fff;font-size:15px;font-weight:700;border:0;padding:16px 28px;cursor:pointer;font-family:inherit;">Doy mi permiso</button>
</form>
<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6b6b6b;">Si no reconoces esta solicitud, cierra esta página y no pasa nada.</p>`);
}

export async function POST(request: NextRequest) {
  if (rateLimited(request)) return tooMany();
  const token = request.nextUrl.searchParams.get("token");
  if (!okToken(token)) return invalid();

  const rows = await withDb((c) =>
    c
      .query(
        `update profiles set minor_consent_verified_at = now()
         where minor_consent_token = $1 and minor_consent_verified_at is null
         returning id`,
        [token]
      )
      .then((r) => r.rowCount ?? 0)
  );

  if (rows === 0) {
    // Token inexistente o ya confirmado — reusa el GET para mostrar el estado real.
    return GET(request);
  }

  return shell(
    `<p style="margin:26px 0 0;font-size:18px;line-height:1.5;color:#363636;">Listo, permiso confirmado. Tu hija/o ya puede usar Stailist completa — gracias por tomarte el minuto.</p>`
  );
}
