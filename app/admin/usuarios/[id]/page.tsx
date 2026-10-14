import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { origenEnPalabras } from "@/lib/admin/campana";
import { esDispositivo } from "@/lib/dispositivo";
import { lugarEnPalabras } from "@/lib/lugar";
import { origenDesdeDato } from "@/lib/origen";
import { isMinor } from "@/lib/edad";
import { construirFeed, etiqueta, ultimoUsoPorUsuario, vueltas } from "@/lib/admin/actividad";
import { DIAS_VENTANA, ZONA, diaEnZona, horaEnZona, sumarDias } from "@/lib/admin/adquisicion";
import { diasEntre } from "@/lib/admin/retencion";
import { ITEM_IMAGE_SELECT, itemImageUrlSync, itemPrivatePaths, type ItemImageRow } from "@/lib/item-image";
import { PASOS, tiemposDe } from "@/lib/admin/embudo";
import { Checkpoints } from "../../_compartido/checkpoints";
import { AlFinal, Ampliable, Chip, Cifra, Fila, Lista, Panel, Quien, Renglon, Vacio } from "../../_ui";
import { parecidoConSugerido, parecidoEnPalabras } from "@/lib/senal-oro";
import { duracion, resumir, sesiones, type Resumen } from "@/lib/admin/sesiones";

// LA FICHA DE UNA PERSONA (mockup aprobado el 2026-10-13). Lo que Roberto
// pregunta de alguien es siempre lo mismo: quién es, de dónde llegó, qué hizo
// y si volvió. El encabezado contesta "quién y de dónde"; las cuatro cifras,
// lo que importa del experimento (primer look, ropa propia, volvió, último
// uso); "hasta dónde llegó" y "qué hizo" contestan el resto; el perfil, el
// clóset y los looks van abiertos debajo, sin acordeones.

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

