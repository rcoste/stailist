import { requireAdmin } from "@/lib/auth";
import { cargarPersonas } from "@/lib/admin/personas-datos";
import { desdeHace } from "@/lib/admin/embudo-datos";
import {
  construirFeed,
  dispositivoPorDia,
  esImportante,
  etiqueta,
  nivelDe,
  porDia,
  sinBorradoresVacios,
  vueltas,
  type Momento,
  type Nivel,
} from "@/lib/admin/actividad";
import { origenEnPalabras } from "@/lib/admin/campana";
import { origenDesdeDato } from "@/lib/origen";
import { diaEnZona, horaEnZona, sumarDias } from "@/lib/admin/adquisicion";
import { FeedFiltros } from "./feed-filtros";
import { Chip, Control, Encabezado, Filtros, Lista, Panel, Pestanas, Quien, Renglon, Vacio } from "../_ui";

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
          {porDia(visibles.slice(0, tope)).map((d) => (
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

// Los cuatro niveles (lib/admin/actividad.ts nivelDe), con tokens del DS: el
// fondo suave y la raya marcan lo que buscamos; el rojo, lo que falló.
const TEXTO_NIVEL: Record<Nivel, string> = {
  oro: "font-bold text-ink",
  valor: "font-semibold text-ink",
  rutina: "text-faint",
  falla: "font-semibold text-error",
};

const LEYENDA: { nivel: Nivel; titulo: string; que: string }[] = [
  { nivel: "oro", titulo: "Lo que buscamos", que: "se puso un look, votó 👍 o 👎, guardó un look, instaló la app" },
  { nivel: "valor", titulo: "Usó el producto", que: "primer look, looks, viajes, cápsula, probador, avatar" },
  { nivel: "rutina", titulo: "Rutina", que: "abrió la app, añadió o borró prendas, pasos del onboarding" },
  { nivel: "falla", titulo: "Algo falló", que: "el look o el avatar no salió: se topó con un error" },
];

function Leyenda() {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
      {LEYENDA.map((l) => (
        <div
          key={l.nivel}
          className={`relative overflow-hidden rounded-lg border border-line px-3 py-2.5 text-xs leading-[17px] text-muted ${
            l.nivel === "oro" ? "bg-accent-soft" : "bg-surface"
          }`}
        >
          <Raya nivel={l.nivel} />
          <b className={`block text-[13px] ${TEXTO_NIVEL[l.nivel]}`}>{l.titulo}</b>
          {l.que}
        </div>
      ))}
    </div>
  );
}

function Raya({ nivel }: { nivel: Nivel }) {
  if (nivel !== "oro" && nivel !== "falla") return null;
  return <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${nivel === "oro" ? "bg-ink" : "bg-error"}`} />;
}

const APARATO_CORTO: Record<string, string> = { celular: "celular", computadora: "compu", tablet: "tablet" };

function Fila({
  m,
  email,
  pais,
  aparato,
  origen,
  vuelta,
}: {
  m: Momento;
  email: string;
  pais: string | null;
  /** celular / computadora / tablet; null si nunca se guardó. */
  aparato: string | null;
  /** Sólo en la línea del alta: de dónde llegó. */
  origen: string | null;
  /** Días desde el alta si este es el primer momento de un día de regreso. */
  vuelta: number | null;
}) {
  const detalle = origen ?? extra(m);
  const nivel = nivelDe(m);
  return (
    <Renglon className={`relative ${nivel === "oro" ? "bg-accent-soft" : ""}`}>
      <Raya nivel={nivel} />
      <span className="w-12 shrink-0 text-xs tabular-nums text-faint">{horaEnZona(m.at)}</span>
      {/* Quien ya trae su tope de ancho (55%) y trunca adentro; envolverlo en
          otro flex lo colapsaba a tres letras. */}
      <Quien correo={email} pais={pais} href={`/admin/usuarios/${m.userId}`} />
      {aparato ? <Chip>{APARATO_CORTO[aparato] ?? aparato}</Chip> : null}
      {vuelta != null ? <Chip tono="success">volvió · {vuelta === 1 ? "al día siguiente" : `a los ${vuelta} días`}</Chip> : null}
      <span className={`min-w-0 flex-1 text-sm ${TEXTO_NIVEL[nivel]}`}>
        {etiqueta(m)}
        {detalle ? <span className="font-normal text-faint"> · {detalle}</span> : null}
      </span>
    </Renglon>
  );
}

// El dato suelto que hace útil la línea: los segundos del TTV, el paso del
// onboarding. Sin esto, "llegó a su primer look" no dice si tardó 40s u 11 min,
// que es el criterio de éxito #1 del proyecto.
function extra(m: Momento): string | null {
  const d = m.data as { seconds?: number; step?: number; reason?: unknown; message?: unknown } | null;
  if (!d) return null;
  // El porqué del 👎, si lo dejó (lib/outfit-actions.ts saveDownReason).
  if (m.tipo === "ev:vote_down" && typeof d.reason === "string" && d.reason.trim()) return `"${d.reason.trim()}"`;
  if (m.tipo === "ev:generation_failed" && typeof d.message === "string") {
    return d.message === "TOO_FEW_OUTFITS" ? "muy pocas prendas para armar los looks" : d.message.slice(0, 80);
  }
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
