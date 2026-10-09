import { withDb } from "@/lib/db";
import { ZONA, diaEnZona, sumarDias } from "@/lib/admin/adquisicion";
import { quienesVolvieron, type EstadoParo, type QuienVolvio, type ResumenCampana } from "@/lib/admin/campana";
import { cargarCampana, desdePorDefecto } from "@/lib/admin/campana-datos";
import { contarEventos, evaluarSenales, type Veredicto } from "@/lib/senales-vivas";
import { resumenDelDia, type ResumenDia } from "@/lib/admin/hoy";

// La carga de la pantalla Hoy (lib/admin/hoy.ts). Se apoya en cargarCampana,
// la MISMA carga del correo de las 8 y de la pantalla de campañas, para que
// los tres digan lo mismo; sólo agrega el gasto de IA por día y las señales
// de salud.

export type DatosHoy = {
  hoy: string;
  ayer: string;
  paro: EstadoParo;
  resumen: ResumenCampana[];
  dias: [ResumenDia, ResumenDia];
  volvieron: { dia: string; quienes: QuienVolvio[] }[];
  ia: { dia: string; usd: number; llamadas: number; top: { correo: string; usd: number } | null }[];
  /** Señales que dejaron de llegar (lib/senales-vivas), sólo las que no están sanas. */
  alarmas: Veredicto[];
};

/** El fit check escribe `worn` desde este día; antes no lo hacía por diseño. */
const FIT_CHECK_ESCRIBE_WORN = "2026-08-11";

async function gastoIaPorDia(dias: string[]): Promise<DatosHoy["ia"]> {
  return withDb(async (c) => {
    const out: DatosHoy["ia"] = [];
    for (const dia of dias) {
      const rango = `(a.created_at at time zone '${ZONA}')::date = $1::date`;
      const tot = (
        await c.query<{ usd: number; llamadas: number }>(
          `select coalesce(sum(a.costo_usd), 0)::float as usd, count(*)::int as llamadas from public.ai_calls a where ${rango}`,
          [dia]
        )
      ).rows[0];
      const top =
        (
          await c.query<{ correo: string; usd: number }>(
            `select coalesce(u.email, a.user_id::text) as correo, sum(a.costo_usd)::float as usd
               from public.ai_calls a left join auth.users u on u.id = a.user_id
              where ${rango} and a.user_id is not null
              group by 1 order by 2 desc limit 1`,
            [dia]
          )
        ).rows[0] ?? null;
      out.push({ dia, usd: Number(tot?.usd ?? 0), llamadas: Number(tot?.llamadas ?? 0), top: top ? { correo: top.correo, usd: Number(top.usd) } : null });
    }
    return out;
  });
}

/**
 * ¿Alguna señal dejó de llegar? Pares de eventos que tienen que moverse
 * juntos (lib/senales-vivas). Los dos bugs silenciosos de agosto se habrían
 * visto aquí a la primera. Ventana de 30 días, sin cuentas de prueba.
 */
async function alarmasDeSalud(): Promise<Veredicto[]> {
  const eventos = await withDb(
    async (c) =>
      (
        await c.query<{ type: string; created_at: string; data: { step?: number | string } | null }>(
          `select e.type, e.created_at, e.data
             from public.events e
             left join public.profiles p on p.id = e.user_id
            where e.created_at > now() - interval '30 days'
              and e.type in ('espejo_subido', 'worn', 'first_outfit_ttv', 'onboarding_step')
              and coalesce(p.email, '') not like '%@stailist.app'`
        )
      ).rows.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() }))
  );
  return evaluarSenales([
    {
      nombre: "fit check → me lo puse",
      disparador: "espejo_subido",
      desde: FIT_CHECK_ESCRIBE_WORN,
      disparos: contarEventos(eventos, "espejo_subido", FIT_CHECK_ESCRIBE_WORN),
      consecuencia: "worn",
      consecuencias: contarEventos(eventos, "worn", FIT_CHECK_ESCRIBE_WORN),
      cuesta: "la señal de oro del experimento y el orden del clóset por prendas usadas",
    },
    {
      nombre: "terminar onboarding → primer look",
      disparador: "onboarding_step",
      disparos: eventos.filter((e) => e.type === "onboarding_step" && Number(e.data?.step) === 5).length,
      consecuencia: "first_outfit_ttv",
      consecuencias: contarEventos(eventos, "first_outfit_ttv"),
      cuesta: "la medición del tiempo al primer look",
    },
  ]).filter((v) => v.estado === "seca" || v.estado === "floja");
}

export async function cargarHoy(ahora: Date = new Date()): Promise<DatosHoy> {
  const hoy = diaEnZona(ahora);
  const ayer = sumarDias(hoy, -1);
  const d = await cargarCampana(await desdePorDefecto(ahora), ahora);
  const [ia, alarmas] = [await gastoIaPorDia([hoy, ayer]), await alarmasDeSalud()];
  return {
    hoy,
    ayer,
    paro: d.paro,
    resumen: d.resumen,
    dias: [resumenDelDia(d.filas, d.extras, hoy), resumenDelDia(d.filas, d.extras, ayer)],
    volvieron: [hoy, ayer].map((dia) => ({ dia, quienes: quienesVolvieron(d.filas, dia) })),
    ia,
    alarmas,
  };
}
