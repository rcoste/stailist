import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icon";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  tripDays,
  luggageSummary,
  fmtDiaMes,
  rangoFechas,
  nombreDeViaje,
  rutaDeViaje,
  type Bolsas,
  type Luggage,
  type Parada,
  type TripWeather,
} from "@/lib/trip";
import { capsuleRows, type CapsuleMatch, type CapsuleOverrides, type CapsuleTarget } from "@/lib/capsule";
import { fotosDeViajes } from "@/lib/destino-imagen-cache";

const MESES_FULL = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const fmt = fmtDiaMes;

// Eyebrow del countdown (cards de desktop): cuánto falta para salir.
function countdown(hoy: string, inicio: string): string {
  if (inicio <= hoy) return "en curso";
  const n = tripDays(hoy, inicio) - 1;
  if (n === 1) return "sale mañana";
  if (n >= 14) return `sale en ${Math.round(n / 7)} semanas`;
  return `sale en ${n} ${n === 1 ? "día" : "días"}`;
}

type TripRowDb = {
  id: string;
  lugar: string;
  ocasiones: string[] | null;
  fecha_inicio: string;
  fecha_fin: string;
  paradas: unknown;
  weather: TripWeather | null;
  bolsas: Bolsas | null;
  maleta: Luggage | null;
  capsule_target: CapsuleTarget | null;
  capsule_match: CapsuleMatch | null;
  overrides: CapsuleOverrides | null;
  empacado: Record<string, boolean> | null;
  outfits: unknown;
};

// Datos derivados para la card de desktop (progreso real de empacado, mismo
// criterio que el detalle: empacables = todo lo que no falta + faltas palomeadas).
function derive(t: TripRowDb, hoy: string) {
  const paradas = Array.isArray(t.paradas) ? (t.paradas as { lugar?: string }[]) : [];
  const nParadas = paradas.length || 1;
  const destino =
    nParadas > 1
      ? `${(paradas[0]?.lugar ?? t.lugar).split(",")[0].split(" · ")[0]} y ${nParadas - 1} más`
      : t.lugar;
  const dias = tripDays(t.fecha_inicio, t.fecha_fin);
  const empacado = t.empacado ?? {};
  let total = 0;
  let packed = 0;
  if (t.capsule_target) {
    for (const r of capsuleRows(t.capsule_target, t.capsule_match, t.overrides)) {
      const eff =
        r.base === "parecido"
          ? r.decision === "accept"
            ? "tienes"
            : r.decision === "reject"
              ? "falta"
              : "parecido"
          : r.base;
      const isPacked = !!empacado[String(r.index)];
      if (eff !== "falta" || isPacked) {
        total++;
        if (isPacked) packed++;
      }
    }
  }
  const looks = Array.isArray(t.outfits) ? (t.outfits as unknown[]).length : 0;
  const pasado = t.fecha_fin < hoy;
  const [anio, mes] = t.fecha_inicio.split("-");
  return {
    destino,
    dias,
    total,
    packed,
    looks,
    pasado,
    eyebrow: pasado
      ? `${MESES_FULL[Number(mes) - 1] ?? ""} ${anio}`
      : countdown(hoy, t.fecha_inicio),
    equipaje: luggageSummary(t.bolsas, t.maleta),
    temp: t.weather ? `~${t.weather.temp_c}°C` : null,
  };
}

// Card editorial de desktop (handoff desktop_f3): countdown → título con destino
// en display italic → meta en una línea → footer con progreso + "abrir maleta".
function TripCard({ t, hoy, foto }: { t: TripRowDb; hoy: string; foto: string }) {
  const d = derive(t, hoy);
  return (
    <Link
      href={`/viaje/${t.id}`}
      className={`group flex flex-col overflow-hidden rounded-md border border-line bg-surface transition-colors hover:border-ink ${
        d.pasado ? "opacity-65 hover:opacity-100" : ""
      }`}
    >
      {/* La foto del destino, a sangre arriba (B&N editorial — el color es de
          tu ropa, no del paisaje). El padding vive abajo para que sangre. */}
      <span className="relative block h-[150px] w-full bg-tile">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foto} alt="" className="h-full w-full object-cover" />
      </span>
      <span className="flex flex-1 flex-col p-6">
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
        {d.eyebrow}
      </span>
      <span className="mt-2 text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">
        tu maleta para{" "}
        <em className="font-display font-normal italic">{d.destino}</em>
      </span>
      <span className="tabular mt-2 text-[12.5px] text-muted">
        {fmt(t.fecha_inicio)} – {fmt(t.fecha_fin)} · {d.dias} días
        {d.temp ? ` · ${d.temp}` : ""}
        {d.equipaje ? ` · ${d.equipaje}` : ""}
      </span>
      <span className="mt-5 flex items-center justify-between border-t border-line pt-4">
        <span className="tabular text-xs font-semibold text-ink">
          {d.pasado
            ? `${d.looks} ${d.looks === 1 ? "look" : "looks"}`
            : d.total > 0
              ? `${d.packed} de ${d.total} empacadas`
              : "sin maleta aún"}
        </span>
        <span className="flex items-center gap-1 text-sm font-semibold text-ink group-hover:underline">
          {d.pasado ? "ver el viaje" : "abrir maleta"}
          <Icon name="chevron" size={14} />
        </span>
      </span>
      </span>
    </Link>
  );
}

