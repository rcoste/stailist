import { NextResponse, type NextRequest } from "next/server";
import { withDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { correoPrendasPendientes, leTocaAviso } from "@/lib/prendas-pendientes-correo";

// AVISA A QUIEN DEJÓ PRENDAS SIN PULIR POR EL TOPE DEL DÍA que ya se puede
// seguir (lib/prendas-pendientes-correo.ts). Corre cada hora (vercel.json) y
// casi siempre no hace nada: sólo escribe cuando la persona ya tiene cupo y es
// de día en México. `?ensayo=1` dice a quién le tocaría sin mandar nada.
// Protegido por CRON_SECRET, como los demás crons.
export const maxDuration = 60;

type Fila = {
  id: string;
  email: string;
  email_unsub_token: string;
  email_pendientes_sent_at: string | null;
  pendientes: string;
  ultima_pendiente: string | null;
  renders_24h: string;
};

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no_autorizado" }, { status: 401 });
  }
  const ensayo = request.nextUrl.searchParams.get("ensayo") === "1";
  const ahora = new Date();

  return await withDb(async (c) => {
    // Mismas guardas que el reenganche: sólo quien no se dio de baja, con
    // correo, y sin borrado programado. La definición de "pendiente" es la de
    // esRenderPendiente (lib/renders-pendientes.ts).
    const { rows } = await c.query<Fila>(
      `select p.id, p.email, p.email_unsub_token, p.email_pendientes_sent_at,
              t.pendientes, t.ultima_pendiente,
              (select count(*) from ai_calls a
                where a.user_id = p.id and a.tarea = 'render-prenda'
                  and a.created_at >= now() - interval '24 hours') as renders_24h
         from profiles p
         join (select i.user_id, count(*) as pendientes, max(i.created_at) as ultima_pendiente
                 from items i
                where i.deleted_at is null
                  and (i.photo_path is not null or i.attrs->>'origen_foto' is not null)
                  and i.render_path is null
                  and i.attrs->>'render_pendiente' = 'true'
                group by 1) t on t.user_id = p.id
        where p.email is not null
          and p.email_semanal = 'semanal'
          and p.borrado_programado_para is null`
    );

    const enviados: string[] = [];
    const saltados: { id: string; motivo: string }[] = [];
    for (const f of rows) {
      const v = leTocaAviso(
        {
          pendientes: Number(f.pendientes),
          ultimaPendiente: f.ultima_pendiente ? new Date(f.ultima_pendiente).toISOString() : null,
          renders24h: Number(f.renders_24h),
          avisoEnviado: f.email_pendientes_sent_at ? new Date(f.email_pendientes_sent_at).toISOString() : null,
        },
        ahora
      );
      if (!v.toca) {
        saltados.push({ id: f.id, motivo: v.motivo });
        continue;
      }
      if (ensayo) {
        enviados.push(f.id);
        continue;
      }
      const correo = correoPrendasPendientes({ unsubToken: f.email_unsub_token, pendientes: Number(f.pendientes) });
      const r = await sendEmail({ to: f.email, ...correo });
      if (r.ok) {
        // Se marca sólo si salió: un fallo de envío se reintenta a la hora.
        await c.query(`update profiles set email_pendientes_sent_at = now() where id = $1`, [f.id]);
        enviados.push(f.id);
      } else {
        saltados.push({ id: f.id, motivo: "envío falló" });
      }
    }
    return NextResponse.json({ ok: true, ensayo, enviados: enviados.length, saltados });
  });
}
