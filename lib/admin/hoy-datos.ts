import { withDb } from "@/lib/db";
import { ZONA, diaEnZona, sumarDias } from "@/lib/admin/adquisicion";
import { quienesVolvieron, type EstadoParo, type QuienVolvio, type ResumenCampana } from "@/lib/admin/campana";
import { cargarCampana, desdePorDefecto } from "@/lib/admin/campana-datos";
import { contarEventos, evaluarSenales, type Veredicto } from "@/lib/senales-vivas";
import { resumenDelDia, tendencia, type DiaTendencia, type ResumenDia } from "@/lib/admin/hoy";
import { parecidoConSugerido, type LookSugerido, type ParecidoConSugerido } from "@/lib/senal-oro";

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
  /** Los últimos 14 días: primeros looks y regresos por día. */
  tendencia: DiaTendencia[];
  /** Lo que dijeron o hicieron las usuarias en 7 días, sin cuentas de admin ni de prueba. */
  voz: Voz;
};

/**
 * LA VOZ DE LAS USUARIAS (2026-10-11). Para entender qué retiene hacen falta
 * las señales que la gente deja a propósito, no sólo los conteos: votos,
 * looks que se puso, fit checks y los reportes que escribe. Vivían en el
 * Dashboard de junio y se perdieron con el replanteo. Que casi todo salga en
 * cero también es un hallazgo: casi nadie habla.
 */
export type Voz = {
  meGusta: number;
  noMeGusta: number;
  seLoPuso: number;
  fitChecks: number;
  reportes: { cuando: string; correo: string; tipo: string; texto: string }[];
  /**
   * Los espejos (fit checks) de la semana, con su foto y si lo que trae puesto
   * es el look sugerido o su propia ropa (lib/senal-oro.ts). Antes sólo había
   * el conteo: el primero de una persona de anuncios se leyó como "se puso un
   * look" sin poder ver la foto.
   */
  espejos: Espejo[];
};

export type Espejo = {
  userId: string;
  correo: string | null;
  pais: string | null;
  cuando: string;
  titulo: string | null;
  /** El consejo de color que le dio el espejo. */
  consejo: string | null;
  /** Ruta privada en Storage; la página la firma. */
  fotoPath: string | null;
  parecido: ParecidoConSugerido;
};

async function espejosDeLaSemana(): Promise<Espejo[]> {
  return withDb(async (c) => {
    const fuera = `coalesce(p.is_admin, false) = false and coalesce(p.email, '') not like '%@stailist.app'`;
    const espejos = (
      await c.query<{
        user_id: string;
        email: string | null;
        pais: string | null;
        created_at: string;
        title: string | null;
        explanation: string | null;
        photo_path: string | null;
        item_ids: string[] | null;
      }>(
        `select o.user_id, p.email, p.pais, o.created_at, o.title, o.explanation, o.photo_path, o.item_ids
           from public.outfits o join public.profiles p on p.id = o.user_id
          where o.source = 'espejo' and o.deleted_at is null
            and o.created_at > now() - interval '7 days' and ${fuera}
          order by o.created_at desc
          limit 30`
      )
    ).rows;
    if (espejos.length === 0) return [];
    // Los looks sugeridos de esas personas, incluso los que luego borraron: lo
    // que se compara es lo que se le sugirió, no lo que conservó.
    const looks = (
      await c.query<{ id: string; user_id: string; title: string | null; item_ids: string[] | null; created_at: string }>(
        `select o.id, o.user_id, o.title, o.item_ids, o.created_at
           from public.outfits o
          where o.user_id = any($1::uuid[])
            and coalesce(o.source, '') <> 'espejo'
            and o.created_at > now() - interval '8 days'`,
        [[...new Set(espejos.map((e) => e.user_id))]]
      )
    ).rows;
    const porPersona = new Map<string, LookSugerido[]>();
    for (const l of looks) {
      const lista = porPersona.get(l.user_id) ?? [];
      lista.push({ id: l.id, titulo: l.title, itemIds: l.item_ids ?? [], createdAt: new Date(l.created_at).toISOString() });
      porPersona.set(l.user_id, lista);
    }
    return espejos.map((e) => {
      const cuando = new Date(e.created_at).toISOString();
      return {
        userId: e.user_id,
        correo: e.email,
        pais: e.pais,
        cuando,
        titulo: e.title,
        consejo: e.explanation,
        fotoPath: e.photo_path,
        parecido: parecidoConSugerido({ itemIds: e.item_ids ?? [], createdAt: cuando }, porPersona.get(e.user_id) ?? []),
      };
    });
  });
}

async function vozDeLaSemana(): Promise<Omit<Voz, "espejos">> {
  return withDb(async (c) => {
    const fuera = `coalesce(p.is_admin, false) = false and coalesce(p.email, '') not like '%@stailist.app'`;
    const n = (
      await c.query<{ type: string; n: number }>(
        `select e.type, count(*)::int as n
           from public.events e join public.profiles p on p.id = e.user_id
          where e.created_at > now() - interval '7 days'
            and e.type in ('vote_up', 'vote_down', 'worn', 'espejo_subido')
            and ${fuera}
          group by 1`
      )
    ).rows;
    const cuenta = (t: string) => n.find((r) => r.type === t)?.n ?? 0;
    const reportes = (
      await c.query<{ cuando: string; correo: string | null; tipo: string; texto: string }>(
        `select r.created_at as cuando, p.email as correo, r.tipo, r.texto
           from public.reportes r join public.profiles p on p.id = r.user_id
          where r.created_at > now() - interval '7 days' and ${fuera}
          order by r.created_at desc limit 5`
      )
    ).rows;
    return {
      meGusta: cuenta("vote_up"),
      noMeGusta: cuenta("vote_down"),
      seLoPuso: cuenta("worn"),
      fitChecks: cuenta("espejo_subido"),
      reportes: reportes.map((r) => ({
        cuando: new Date(r.cuando).toISOString(),
        correo: r.correo ?? "(sin correo)",
        tipo: r.tipo,
        texto: r.texto,
      })),
    };
  });
}

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
  const [ia, alarmas, voz, espejos] = [
    await gastoIaPorDia([hoy, ayer]),
    await alarmasDeSalud(),
    await vozDeLaSemana(),
    await espejosDeLaSemana(),
  ];
  return {
    hoy,
    ayer,
    paro: d.paro,
    resumen: d.resumen,
    dias: [resumenDelDia(d.filas, d.extras, hoy), resumenDelDia(d.filas, d.extras, ayer)],
    volvieron: [hoy, ayer].map((dia) => ({ dia, quienes: quienesVolvieron(d.filas, dia) })),
    ia,
    alarmas,
    tendencia: tendencia(d.filas, hoy),
    voz: { ...voz, espejos },
  };
}