// "Tus viajes": las maletas guardadas, con su propia pantalla (salió del wizard).
// Móvil: la lista compacta de siempre (intacta). Desktop (handoff desktop_f3):
// secciones Próximos/Pasados con cards editoriales (countdown + progreso).
export default async function TusViajesPage() {
  const profile = await requireOnboarded();
  const supabase = await createClient();
  const { data: trips } = await supabase
    .from("trips")
    .select(
      "id, lugar, ocasiones, fecha_inicio, fecha_fin, paradas, weather, bolsas, maleta, capsule_target, capsule_match, overrides, empacado, outfits"
    )
    .eq("user_id", profile.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  const hoy = new Date().toISOString().slice(0, 10);
  const rows = (trips ?? []) as TripRowDb[];
  // Una sola resolución para todas las cards: catálogo → generada → genérica.
  const fotos = await fotosDeViajes(
    supabase,
    rows.map((t) => ({ lugar: t.lugar, ocasiones: t.ocasiones }))
  );
  const proximos = rows
    .filter((t) => t.fecha_fin >= hoy)
    .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
  const pasados = rows
    .filter((t) => t.fecha_fin < hoy)
    .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio));

  return (
    <AppShell desktop="wide">
      <section className="flex flex-col gap-4 pt-1">
        <div className="flex items-end justify-between gap-3 pt-3">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[30px] font-bold leading-none tracking-[-0.025em] text-ink lg:text-[40px]">
              modo viaje
            </h1>
            <p className="text-[13px] text-muted lg:text-sm">
              arma una maleta para tu próximo viaje, o abre una guardada.
            </p>
          </div>
          {/* CTA de desktop: link discreto arriba a la derecha (la card grande es de móvil) */}
          <Link
            href="/viaje"
            className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold text-ink hover:underline lg:flex"
          >
            <Icon name="mas" size={15} strokeWidth={2} /> nuevo viaje
          </Link>
        </div>

        <Link
          href="/viaje"
          className="flex items-center gap-3 rounded-sm border border-accent bg-surface p-[13px] transition-colors hover:bg-accent-soft lg:hidden"
        >
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-sm bg-accent text-on-accent">
            <Icon name="mas" size={18} strokeWidth={2} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold text-ink">armar una maleta nueva</span>
            <span className="display text-[13px] text-muted">dime a dónde y para cuándo</span>
          </span>
          <Icon name="chevron" size={16} className="ml-auto shrink-0 text-ink" />
        </Link>

        {rows.length > 0 ? (
          <>
            {/* Móvil (handoff viaje 2): fila grande — la foto del destino a
                sangre (96px de ancho, toda la altura) y el destino en serif
                itálica, único nombre propio de la fila. Lo multidestino se
                dice con TEXTO: eyebrow "· 3 paradas" y la ruta en el renglón
                de fechas — nunca collage. */}
            <div className="flex flex-col gap-3 lg:hidden">
              {rows.map((t) => {
                const paradas = Array.isArray(t.paradas) ? (t.paradas as Parada[]) : [];
                const nParadas = paradas.length || 1;
                // El eyebrow y el estado vienen de derive() — la MISMA regla
                // que las cards de desktop, no una copia que derive aparte.
                const d = derive(t, hoy);
                const ruta = rutaDeViaje(paradas);
                return (
                  <Link
                    key={t.id}
                    href={`/viaje/${t.id}`}
                    className={`flex min-h-[82px] items-stretch overflow-hidden rounded-md border border-line bg-surface transition-colors hover:border-accent ${
                      d.pasado ? "opacity-65 hover:opacity-100" : ""
                    }`}
                  >
                    <span className="relative block w-24 shrink-0 bg-tile">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={fotos.get(t.lugar) ?? "/destinos/ciudad.webp"}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col justify-center px-3.5 py-3">
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-faint">
                        {d.eyebrow}
                        {nParadas > 1 ? ` · ${nParadas} paradas` : ""}
                      </span>
                      <span className="display mt-0.5 truncate text-[22px] italic leading-[1.1] text-ink">
                        {nombreDeViaje(t.lugar, paradas)}
                      </span>
                      <span className="tabular mt-[3px] truncate text-[12.5px] text-muted">
                        {rangoFechas(t.fecha_inicio, t.fecha_fin)} · {d.dias} días
                        {ruta ? ` · ${ruta}` : ""}
                      </span>
                    </span>
                    <Icon
                      name="chevron"
                      size={16}
                      className="mr-3 shrink-0 self-center text-muted"
                    />
                  </Link>
                );
              })}
            </div>

            {/* Desktop: Próximos / Pasados con cards editoriales */}
            <div className="hidden flex-col gap-7 pt-2 lg:flex">
              {proximos.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted">
                    Próximos
                  </span>
                  <div className="grid grid-cols-2 gap-4">
                    {proximos.map((t) => (
                      <TripCard key={t.id} t={t} hoy={hoy} foto={fotos.get(t.lugar) ?? "/destinos/ciudad.webp"} />
                    ))}
                  </div>
                </div>
              ) : null}
              {pasados.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted">
                    Pasados
                  </span>
                  <div className="grid grid-cols-2 gap-4">
                    {pasados.map((t) => (
                      <TripCard key={t.id} t={t} hoy={hoy} foto={fotos.get(t.lugar) ?? "/destinos/ciudad.webp"} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted">
            aún no tienes viajes guardados.
          </p>
        )}
      </section>
    </AppShell>
  );
}
