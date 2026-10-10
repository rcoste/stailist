import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { origenEnPalabras } from "@/lib/admin/campana";
import { esDispositivo } from "@/lib/dispositivo";
import { banderaDe, lugarEnPalabras } from "@/lib/lugar";
import { origenDesdeDato } from "@/lib/origen";
import { isMinor } from "@/lib/edad";
import { construirFeed, etiqueta, ultimoUsoPorUsuario, vueltas } from "@/lib/admin/actividad";
import { DIAS_VENTANA, ZONA, diaEnZona, horaEnZona } from "@/lib/admin/adquisicion";
import { diasEntre } from "@/lib/admin/retencion";
import { ITEM_IMAGE_SELECT, itemImageUrlSync, itemPrivatePaths, type ItemImageRow } from "@/lib/item-image";

// LA FICHA DE UNA PERSONA, con la línea de tiempo primero (replanteo del
// admin, 2026-10-09). Lo que Roberto pregunta de alguien es siempre lo mismo:
// quién es, de dónde llegó, qué hizo y si volvió. Antes la ficha abría con una
// retícula de doce campos y el historial venía después; ahora el encabezado
// contesta "quién y de dónde", la línea de tiempo (agrupada por día desde que
// empezó, con la marca de cada regreso) contesta "qué hizo y si volvió", y el
// perfil, el clóset y los looks quedan plegados debajo.

// "Cuándo" en lenguaje humano (mismo criterio que la lista).
function hace(iso: string | null | undefined): string {
  if (!iso) return "nunca";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} ${d === 1 ? "día" : "días"}`;
  const mo = Math.floor(d / 30);
  return `hace ${mo} ${mo === 1 ? "mes" : "meses"}`;
}

function ttvHumano(seconds: number): string {
  if (seconds < 120) return `${Math.round(seconds)} s`;
  const min = seconds / 60;
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} días`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}

