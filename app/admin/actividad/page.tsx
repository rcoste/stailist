import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { banderaDe, paisEnPalabras } from "@/lib/lugar";
import { todasLasFilas } from "@/lib/todas-las-filas";
import { construirFeed, etiqueta, porDia, sinBorradoresVacios, vueltas, type Momento } from "@/lib/admin/actividad";
import { origenEnPalabras } from "@/lib/admin/campana";
import { origenDesdeDato } from "@/lib/origen";
import { diaEnZona, horaEnZona, sumarDias } from "@/lib/admin/adquisicion";
import { FeedFiltros } from "./feed-filtros";

export const dynamic = "force-dynamic";

// EL FEED: qué hizo la gente, en orden. El porqué del cruce de fuentes (y por
// qué NO sale de `events`) vive en lib/admin/actividad.ts.
//
// Se lee todo en memoria y se cruza aquí, igual que la lista de usuarias: con
// ~27 perfiles y ~1200 filas totales sobra, y una vista SQL sería un candado
// para el volumen que este experimento no tiene. Cuando esto crezca a miles,
// el comentario de usuarios/page.tsx aplica igual: se mueve a una vista.
export default async function ActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; t?: string }>;
}) {
  await requireAdmin();
  const { u: filtroUsuario, t: filtroTipo } = await searchParams;
  const supabase = await createClient();

  // De mil en mil: PostgREST corta en 1000 sin avisar y events/items ya pasan
  // de dos mil (ver lib/admin/todas-las-filas.ts).
  const [perfilesRaw, items, outfits, trips, wishlist, events] = await Promise.all([
    todasLasFilas((d, h) =>
      supabase
        .from("profiles")
        .select("id, email, created_at, pais, origen, como_nos_conocio, is_admin")
        .order("id")
        .range(d, h)
    ),
    todasLasFilas((d, h) => supabase.from("items").select("id, user_id, created_at, deleted_at").order("id").range(d, h)),
    todasLasFilas((d, h) => supabase.from("outfits").select("id, user_id, created_at, deleted_at").order("id").range(d, h)),
    todasLasFilas((d, h) => supabase.from("trips").select("id, user_id, created_at, deleted_at").order("id").range(d, h)),
    todasLasFilas((d, h) => supabase.from("wishlist_items").select("user_id, created_at").order("id").range(d, h)),
    todasLasFilas((d, h) =>
      supabase.from("events").select("user_id, outfit_id, type, data, created_at").order("id").range(d, h)
    ),
  ]);

  const perfiles = perfilesRaw as {
    id: string;
    email: string | null;
    created_at: string | null;
    pais: string | null;
    origen: unknown;
    como_nos_conocio: string | null;
    is_admin: boolean | null;
  }[];
  const correo = new Map(perfiles.map((p) => [p.id, p.email ?? p.id.slice(0, 8)]));
  const paisDe = new Map(perfiles.map((p) => [p.id, p.pais]));
  const llegoPor = new Map(
    perfiles.map((p) => [p.id, origenEnPalabras(origenDesdeDato(p.origen), p.como_nos_conocio)])
  );

  const feedCompleto = construirFeed({
    profiles: perfiles.map((p) => ({ id: p.id, created_at: p.created_at })),
    items: items as never,
    outfits: outfits as never,
    trips: trips as never,
    wishlist: wishlist as never,
    events: events as never,
  });
  // Los borradores que nunca abrieron el onboarding no son personas: se
  // cuentan arriba y no ocupan líneas (ver sinBorradoresVacios).
  const { feed, vacios } = sinBorradoresVacios(
    feedCompleto,
    new Set(perfiles.filter((p) => !p.email).map((p) => p.id))
  );
  const regreso = vueltas(
    feed,
    new Map(perfiles.filter((p) => p.created_at).map((p) => [p.id, p.created_at as string])),
    // Admin y cuentas de prueba (@stailist.app): sus vueltas no son señal.
    new Set(perfiles.filter((p) => p.is_admin || p.email?.endsWith("@stailist.app")).map((p) => p.id))
  );

  // Los filtros se aplican DESPUÉS de colapsar: filtrar antes cambiaría las
  // ráfagas (una tanda de 23 prendas seguiría siendo 23 aunque mires a una
  // sola persona, pero el conteo por tipo del selector sí saldría distinto).
  const visibles = feed.filter(
    (m) =>
      (!filtroUsuario || m.userId === filtroUsuario) &&
      (!filtroTipo || familia(m) === filtroTipo)
  );

  const gente = [...new Set(feed.map((m) => m.userId))]
    .map((id) => ({ id, label: correo.get(id) ?? id.slice(0, 8) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const tipos = [...new Set(feed.map(familia))].sort();

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">Actividad</h1>
        <p className="text-sm text-muted">
          Todo lo que hace la gente, en orden: prendas, looks, votos, viajes,
          espejos y altas. “Abrió la app” es una vuelta sin nada más. Las
          tandas del mismo rato se cuentan como una.
        </p>
      </header>

      <FeedFiltros
        gente={gente}
        tipos={tipos}
        usuario={filtroUsuario ?? ""}
        tipo={filtroTipo ?? ""}
      />

      <p className="text-xs text-muted">
        {visibles.length} momento{visibles.length === 1 ? "" : "s"}
        {visibles.length !== feed.length ? ` de ${feed.length}` : ""}
        {vacios > 0
          ? ` · ${vacios} borrador${vacios === 1 ? "" : "es"} vacío${vacios === 1 ? "" : "s"} sin enseñar (tocaron el botón y nunca abrieron el onboarding)`
          : ""}
      </p>

      {visibles.length === 0 ? (
        <p className="text-sm text-muted">Nada que enseñar con este filtro.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {porDia(visibles).map((d) => (
            <section key={d.dia} className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {diaLegible(d.dia)}
              </h2>
              <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {d.momentos.map((m) => (
                  <Fila
                    key={m.key}
                    m={m}
                    email={correo.get(m.userId) ?? m.userId.slice(0, 8)}
                    pais={paisDe.get(m.userId) ?? null}
                    origen={m.tipo === "alta" ? llegoPor.get(m.userId) ?? null : null}
                    vuelta={regreso.get(m.key) ?? null}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// La familia para el selector: los eventos se agrupan bajo su propio tipo, no
// todos juntos bajo "evento" (mirar sólo los 👍 es la razón principal de que
// exista el filtro).
function familia(m: Momento): string {
  return m.tipo.startsWith("ev:") ? m.tipo.slice(3) : m.tipo;
}


function Fila({
  m,
  email,
  pais,
  origen,
  vuelta,
}: {
  m: Momento;
  email: string;
  pais: string | null;
  /** Sólo en la línea del alta: de dónde llegó. */
  origen: string | null;
  /** Días desde el alta si este es el primer momento de un día de regreso. */
  vuelta: number | null;
}) {
  const detalle = origen ?? extra(m);
  const bandera = banderaDe(pais);
  return (
    <li className="flex items-baseline gap-3 px-4 py-2.5">
      <span className="w-[52px] shrink-0 tabular-nums text-xs text-faint">
        {horaEnZona(m.at)}
      </span>
      {/* Ancho fijo aunque no haya dato: las cuentas sin país (anteriores al
          2026-10-06, o borradores que nunca abrieron el onboarding) quedan con
          el hueco y los correos siguen alineados. */}
      <span className="w-5 shrink-0 text-sm" title={pais ? paisEnPalabras(pais) : "sin país"}>
        {bandera}
      </span>
      <Link
        href={`/admin/usuarios/${m.userId}`}
        className="shrink-0 max-w-[38%] truncate text-sm font-semibold text-ink underline decoration-line underline-offset-2 hover:decoration-ink"
      >
        {email}
      </Link>
      <span className="min-w-0 flex-1 text-sm text-muted">
        {vuelta != null ? (
          <span className="mr-1.5 inline-block rounded-full border border-success px-1.5 text-[11px] font-semibold text-success">
            volvió · {vuelta === 1 ? "al día siguiente" : `a los ${vuelta} días`}
          </span>
        ) : null}
        {etiqueta(m)}
        {detalle ? <span className="text-faint"> · {detalle}</span> : null}
      </span>
    </li>
  );
}

// El dato suelto que hace útil la línea: los segundos del TTV, el paso del
// onboarding. Sin esto, "llegó a su primer look" no dice si tardó 40s u 11 min,
// que es el criterio de éxito #1 del proyecto.
function extra(m: Momento): string | null {
  const d = m.data as { seconds?: number; step?: number } | null;
  if (!d) return null;
  if (m.tipo === "ev:first_outfit_ttv" && typeof d.seconds === "number") {
    const s = Math.round(d.seconds);
    return s < 120 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  }
  if (m.tipo === "ev:onboarding_step" && typeof d.step === "number") return `paso ${d.step}`;
  return null;
}

function diaLegible(dia: string): string {
  const hoy = diaEnZona(new Date());
  const ayer = sumarDias(hoy, -1);
  if (dia === hoy) return "hoy";
  if (dia === ayer) return "ayer";
  const d = new Date(dia + "T12:00:00Z");
  return d.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