/** "lun 12 oct" */
function fechaCorta(dia: string): string {
  return new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** "12 oct" */
function diaMes(dia: string): string {
  return new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
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
      .select("id, title, explanation, occasion, item_ids, created_at, tryon_path, photo_path, source")
      .eq("user_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("events").select("type, outfit_id").eq("user_id", id).in("type", ["vote_up", "vote_down", "worn"]),
    // La actividad: el MISMO cruce de fuentes que /admin/actividad, acotado a
    // esta persona (añadir prendas no escribe evento; sale de `items`).
    supabase.from("events").select("user_id, outfit_id, type, data, created_at").eq("user_id", id),
    supabase.from("items").select("id, user_id, source, created_at, deleted_at").eq("user_id", id),
    supabase.from("outfits").select("id, user_id, created_at, deleted_at, source").eq("user_id", id),
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
      // La foto del espejo: lo que la persona se puso, la prueba de la señal de oro.
      ...(outfits ?? []).map((o) => o.photo_path as string | null),
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
  const ayer = sumarDias(hoy, -1);
  const regresos = vueltas(feed, new Map([[id, inicio]]));
  const diasQueVolvio = [...new Set([...regresos.values()])].sort((a, b) => a - b);
  const diaDeSuSemana = diasEntre(diaInicio, hoy);
  const enSuSemana = diaDeSuSemana <= DIAS_VENTANA;

  // La línea de tiempo, por día desde que empezó.
  const porDiaCrudo: { dia: string; n: number; momentos: typeof feed }[] = [];
  for (const m of feed) {
    const dia = diaEnZona(new Date(m.at));
    const ultimo = porDiaCrudo[porDiaCrudo.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.momentos.push(m);
    else porDiaCrudo.push({ dia, n: diasEntre(diaInicio, dia), momentos: [m] });
  }
  // Cada día, resumido por sesión y por módulo (lib/admin/sesiones.ts): la
  // lista cruda llegó a 212 renglones en una sola ficha.
  const porDia = porDiaCrudo.map((d) => ({ ...d, sesiones: sesiones(d.momentos), resumen: resumir(d.momentos) }));
  const sesionesDeLaPersona = porDia.flatMap((d) => d.sesiones.filter((x) => !x.soloSistema));
  const totalSesiones = sesionesDeLaPersona.length;
  const totalMinutos = sesionesDeLaPersona.reduce((t, x) => t + x.minutos, 0);

  const ultimoUso = ultimoUsoPorUsuario(fuentes).get(id) ?? null;
  const ultimoMomento = feed.reduce<(typeof feed)[number] | null>((u, m) => (!u || m.at > u.at ? m : u), null);

  // Los checkpoints: los mismos escalones del embudo (lib/admin/embudo.ts),
  // con la hora en que pasó por cada uno.
  const tiempos = tiemposDe({
    id,
    etiqueta: "",
    eventos: (actEvents ?? [])
      .filter((e) => e.created_at)
      .map((e) => ({ type: String(e.type), data: e.data as Record<string, unknown> | null, at: new Date(e.created_at as string).toISOString() })),
    primeraFoto:
      (actItems ?? [])
        .filter((i) => i.source === "photo" && i.created_at)
        .map((i) => new Date(i.created_at as string).toISOString())
        .sort()[0] ?? null,
    volvio: feed.filter((m) => regresos.has(m.key)).map((m) => m.at).sort()[0] ?? null,
    ultimaActividad: ultimoUso ?? inicio,
  });
  const checkpoints = PASOS.map((p) => ({ id: p.id, label: p.label, cuando: tiempos[p.id] ?? null }));
  const ttv = (ttvEvent?.data as { seconds?: number } | null)?.seconds;
  const llegoAlLook = profile.onboarding_step >= 5;
  const fotos = items.filter((i) => i.source === "photo").length;
  const arch = profile.style_archetype as { nombre?: string; descripcion?: string } | null;
  const paleta = [profile.palette_season, profile.palette_flow].filter(Boolean).join(" + ");
  const lugar = lugarEnPalabras(profile.pais, profile.region);
  const aparato = esDispositivo(profile.dispositivo) ? profile.dispositivo : null;
  const variante = profile.onboarding_variante as string | null;
  const origen = origenEnPalabras(origenDesdeDato(profile.origen), profile.como_nos_conocio ?? null);
  const empezo = diaInicio === hoy ? "hoy" : diaInicio === ayer ? "ayer" : null;

  return (
    <>
      <Link href="/admin/usuarios" className="mb-3 inline-block text-[13px] text-muted hover:text-ink">
        ← Personas
      </Link>

      <header className="mb-5 grid grid-cols-[auto_1fr] items-start gap-x-5 gap-y-3 sm:grid-cols-[auto_1fr_auto]">
        <Ampliable imagen={avatarUrl} nombre="Su avatar" className="relative block h-24 w-18 overflow-hidden rounded-lg border border-line bg-tile">
          {avatarUrl ? <Image src={avatarUrl} alt="Avatar" fill sizes="72px" className="object-cover" unoptimized /> : null}
        </Ampliable>
        <div className="min-w-0">
          <Quien correo={profile.email} pais={profile.pais} className="max-w-full text-h2 font-bold tracking-[-0.025em]" />
          <p className="mt-1 text-sm text-muted">
            {lugar ? `${lugar} · ` : ""}
            llegó por <b className="font-semibold text-ink2">{origen}</b>
            {" · "}empezó{" "}
            <b className="font-semibold text-ink2">{empezo ?? fechaCorta(diaInicio)}</b>
            {empezo ? ` ${diaMes(diaInicio)}` : ""} a las {horaEnZona(inicio)}
            {aparato ? ` · ${aparato}` : ""}
          </p>
        </div>
        {llegoAlLook ? (
          <a
            href={`/admin/ver-como/${profile.id}`}
            className="col-start-2 inline-flex h-9 items-center justify-self-start rounded-sm bg-ink px-3.5 text-[13px] font-semibold text-on-accent transition-opacity duration-200 hover:opacity-80 sm:col-start-3 sm:justify-self-end"
          >
            Ver su app
          </a>
        ) : null}
      </header>

      <Fila cols={4}>
        <Cifra
          label="Primer look"
          valor={ttv != null ? ttvHumano(ttv) : llegoAlLook ? "sí" : "no llegó"}
          unidad={llegoAlLook ? "la promesa son 2 min" : undefined}
          sub={
            !llegoAlLook
              ? `se quedó en el paso ${profile.onboarding_step} del onboarding`
              : variante === "fotos"
                ? "con 3 fotos del carrete (prueba A/B)"
                : undefined
          }
        />
        <Cifra label="Ropa propia" valor={fotos} unidad="prendas con foto" sub={`${items.length} en el clóset en total`} />
        <Cifra
          label="Volvió"
          valor={diasQueVolvio.length ? `${diasQueVolvio.length} ${diasQueVolvio.length === 1 ? "vez" : "veces"}` : enSuSemana ? "todavía no" : "no volvió"}
          unidad={
            diasQueVolvio.length
              ? `día${diasQueVolvio.length === 1 ? "" : "s"} ${diasQueVolvio.join(", ")}`
              : enSuSemana
                ? `día ${diaDeSuSemana} de ${DIAS_VENTANA}`
                : undefined
          }
          sub={!diasQueVolvio.length && enSuSemana ? `cuenta si entra otro día antes del ${diaMes(sumarDias(diaInicio, DIAS_VENTANA + 1))}` : undefined}
          tono={diasQueVolvio.length ? "success" : "ink"}
        />
        <Cifra
          label="Último uso"
          valor={hace(ultimoUso)}
          sub={ultimoMomento ? `${etiqueta(ultimoMomento)} a las ${horaEnZona(ultimoMomento.at)}` : undefined}
        />
      </Fila>

      <Fila cols="2-3">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel titulo="Hasta dónde llegó">
            <Checkpoints pasos={checkpoints} />
          </Panel>

          <Panel titulo="Perfil">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 sm:grid-cols-[7rem_1fr]">
              <dt className="text-[13px] text-muted">Género</dt>
              <dd className="text-sm text-ink">{profile.gender ?? "—"}</dd>
              <dt className="text-[13px] text-muted">Edad</dt>
              <dd className="text-sm text-ink">
                {profile.age_range
                  ? `${profile.age_range}${
                      isMinor(profile.age_range)
                        ? profile.minor_consent_verified_at
                          ? " · menor (permiso confirmado vía link ✓)"
                          : profile.minor_ack_at
                            ? " · menor (declarado, tutor SIN confirmar)"
                            : " · menor (sin permiso)"
                        : ""
                    }`
                  : "—"}
              </dd>
              <dt className="text-[13px] text-muted">Colorimetría</dt>
              <dd className="text-sm text-ink">{paleta || "—"}</dd>
              <dt className="text-[13px] text-muted">Estilo</dt>
              <dd className="text-sm text-ink">{arch?.nombre ?? "—"}</dd>
              <dt className="text-[13px] text-muted">Gustos</dt>
              <dd className="text-sm text-ink">{(profile.taste_tags ?? []).slice(0, 6).join(", ") || "—"}</dd>
              <dt className="text-[13px] text-muted">Onboarding</dt>
              <dd className="text-sm text-ink">{variante === "fotos" ? "3 fotos (prueba A/B)" : "lista de básicos"}</dd>
              <dt className="text-[13px] text-muted">Aparato</dt>
              <dd className="text-sm text-ink">{aparato ?? "—"}</dd>
              <dt className="text-[13px] text-muted">País</dt>
              <dd className="text-sm text-ink">{lugar ?? "—"}</dd>
              <dt className="text-[13px] text-muted">Avatar</dt>
              <dd className="text-sm text-ink">{avatarUrl ? "sí" : "no"}</dd>
            </dl>
            {arch?.descripcion ? <p className="editorial mt-3 text-sm text-muted">“{arch.descripcion}”</p> : null}
          </Panel>
        </div>

        <Panel
          titulo="Qué hizo"
          extra={totalSesiones > 0 ? `${totalSesiones} sesion${totalSesiones === 1 ? "" : "es"} en ${porDia.length} día${porDia.length === 1 ? "" : "s"} · ${duracion(totalMinutos)}` : undefined}
          sinPadding
        >
          {porDia.length === 0 ? (
            <Vacio>Sin actividad registrada.</Vacio>
          ) : (
            porDia.map((d, k) => {
              const volvio = d.momentos.some((m) => regresos.has(m.key));
              const deLaPersona = d.sesiones.filter((x) => !x.soloSistema);
              const minutos = deLaPersona.reduce((t, x) => t + x.minutos, 0);
              const sistema = d.sesiones.filter((x) => x.soloSistema);
              return (
                // El día más reciente abierto; los demás, cerrados en su resumen.
                <details key={d.dia} open={k === 0} className={`group ${k > 0 ? "border-t border-line" : ""}`}>
                  <summary className="cursor-pointer list-none px-5 pb-3 pt-4 [&::-webkit-details-marker]:hidden">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="w-2 text-[10px] text-faint transition-transform group-open:rotate-90">▶</span>
                      <b className="text-sm text-ink">Día {d.n}</b>
                      <span>
                        {d.dia === hoy ? `hoy, ${fechaCorta(d.dia)}` : d.dia === ayer ? `ayer, ${fechaCorta(d.dia)}` : fechaCorta(d.dia)}
                      </span>
                      {volvio ? <Chip tono="success">volvió</Chip> : null}
                      <span className="ml-auto tabular-nums">
                        {deLaPersona.length} sesion{deLaPersona.length === 1 ? "" : "es"} · {duracion(minutos)}
                      </span>
                    </div>
                    <ResumenEnChips resumen={d.resumen} />
                  </summary>
                  <ul className="flex flex-col">
                    {d.sesiones.map((x) => (
                      <li key={x.desde} className="flex items-baseline gap-3 border-t border-line2 px-5 py-2.5 text-[13px]">
                        <span className="w-24 shrink-0 text-xs tabular-nums text-faint">
                          {horaEnZona(x.desde)}
                          {x.desde === x.hasta ? "" : `–${horaEnZona(x.hasta)}`}
                        </span>
                        <span className={`min-w-0 flex-1 ${x.soloSistema || x.soloAbrio ? "text-faint" : "leading-normal text-ink2"}`}>
                          {x.soloAbrio ? (
                            "sólo abrió la app"
                          ) : x.soloSistema ? (
                            `la app dibujó ${x.resumen.sistema} prenda${x.resumen.sistema === 1 ? "" : "s"} sola, no fue la persona`
                          ) : (
                            <>
                              {x.resumen.modulos.map((mod, j) => (
                                <span key={mod.modulo}>
                                  {j > 0 ? " · " : ""}
                                  <b className="text-ink">{mod.nombre}:</b> {mod.partes.join(", ")}
                                </span>
                              ))}
                              {x.resumen.sistema > 0 ? <span className="text-faint"> · la app dibujó {x.resumen.sistema} sola</span> : null}
                            </>
                          )}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted">{x.soloSistema ? "" : duracion(x.minutos)}</span>
                      </li>
                    ))}
                  </ul>
                  {/* El detalle de siempre, a un clic: nada se pierde. */}
                  <details className="border-t border-line2">
                    <summary className="cursor-pointer list-none py-2.5 pl-32 pr-5 text-xs text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
                      ver los {d.momentos.length} momento{d.momentos.length === 1 ? "" : "s"}
                      {sistema.length > 0 ? " (con lo que hizo la app)" : ""}
                    </summary>
                    <Lista>
                      {d.momentos.map((m) => {
                        const x = m.data as { seconds?: number; step?: number } | null;
                        const primerLook = m.tipo === "ev:first_outfit_ttv";
                        const extra =
                          primerLook && typeof x?.seconds === "number"
                            ? `en ${ttvHumano(x.seconds)}`
                            : m.tipo === "ev:onboarding_step" && typeof x?.step === "number"
                              ? `paso ${x.step}`
                              : m.tipo === "alta"
                                ? origen
                                : null;
                        const apagado = m.tipo === "visita" || m.tipo === "ev:render_auto";
                        return (
                          <Renglon key={m.key}>
                            <span className="w-10 shrink-0 text-xs tabular-nums text-faint">{horaEnZona(m.at)}</span>
                            <span className={`min-w-0 flex-1 text-sm ${apagado ? "text-muted" : "text-ink"} ${primerLook ? "font-bold" : ""}`}>
                              {etiqueta(m)}
                              {extra ? <span className="font-normal text-muted"> · {extra}</span> : null}
                            </span>
                          </Renglon>
                        );
                      })}
                    </Lista>
                  </details>
                </details>
              );
            })
          )}
        </Panel>
      </Fila>

      <Fila cols={2}>
        <Panel
          titulo={
            <>
              Clóset{" "}
              <span className="font-normal text-muted">
                · {items.length} prenda{items.length === 1 ? "" : "s"}
                {fotos ? `, ${fotos} con foto` : ""}
              </span>
            </>
          }
        >
          {items.length === 0 ? (
            <p className="text-sm text-muted">Clóset vacío.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
              {items.map((it) => {
                const p = prendaById.get(it.id)!;
                return (
                  <Ampliable
                    key={it.id}
                    imagen={p.imagen}
                    nombre={p.nombre}
                    sub={it.source === "photo" ? "subida con foto" : "del catálogo"}
                    className="relative block aspect-square overflow-hidden rounded-md border border-line bg-tile"
                  >
                    {p.imagen ? (
                      <Image src={p.imagen} alt={p.nombre} fill sizes="120px" className="object-cover" unoptimized />
                    ) : (
                      <div className="h-full w-full" style={{ backgroundColor: p.swatch }} />
                    )}
                    {it.source === "photo" ? <span className="absolute bottom-0.5 right-1 text-[11px]">📷</span> : null}
                  </Ampliable>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          titulo={
            <>
              Looks <span className="font-normal text-muted">· {outfits?.length ?? 0}</span>
            </>
          }
          sinPadding
        >
          {(outfits ?? []).length === 0 ? (
            <Vacio>Sin looks aún.</Vacio>
          ) : (
            <Lista>
              {(outfits ?? []).map((o) => {
                const esEspejo = (o.source as string | null) === "espejo";
                // En un espejo la imagen es SU foto; en un look, el try-on si lo pidió.
                const ruta = (esEspejo ? o.photo_path : o.tryon_path) as string | null;
                const tryon = ruta ? (signed.get(ruta) ?? null) : null;
                const parecido = esEspejo
                  ? parecidoConSugerido(
                      { itemIds: (o.item_ids as string[]) ?? [], createdAt: new Date(o.created_at).toISOString() },
                      (outfits ?? [])
                        .filter((l) => (l.source as string | null) !== "espejo")
                        .map((l) => ({
                          id: l.id as string,
                          titulo: (l.title as string | null) ?? null,
                          itemIds: (l.item_ids as string[]) ?? [],
                          createdAt: new Date(l.created_at).toISOString(),
                        }))
                    )
                  : null;
                const prendas = (o.item_ids as string[]).map(
                  (pid) => prendaById.get(pid) ?? { nombre: "Prenda", swatch: "#E5E1DD", imagen: null }
                );
                return (
                  <Renglon key={o.id} className="items-start py-3">
                    {tryon ? (
                      <Ampliable
                        imagen={tryon}
                        nombre={o.title ?? "Look"}
                        sub={o.explanation ?? null}
                        className="relative block h-16 w-12 shrink-0 overflow-hidden rounded-md border border-line bg-tile"
                      >
                        <Image src={tryon} alt={o.title ?? "Look"} fill sizes="48px" className="object-cover" unoptimized />
                      </Ampliable>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">
                        <b className="text-ink">
                          {o.title ?? "Look"}
                          {(o.source as string | null) === "viaje" ? " ✈️" : ""}
                          {esEspejo ? " 🪞" : ""}
                        </b>
                        <span className="text-[13px] text-muted">
                          {" · "}
                          {new Date(o.created_at).toLocaleDateString("es-MX", { timeZone: ZONA, day: "numeric", month: "short" })}
                          {o.occasion ? ` · ${o.occasion}` : ""}
                        </span>
                      </div>
                      {o.explanation ? <p className="truncate text-[13px] text-muted">{o.explanation}</p> : null}
                      {parecido ? <p className="text-[13px] text-ink2">{parecidoEnPalabras(parecido)}</p> : null}
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {prendas.map((p, k) => (
                          <Ampliable
                            key={k}
                            imagen={p.imagen}
                            nombre={p.nombre}
                            className="relative block h-6 w-6 overflow-hidden rounded-sm border border-line bg-tile"
                          >
                            {p.imagen ? (
                              <Image src={p.imagen} alt={p.nombre} fill sizes="24px" className="object-cover" unoptimized />
                            ) : (
                              <div className="h-full w-full" style={{ backgroundColor: p.swatch }} />
                            )}
                          </Ampliable>
                        ))}
                      </div>
                    </div>
                    <AlFinal>
                      {voteOf.get(o.id) ?? ""}
                      {wornSet.has(o.id) ? <span className="ml-1.5 text-success">✓ puesto</span> : null}
                    </AlFinal>
                  </Renglon>
                );
              })}
            </Lista>
          )}
        </Panel>
      </Fila>
    </>
  );
}

/** El día en una línea: un chip por módulo con lo que pasó en él. */
function ResumenEnChips({ resumen }: { resumen: Resumen }) {
  if (resumen.modulos.length === 0 && resumen.sistema === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5 pl-4">
      {resumen.modulos.map((mod) => (
        <span key={mod.modulo} className="rounded-md bg-tile px-2 py-1 text-xs text-ink2">
          <b className="text-ink">{mod.nombre}</b> {mod.partes.join(" · ")}
        </span>
      ))}
      {resumen.sistema > 0 ? (
        <span className="rounded-md px-2 py-1 text-xs text-faint">la app dibujó {resumen.sistema} prenda{resumen.sistema === 1 ? "" : "s"}</span>
      ) : null}
    </div>
  );
}
