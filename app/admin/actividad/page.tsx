import { requireAdmin } from "@/lib/auth";
import { cargarPersonas } from "@/lib/admin/personas-datos";
import { desdeHace } from "@/lib/admin/embudo-datos";
import {
  construirFeed,
  dispositivoPorDia,
  esImportante,
  porDia,
  sinBorradoresVacios,
  vueltas,
  type Momento,
} from "@/lib/admin/actividad";
import { cargarMiniaturas } from "@/lib/admin/miniaturas-datos";
import { origenEnPalabras } from "@/lib/admin/campana";
import { origenDesdeDato } from "@/lib/origen";
import { diaEnZona, sumarDias } from "@/lib/admin/adquisicion";
import { FeedFiltros } from "./feed-filtros";
import { Control, Encabezado, Filtros, Lista, Panel, Pestanas, Vacio } from "../_ui";
import { Fila, Leyenda } from "./fila";

export const dynamic = "force-dynamic";

// Actividad primero: es la vista que más se usa.
const PESTANAS_PERSONAS = [
  { href: "/admin/actividad", label: "Actividad" },
  { href: "/admin/usuarios", label: "Lista" },
];

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
  searchParams: Promise<{ u?: string; t?: string; dias?: string; n?: string; imp?: string }>;
}) {
  await requireAdmin();
  const { u: filtroUsuario, t: filtroTipo, dias: diasQ, n: nQ, imp } = await searchParams;
  // "solo lo importante": esconde la rutina (ver nivelDe).
  const soloImportante = imp === "1";
  // Una ventana, no la historia entera: 7 días por defecto (lo que se mira),
  // y "todo" a un clic. Pintar 1936 momentos costaba 4 s sin señal.
  const dias = diasQ === "todo" ? null : [7, 14, 30].includes(Number(diasQ)) ? Number(diasQ) : 7;
  // Y de a 300 líneas: "ver más" pide el doble. Es lo que pesa en pintar.
  const tope = Math.max(300, Number(nQ) || 0);

  // Una sola ida a la base (lib/admin/personas-datos.ts): antes eran ~10
  // consultas paginadas y 3 s sin señal en pantalla.
  const { perfiles, fuentes } = await cargarPersonas(dias ? desdeHace(dias) : null);
  const { items, outfits, trips, wishlist, events } = fuentes;
  const correo = new Map(perfiles.map((p) => [p.id, p.email ?? p.id.slice(0, 8)]));
  const paisDe = new Map(perfiles.map((p) => [p.id, p.pais]));
  // El aparato de cada línea: el de la visita de ESE día y, si ese día no lo
  // guardó (antes del 2026-10-14), el del onboarding.
  const aparatoDelDia = dispositivoPorDia(events as never);
  const aparatoDeAlta = new Map(perfiles.map((p) => [p.id, p.dispositivo]));
  const aparato = (m: Momento) =>
    aparatoDelDia.get(`${m.userId}|${diaEnZona(new Date(m.at))}`) ?? aparatoDeAlta.get(m.userId) ?? null;
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
      (!filtroTipo || familia(m) === filtroTipo) &&
      (!soloImportante || esImportante(m))
  );

  const gente = [...new Set(feed.map((m) => m.userId))]
    .map((id) => ({ id, label: correo.get(id) ?? id.slice(0, 8) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const tipos = [...new Set(feed.map(familia))].sort();

  // Las miniaturas sólo de lo que se va a pintar: looks y prendas de esas
  // líneas, firmadas de una vez (lib/admin/miniaturas-datos.ts).
  const mostrados = visibles.slice(0, tope);
  const minis = await cargarMiniaturas(mostrados, items);

  const sufijo = `${filtroUsuario ? `&u=${filtroUsuario}` : ""}${filtroTipo ? `&t=${filtroTipo}` : ""}`;
  const conImp = soloImportante ? "&imp=1" : "";

  return (
    <>
      <Pestanas pestanas={PESTANAS_PERSONAS} activa="/admin/actividad" />
      <Encabezado titulo="Actividad" sub="Todo lo que hace la gente, en orden. Las tandas del mismo rato cuentan como una." />
      <Leyenda />

      {/* Los dos selects (persona, tipo) y el periodo, en una sola línea que envuelve. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 [&>div]:mb-0">
        <FeedFiltros gente={gente} tipos={tipos} usuario={filtroUsuario ?? ""} tipo={filtroTipo ?? ""} />
        <Filtros
          grupos={[
            {
              titulo: "mostrar",
              opciones: [
                { href: `/admin/actividad?dias=${dias ?? "todo"}${sufijo}`, label: "todo", activo: !soloImportante },
                { href: `/admin/actividad?dias=${dias ?? "todo"}${sufijo}&imp=1`, label: "solo lo importante", activo: soloImportante },
              ],
            },
            {
              titulo: "ver",
              opciones: [7, 14, 30, "todo"].map((d) => ({
                href: `/admin/actividad?dias=${d}${sufijo}${conImp}`,
                label: d === "todo" ? "todo" : `últimos ${d} días`,
                activo: d === "todo" ? dias === null : dias === d,
              })),
            },
          ]}
        />
      </div>

      <p className="mb-4 text-[13px] text-muted">
        {visibles.length} momento{visibles.length === 1 ? "" : "s"}
        {visibles.length !== feed.length ? ` de ${feed.length}` : ""}
        {vacios > 0 ? ` · ${vacios} borrador${vacios === 1 ? "" : "es"} vacío${vacios === 1 ? "" : "s"} sin enseñar` : ""}
      </p>

      {visibles.length === 0 ? (
        <Panel sinPadding>
          <Vacio>Nada que enseñar con este filtro.</Vacio>
        </Panel>
      ) : (
        <>
          {porDia(mostrados).map((d) => (
            <Panel key={d.dia} titulo={diaLegible(d.dia)} sinPadding className="mb-4">
              <Lista>
                {d.momentos.map((m) => (
                  <Fila
                    key={m.key}
                    m={m}
                    email={correo.get(m.userId) ?? m.userId.slice(0, 8)}
                    pais={paisDe.get(m.userId) ?? null}
                    aparato={aparato(m)}
                    origen={m.tipo === "alta" ? llegoPor.get(m.userId) ?? null : null}
                    vuelta={regreso.get(m.key) ?? null}
                    mini={minis.get(m.key) ?? null}
                  />
                ))}
              </Lista>
            </Panel>
          ))}
          {visibles.length > tope ? (
            <div className="flex justify-center">
              <Control href={`/admin/actividad?dias=${dias ?? "todo"}&n=${tope * 2}${sufijo}${conImp}`}>
                ver más ({visibles.length - tope} más)
              </Control>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

// La familia para el selector: los eventos se agrupan bajo su propio tipo, no
// todos juntos bajo "evento" (mirar sólo los 👍 es la razón principal de que
// exista el filtro).
function familia(m: Momento): string {
  return m.tipo.startsWith("ev:") ? m.tipo.slice(3) : m.tipo;
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
