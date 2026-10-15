import { withDb } from "@/lib/db";
import type { EstadoGuardado, Ocurrencia } from "@/lib/admin/errores";

// LAS TRES FUENTES DE /admin/errores, en una ida a la base. Sin RLS: sólo lo
// llaman páginas que ya exigieron admin.
//   · public.errores: lo que avisó el navegador y los frenos (migración 0174).
//   · events: generation_failed y avatar_fallo, que ya se escribían.
//   · ai_calls con ok=false: llamadas a la IA que tronaron por dentro.
const iso = (v: unknown): string => new Date(v as string).toISOString();

export async function cargarErrores(dias: number): Promise<{
  ocurrencias: Ocurrencia[];
  estados: EstadoGuardado[];
  correos: Map<string, string>;
}> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  return withDb(async (c) => {
    const propios = (
      await c.query(
        `select created_at, user_id, clave, pantalla, mensaje, tecnico from public.errores where created_at >= $1`,
        [desde]
      )
    ).rows.map(
      (r): Ocurrencia => ({
        at: iso(r.created_at),
        userId: r.user_id,
        clave: r.clave,
        pantalla: r.pantalla,
        mensaje: r.mensaje,
        tecnico: r.tecnico,
        fuente: "errores",
      })
    );
    const eventos = (
      await c.query(
        `select created_at, user_id, type, data from public.events
          where type in ('generation_failed', 'avatar_fallo') and created_at >= $1`,
        [desde]
      )
    ).rows.map((r): Ocurrencia => {
      const d = (r.data ?? {}) as { message?: unknown; paso?: unknown };
      const msg = typeof d.message === "string" ? d.message : null;
      const codigo = msg && /^[A-Z_]{3,40}$/.test(msg) ? msg : "otro";
      return {
        at: iso(r.created_at),
        userId: r.user_id,
        clave: r.type === "generation_failed" ? `generation_failed:${codigo}` : "avatar_fallo",
        pantalla: null,
        mensaje: null,
        tecnico: [r.type, d.paso != null ? `paso ${String(d.paso)}` : null, msg].filter(Boolean).join(" · "),
        fuente: "events",
      };
    });
    const ia = (
      await c.query(
        `select created_at, user_id, tarea, modelo, ms from public.ai_calls where ok = false and created_at >= $1`,
        [desde]
      )
    ).rows.map(
      (r): Ocurrencia => ({
        at: iso(r.created_at),
        userId: r.user_id,
        clave: `ia:${r.tarea}`,
        pantalla: null,
        mensaje: null,
        tecnico: `${r.modelo} · falló a los ${Math.round(Number(r.ms) / 100) / 10} s`,
        fuente: "ai_calls",
      })
    );
    const estados = (
      await c.query(`select clave, estado, nota, actualizado from public.errores_estado`)
    ).rows.map((r) => ({ ...r, actualizado: iso(r.actualizado) })) as EstadoGuardado[];

    const ocurrencias = [...propios, ...eventos, ...ia];
    const ids = [...new Set(ocurrencias.map((o) => o.userId).filter((x): x is string => !!x))];
    const correos = new Map<string, string>();
    if (ids.length) {
      const filas = (await c.query(`select id, email from public.profiles where id = any($1::uuid[])`, [ids])).rows;
      for (const f of filas) if (f.email) correos.set(f.id, f.email);
    }
    return { ocurrencias, estados, correos };
  });
}