function fechaCorta(dia: string): string {
  return new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

type ItemRow = ItemImageRow & { id: string; source: string | null };

export default async function FichaPersona({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (!profile) notFound();

  const [
    { data: itemsRaw },
    { data: outfits },
    { data: events },
    { data: actEvents },
    { data: actItems },
    { data: actOutfits },
    { data: actTrips },
    { data: actWishlist },
    { data: ttvEvent },
  ] = await Promise.all([
    supabase.from("items").select(`id, source, ${ITEM_IMAGE_SELECT}`).eq("user_id", id),
    supabase
      .from("outfits")
      .select("id, title, explanation, occasion, item_ids, created_at, tryon_path, source")
      .eq("user_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("events").select("type, outfit_id").eq("user_id", id).in("type", ["vote_up", "vote_down", "worn"]),
    // La actividad: el MISMO cruce de fuentes que /admin/actividad, acotado a
    // esta persona (añadir prendas no escribe evento; sale de `items`).
    supabase.from("events").select("user_id, outfit_id, type, data, created_at").eq("user_id", id),
    supabase.from("items").select("id, user_id, created_at, deleted_at").eq("user_id", id),
    supabase.from("outfits").select("id, user_id, created_at, deleted_at").eq("user_id", id),
    supabase.from("trips").select("id, user_id, created_at, deleted_at").eq("user_id", id),
    supabase.from("wishlist_items").select("user_id, created_at").eq("user_id", id),
    supabase.from("events").select("data").eq("user_id", id).eq("type", "first_outfit_ttv").limit(1).maybeSingle(),
  ]);
  const items = (itemsRaw ?? []) as unknown as ItemRow[];

  // Firmar en un solo batch: avatar + try-ons + paths privados de prendas.
  const toSign = [
    ...new Set([
      profile.avatar_path as string | null,
      ...(outfits ?? []).map((o) => o.tryon_path as string | null),
      ...items.flatMap((i) => itemPrivatePaths(i)),
    ]),
  ].filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (toSign.length > 0) {
    const { data } = await supabase.storage.from("prendas").createSignedUrls(toSign, 3600);
    data?.forEach((s) => {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    });
  }
  const avatarUrl = profile.avatar_path ? (signed.get(profile.avatar_path) ?? null) : null;

  const prendaById = new Map<string, { nombre: string; swatch: string; imagen: string | null }>(
    items.map((i) => {
      const attrs = (i.attrs ?? {}) as { nombre?: string; color_hex?: string };
      return [
        i.id,
        {
          nombre: i.archetypes?.name ?? attrs.nombre ?? "Prenda",
          swatch: attrs.color_hex ?? "#E5E1DD",
          imagen: itemImageUrlSync(i, (p) => signed.get(p)),
        },
      ];
    })
  );

  const voteOf = new Map<string, string>();
  const wornSet = new Set<string>();
  for (const e of events ?? []) {
    if (!e.outfit_id) continue;
    if (e.type === "worn") wornSet.add(e.outfit_id);
    else voteOf.set(e.outfit_id, e.type === "vote_up" ? "👍" : "👎");
  }

  const fuentes = {
    items: (actItems ?? []) as never,
    outfits: (actOutfits ?? []) as never,
    trips: (actTrips ?? []) as never,
    wishlist: (actWishlist ?? []) as never,
    events: (actEvents ?? []) as never,
  };
  const feed = construirFeed({ profiles: [{ id, created_at: profile.created_at }], ...fuentes });

  // Desde cuándo se cuenta: el arranque del onboarding, o el alta si no lo hay.
  const inicio: string = (profile.onboarding_started_at as string | null) ?? (profile.created_at as string);
  const diaInicio = diaEnZona(new Date(inicio));
  const hoy = diaEnZona(new Date());
  const regresos = vueltas(feed, new Map([[id, inicio]]));
  const diasQueVolvio = [...new Set([...regresos.values()])].sort((a, b) => a - b);
  const enSuSemana = diasEntre(diaInicio, hoy) <= DIAS_VENTANA;

  // La línea de tiempo, por día desde que empezó.
  const porDia: { dia: string; n: number; momentos: typeof feed }[] = [];
  for (const m of feed) {
    const dia = diaEnZona(new Date(m.at));
    const ultimo = porDia[porDia.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.momentos.push(m);
    else porDia.push({ dia, n: diasEntre(diaInicio, dia), momentos: [m] });
  }

  const ultimoUso = ultimoUsoPorUsuario(fuentes).get(id) ?? null;
  const ttv = (ttvEvent?.data as { seconds?: number } | null)?.seconds;
  const fotos = items.filter((i) => i.source === "photo").length;
  const arch = profile.style_archetype as { nombre?: string; descripcion?: string } | null;
  const paleta = [profile.palette_season, profile.palette_flow].filter(Boolean).join(" + ");
  const lugar = lugarEnPalabras(profile.pais, profile.region);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/usuarios" className="text-sm text-muted hover:text-ink">
        ← Personas
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row">
        {avatarUrl ? (
          <div className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-lg border border-line bg-surface sm:w-28">
            <Image src={avatarUrl} alt="Avatar" fill sizes="112px" className="object-cover" unoptimized />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="text-h2 font-semibold text-ink">
                {banderaDe(profile.pais) ? <span className="mr-2">{banderaDe(profile.pais)}</span> : null}
                {profile.email ?? "(sin correo todavía)"}
              </h1>
              <p className="text-sm text-muted">
                Llegó por <b className="text-ink">{origenEnPalabras(origenDesdeDato(profile.origen), profile.como_nos_conocio ?? null)}</b>
                {" · "}empezó el {fechaCorta(diaInicio)}
                {lugar ? ` · ${lugar}` : ""}
                {esDispositivo(profile.dispositivo) ? ` · ${profile.dispositivo}` : ""}
              </p>
            </div>
            {profile.onboarding_step >= 5 ? (
              <a
                href={`/admin/ver-como/${profile.id}`}
                className="flex min-h-9 shrink-0 items-center rounded-sm bg-ink px-4 text-xs font-medium text-bg transition-opacity duration-200 hover:opacity-80"
              >
                👁 Ver su app
              </a>
            ) : null}
          </div>
          <ul className="flex flex-wrap gap-2 text-xs">
            <li className={`rounded-full border px-2.5 py-1 ${profile.onboarding_step >= 5 ? "border-ink text-ink" : "border-line text-muted"}`}>
              {profile.onboarding_step >= 5 ? `primer look${ttv != null ? ` en ${ttvHumano(ttv)}` : ""}` : `en el paso ${profile.onboarding_step} del onboarding`}
            </li>
            <li className={`rounded-full border px-2.5 py-1 ${fotos > 0 ? "border-ink text-ink" : "border-line text-muted"}`}>
              {fotos > 0 ? `${fotos} prenda${fotos === 1 ? "" : "s"} con foto` : "sin ropa propia"}
            </li>
            <li
              className={`rounded-full border px-2.5 py-1 ${
                diasQueVolvio.length ? "border-success text-success" : "border-line text-muted"
              }`}
            >
              {diasQueVolvio.length
                ? `volvió ${diasQueVolvio.length === 1 ? "una vez" : `${diasQueVolvio.length} veces`} (día${diasQueVolvio.length === 1 ? "" : "s"} ${diasQueVolvio.join(", ")})`
                : enSuSemana
                  ? "todavía en su primera semana"
                  : "no volvió"}
            </li>
            <li className="rounded-full border border-line px-2.5 py-1 text-muted">último uso {hace(ultimoUso)}</li>
          </ul>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Línea de tiempo</h2>
        <p className="text-xs text-muted">
          Por día desde que empezó (día 0). “Abrió la app” es una vuelta sin nada más. Las tandas del
          mismo rato se cuentan como una.
        </p>
        {porDia.length === 0 ? (
          <p className="text-sm text-muted">Sin actividad registrada.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {porDia.map((d) => {
              const volvio = d.momentos.find((m) => regresos.has(m.key));
              return (
                <div key={d.dia} className="flex flex-col gap-1">
                  <div className="flex items-baseline gap-2 text-xs">
                    <span className="font-semibold text-ink">día {d.n}</span>
                    <span className="text-muted">{fechaCorta(d.dia)}</span>
                    {volvio ? (
                      <span className="rounded-full border border-success px-1.5 text-[11px] font-semibold text-success">volvió</span>
                    ) : null}
                  </div>
                  <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                    {d.momentos.map((m) => {
                      const x = m.data as { seconds?: number; step?: number } | null;
                      const extra =
                        m.tipo === "ev:first_outfit_ttv" && typeof x?.seconds === "number"
                          ? ` en ${ttvHumano(x.seconds)}`
                          : m.tipo === "ev:onboarding_step" && typeof x?.step === "number"
                            ? ` (paso ${x.step})`
                            : "";
                      return (
                        <li key={m.key} className="flex items-baseline gap-3 px-4 py-2 text-sm">
                          <span className="w-12 shrink-0 tabular-nums text-xs text-faint">{horaEnZona(m.at)}</span>
                          <span className={m.tipo === "visita" ? "text-muted" : "text-ink"}>
                            {etiqueta(m)}
                            {extra}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <details className="rounded-lg border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
          Perfil
          <span className="ml-2 text-xs font-normal text-muted">
            {[profile.gender, profile.age_range, paleta || null, arch?.nombre ?? null].filter(Boolean).join(" · ") || "sin datos"}
          </span>
        </summary>
        <div className="grid grid-cols-2 gap-4 border-t border-line p-4 sm:grid-cols-3">
          <Field label="Género" value={profile.gender ?? "—"} />
          <Field
            label="Edad"
            value={
              profile.age_range
                ? `${profile.age_range}${
                    isMinor(profile.age_range)
                      ? profile.minor_consent_verified_at
                        ? " · menor (permiso confirmado vía link ✓)"
                        : profile.minor_ack_at
                          ? " · menor (declarado, tutor SIN confirmar)"
                          : " · menor (sin permiso)"
                      : ""
                  }`
                : "—"
            }
          />
          <Field label="Colorimetría" value={paleta || "—"} />
          <Field label="Objetivo" value={profile.last_objective ?? "—"} />
          <Field label="Estilo" value={arch?.nombre ?? "—"} />
          <Field label="Gustos" value={(profile.taste_tags ?? []).slice(0, 6).join(", ") || "—"} />
          <Field label="Aparato" value={esDispositivo(profile.dispositivo) ? profile.dispositivo : "—"} />
          <Field label="País" value={lugar ?? "—"} />
          <Field label="Avatar" value={avatarUrl ? "sí" : "no"} />
          {arch?.descripcion ? (
            <p className="editorial col-span-full text-sm text-muted">“{arch.descripcion}”</p>
          ) : null}
        </div>
      </details>

      <details className="rounded-lg border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
          Clóset
          <span className="ml-2 text-xs font-normal text-muted">
            {items.length} prenda{items.length === 1 ? "" : "s"}
            {fotos ? ` · ${fotos} con foto 📷` : ""}
          </span>
        </summary>
        <div className="border-t border-line p-4">
          {items.length === 0 ? (
            <span className="text-sm text-muted">Clóset vacío.</span>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
              {items.map((it) => {
                const p = prendaById.get(it.id)!;
                return (
                  <figure key={it.id} className="flex flex-col gap-1 overflow-hidden rounded-lg border border-line bg-surface">
                    <div className="relative aspect-square w-full">
                      {p.imagen ? (
                        <Image src={p.imagen} alt={p.nombre} fill sizes="120px" className="object-cover" unoptimized />
                      ) : (
                        <div className="h-full w-full" style={{ backgroundColor: p.swatch }} />
                      )}
                    </div>
                    <figcaption className="truncate px-2 pb-1.5 text-xs text-ink">
                      {p.nombre}
                      {it.source === "photo" ? " 📷" : ""}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          )}
        </div>
      </details>

      <details className="rounded-lg border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">
          Looks
          <span className="ml-2 text-xs font-normal text-muted">{outfits?.length ?? 0} (los últimos 20)</span>
        </summary>
        <div className="border-t border-line p-4">
          {(outfits ?? []).length === 0 ? (
            <span className="text-sm text-muted">Sin looks aún.</span>
          ) : (
            <div className="flex flex-col gap-3">
              {(outfits ?? []).map((o) => {
                const tryon = o.tryon_path ? (signed.get(o.tryon_path as string) ?? null) : null;
                const prendas = (o.item_ids as string[]).map(
                  (pid) => prendaById.get(pid) ?? { nombre: "Prenda", swatch: "#E5E1DD", imagen: null }
                );
                return (
                  <div key={o.id} className="flex gap-3 rounded-lg border border-line bg-surface p-3">
                    {tryon ? (
                      <div className="relative aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-lg border border-line sm:w-24">
                        <Image src={tryon} alt={o.title ?? "Look"} fill sizes="96px" className="object-cover" unoptimized />
                      </div>
                    ) : null}
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium text-ink">
                            {o.title ?? "Look"}
                            {(o.source as string | null) === "viaje" ? " ✈️" : ""}
                          </span>
                          <span className="text-xs text-muted">
                            {new Date(o.created_at).toLocaleDateString("es-MX", { timeZone: ZONA, day: "numeric", month: "short" })}
                            {o.occasion ? ` · ${o.occasion}` : ""}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 text-sm">
                          {voteOf.get(o.id) ?? ""}
                          {wornSet.has(o.id) ? <span className="text-xs text-success">✓ puesto</span> : null}
                        </div>
                      </div>
                      <p className="line-clamp-2 text-xs text-muted">{o.explanation}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {prendas.map((p, k) => (
                          <div key={k} className="relative h-10 w-10 overflow-hidden rounded-md border border-line" title={p.nombre}>
                            {p.imagen ? (
                              <Image src={p.imagen} alt={p.nombre} fill sizes="40px" className="object-cover" unoptimized />
                            ) : (
                              <div className="h-full w-full" style={{ backgroundColor: p.swatch }} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
