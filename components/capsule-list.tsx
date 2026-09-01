"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { CapsuleTabsContext } from "@/components/capsule-tabs-context";
import { Spinner } from "@/components/spinner";
import { OwnedPhotoBanner } from "@/components/owned-photo-banner";
import { PrendaZoom, type PrendaZoomData } from "@/components/prenda-zoom";
import { Toast } from "@/components/toast";
import { faltaImage, familiaToHex, faltaKey } from "@/lib/capsule-images";
import { outfitsNow, unlocksByIndex } from "@/lib/capsule-math";
import {
  dismissCapsuleSlot,
  markFaltaOwned,
  rejectCapsuleItem,
  setCapsuleOverride,
} from "@/app/closet/capsula/actions";
import { toggleWishlistFromCapsule } from "@/lib/wishlist-actions";
import { prewarmRenders, type PrewarmJob } from "@/lib/prewarm-renders";
import { requestItemRender } from "@/lib/render-on-demand";
import { SuggestionCard } from "@/components/suggestion-card";
import { MotivoSheet } from "@/components/motivo-sheet";
import {
  IdealTileInner,
  VER_PRENDA_LABEL,
  idealArgs,
  useIdealRender,
  type RenderArgs,
} from "@/components/ideal-tile";
import {
  capsuleRows,
  type CapsuleDecision,
  type CapsuleMatch,
  type CapsuleOverrides,
  type CapsuleRow,
  type CapsuleSwaps,
  type CapsuleTarget,
  type VetoReason,
  VETO_REASON_LABEL,
} from "@/lib/capsule";

// LAS PIEZAS QUE EL PREWARM YA TIENE EN COLA, para que el tile no mienta.
//
// El bug que esto arregla (Roberto, 2026-08-25): "no está lo de que se
// rendereen automáticamente las imágenes que faltan". El render automático SÍ
// corría —38 de sus 39 piezas acabaron con imagen— pero mientras trabajaba, el
// tile mostraba el botón "ver prenda", que dice justo lo contrario: que hay que
// tocarlo para que pase algo. Con 39 piezas a concurrencia 2 el prewarm tarda
// minutos, así que lo que la persona ve todo ese rato es una pantalla llena de
// botones de "genérala tú". Ahora el tile en cola dice que ya viene.
//
// Va por contexto y no por props porque el tile vive 4 niveles abajo y en seis
// tarjetas distintas; enhebrarlo a mano sería tocar seis firmas para un dato
// que es de la pantalla entera.
const EnColaContext = createContext<Set<string>>(new Set());

// Tope y concurrencia del auto-dibujo de TUS prendas sin foto.
//
// El tope es más bajo que el del prewarm de prendas ideales (40) a propósito, y
// la diferencia es de dinero: un render ideal se guarda en la biblioteca
// COMPARTIDA y lo hereda quien venga después, pero el de tu prenda es tuyo y no
// se amortiza con nadie. 12 cubre los duelos —que se ven grandes— y las
// primeras miniaturas; el resto se queda en su swatch, que es exactamente donde
// estábamos antes de este cambio.
const TOPE_DIBUJO = 12;
const CONCURRENCIA_DIBUJO = 2;

// Pantalla completa de la cápsula, "enfocada en lo que falta" (handoff Screen 4):
// lo faltante al frente con su porqué (bigcard), lo que hay que decidir, y lo que
// ya tienes en una fila de miniaturas. Las decisiones sobre las "parecido" son
// OPTIMISTAS: el tap se ve al instante y el guardado va en segundo plano.
export function CapsuleList({
  target,
  match,
  overrides,
  swaps = null,
  images,
  nameToId = {},
  catalogImages = {},
  savedWishKeys = [],
  userId,
}: {
  target: CapsuleTarget;
  match: CapsuleMatch | null;
  overrides: CapsuleOverrides | null;
  swaps?: CapsuleSwaps | null;
  images: Record<string, string>;
  // nombre → id del clóset (incluye prendas SIN imagen): para auto-dibujar las
  // tuyas que no tienen foto, con el mismo render bajo demanda de la maleta.
  nameToId?: Record<string, string>;
  // Imágenes de la biblioteca compartida (combos ideales ya rendereados), por faltaKey.
  catalogImages?: Record<string, string>;
  // faltaKeys de prendas de cápsula ya guardadas en la wishlist (para el estado del botón).
  savedWishKeys?: string[];
  userId: string;
}) {
  const router = useRouter();
  const [optOverrides, applyOpt] = useOptimistic(
    overrides ?? {},
    (state: CapsuleOverrides, action: { index: number; decision: CapsuleDecision }) => {
      const next = { ...state };
      const k = String(action.index);
      if (next[k] === action.decision) delete next[k]; // re-elegir lo mismo = deshacer
      else next[k] = action.decision;
      return next;
    }
  );
  const [, startTransition] = useTransition();
  // Cambiar a la pestaña "tus looks" desde el CTA "~N looks" (sin navegar).
  const { onViewLooks } = useContext(CapsuleTabsContext);

  // Caché de sesión de renders bajo demanda (por faltaKey). Sin esto, la URL
  // rendereada vive solo en el estado local del tile que la generó y se pierde
  // al remontar (elegir "la sugerida" → SumaCard, o "ya la tengo" → re-render):
  // el tile volvía a "ver cómo queda". Se fusiona sobre catalogImages para que
  // cualquier instancia nueva arranque ya con la imagen.
  const [rendered, setRendered] = useState<Record<string, string>>({});
  const onRendered = useCallback(
    (key: string, url: string) =>
      setRendered((m) => (m[key] === url ? m : { ...m, [key]: url })),
    []
  );
  const catImgs = useMemo(
    () => ({ ...catalogImages, ...rendered }),
    [catalogImages, rendered]
  );

  // TUS prendas sin imagen, auto-dibujadas (pedido de Roberto 2026-08-13): las
  // filas "ya lo tienes" y el lado "la tuya" de los duelos caían al swatch
  // aunque la prenda tuviera id — el render bajo demanda ya existía (maleta,
  // Hoy) y aquí nadie lo conectaba. El server cachea en items.render_path, así
  // que cada prenda se paga una sola vez.
  const [ownImgs, setOwnImgs] = useState<Record<string, string>>({});
  const imgs = useMemo(() => ({ ...images, ...ownImgs }), [images, ownImgs]);

  // "Ya la tengo" sobre una prenda que te falta: el server la suma al clóset y la
  // marca cubierta; al resolver, Next refresca la página y la prenda se reubica
  // sola en "Ya lo tienes" con el progreso al día. Solo llevamos un spinner por
  // botón mientras tanto (la fuente de verdad es el server, sin doble conteo).
  const [ownBusy, setOwnBusy] = useState<Set<number>>(new Set());
  // Tras "ya la tengo": la prenda recién agregada, para ofrecer subir su foto real
  // (no bloqueante). La fila ya se movió a "Ya lo tienes"; el banner vive aparte.
  const [lastOwned, setLastOwned] = useState<{ itemId: string; nombre: string } | null>(null);

  const decide = (index: number, decision: CapsuleDecision) =>
    startTransition(async () => {
      applyOpt({ index, decision });
      await setCapsuleOverride(index, decision);
    });

  // Cuál comparación está abierta (la manda el padre para poder encadenar).
  // ARRANCA EN LA PRIMERA SIN DECIDIR, no en null: con todas colapsadas había
  // que picar para ver una sola comparación, que es el mismo "picar y picar"
  // que Roberto reportó (2026-08-13) y que el viaje ya no tiene. `decidir` se
  // calcula más abajo, así que aquí se replica su criterio —el MISMO de
  // decidirYSeguir— sobre `target/match`, que sí están disponibles.
  const [abierta, setAbierta] = useState<number | null>(() => {
    const pendientes = capsuleRows(target, match, overrides ?? {}, swaps)
      .filter((r) => !r.dismissed && r.base === "parecido" && r.decision === null)
      .sort((a, b) => a.item.prioridad - b.item.prioridad);
    return pendientes[0]?.index ?? null;
  });

  // Visor de prenda: las miniaturas son de 38-46px y no se distingue qué prenda
  // es (pedido de Roberto). Un toque la abre en grande, con nombre — reusa el
  // PrendaZoom de la maleta/looks en vez de inventar otro visor.
  const [zoom, setZoom] = useState<PrendaZoomData | null>(null);
  const zoomDe = (r: CapsuleRow): PrendaZoomData => {
    const { src, kind } = rowImageKind(r, imgs, catImgs);
    // La foto manda: se etiqueta con lo que SE VE. Cuando es tu prenda, el
    // título es TU prenda y abajo qué pieza de la cápsula cubre — al revés se
    // leía como un error de la app (la foto de un traje de baño titulada "Short
    // de lino marino"; lo cachó Roberto). Si se llaman igual, no repitas.
    const mismoNombre = r.by?.trim().toLowerCase() === r.item.nombre.trim().toLowerCase();
    if (kind === "tuya" && r.by) {
      return {
        image: src,
        nombre: r.by,
        sub: mismoNombre ? "en tu clóset" : `de tu clóset · cubre "${r.item.nombre}"`,
      };
    }
    return { image: src, nombre: r.item.nombre, sub: r.item.porque };
  };

  // Decidir desde la comparación: además de guardar, abre la SIGUIENTE sin
  // decidir. Antes volvías al estado neutro y tenías que picarle a la que sigue
  // una por una; en una cápsula con 4-5 pendientes eso son tapping de más.
  const decidirYSeguir = (index: number, decision: CapsuleDecision) => {
    decide(index, decision);
    const quedan = rows
      .filter((r) => r.base === "parecido" && r.decision === null && r.index !== index)
      .sort((a, b) => a.item.prioridad - b.item.prioridad);
    setAbierta(quedan.length ? quedan[0].index : null);
  };

  const setBusy = (index: number, on: boolean) =>
    setOwnBusy((s) => {
      const n = new Set(s);
      if (on) n.add(index);
      else n.delete(index);
      return n;
    });

  const markOwned = (index: number, nombre: string) => {
    // setBusy FUERA del transition → update urgente: el spinner aparece al
    // instante. Dentro del transition era baja prioridad y se sentía muerto.
    setBusy(index, true);
    startTransition(async () => {
      const res = await markFaltaOwned(index);
      setBusy(index, false);
      // Ofrece subir la foto real (opcional) de la prenda recién agregada.
      if (res.ok && res.itemId) setLastOwned({ itemId: res.itemId, nombre });
    });
  };

  // Camino A (issue #89): "no me gusta" sobre una prenda ideal. La generación de la
  // alternativa vive en el server (~4-6s) → mostramos "buscando…" en esa card y al
  // volver refrescamos para que aparezca la alternativa. "otra" reusa el mismo flujo.
  const [swapBusy, setSwapBusy] = useState<Set<number>>(new Set());
  const setSwap = (index: number, on: boolean) =>
    setSwapBusy((s) => {
      const n = new Set(s);
      if (on) n.add(index);
      else n.delete(index);
      return n;
    });
  const [swapError, setSwapError] = useState<Set<number>>(new Set());

  const rejectItem = (index: number, reason: VetoReason | null) => {
    setSwap(index, true);
    setSwapError((s) => {
      const n = new Set(s);
      n.delete(index);
      return n;
    });
    startTransition(async () => {
      const res = await rejectCapsuleItem(index, reason);
      setSwap(index, false);
      if (!res.ok) setSwapError((s) => new Set(s).add(index));
      else router.refresh();
    });
  };

  // "no me va": retira el slot CON su motivo y deja el card en su estado
  // resuelto. Sin router.refresh() a propósito — refrescar borra la fila (los
  // slots retirados no se listan) y el acuse desaparecería en el mismo frame.
  // El handoff es explícito: el card ES el acuse, no hay toast. La cápsula se
  // pone al día en la siguiente carga.
  const [resolved, setResolved] = useState<Map<number, string>>(() => new Map());

  const quitarItem = (index: number, reason: VetoReason) => {
    setResolved((m) => new Map(m).set(index, VETO_REASON_LABEL[reason]));
    startTransition(async () => {
      const res = await dismissCapsuleSlot(index, reason);
      if (!res.ok) {
        setResolved((m) => {
          const n = new Map(m);
          n.delete(index);
          return n;
        });
      }
    });
  };

  // Wishlist in-situ: mandar/quitar una prenda que te falta de "lo que deberías
  // comprar", sin sacarla de su sección. Optimista + toast al guardar. La verdad
  // vive en el server (dedup por faltaKey); al recargar, savedWishKeys se refresca.
  const [wishSaved, setWishSaved] = useState<Set<string>>(() => new Set(savedWishKeys));
  const [toast, setToast] = useState<string | null>(null);

  const toggleWish = (row: CapsuleRow) => {
    const key = faltaKey(row.item);
    const willSave = !wishSaved.has(key);
    setWishSaved((s) => {
      const n = new Set(s);
      if (willSave) n.add(key);
      else n.delete(key);
      return n;
    });
    if (willSave) {
      setToast("Guardada en tu wishlist");
      setTimeout(() => setToast(null), 2200);
    }
    startTransition(async () => {
      await toggleWishlistFromCapsule({
        capsuleKey: key,
        name: row.item.nombre,
        colorHex: familiaToHex(row.item.colorFamilia),
        imageUrl: rowImage(row, imgs, catImgs),
        porque: row.item.porque,
      });
    });
  };

  // Los slots retirados ("quitar"/tope) salen de la lista y de los conteos.
  const rows = capsuleRows(target, match, optOverrides, swaps).filter((r) => !r.dismissed);
  const total = rows.length;
  const have = rows.filter((r) => r.covered).length;
  const pct = total ? Math.round((100 * have) / total) : 0;

  // El gancho: cuántos looks armas hoy + cuántos desbloquea cada prenda que falta.
  // (Optimista: aceptar un "parecido" sube el conteo al instante.)
  const looks = outfitsNow(rows);
  const unlocks = unlocksByIndex(rows);
  const unlockOf = (r: CapsuleRow) => unlocks.get(r.index) ?? 0;
  // ¿Hay alguna prenda que falta que de verdad desbloquee looks? (vs solo accesorios,
  // que rematan pero no multiplican). Evita prometer "desbloquea más" cuando no aplica.
  const maxUnlock = rows.reduce((m, r) => (r.base === "falta" ? Math.max(m, unlockOf(r)) : m), 0);

  // Agrupamos por estado BASE (lo que dijo el match) para que una "parecido" ya
  // decidida no salte de sección. Sin match → todo "pendiente".
  const byPrio = (a: CapsuleRow, b: CapsuleRow) => a.item.prioridad - b.item.prioridad;
  const pendiente = rows.filter((r) => r.base === "pendiente").sort(byPrio);
  const tienes = rows
    .filter((r) => r.base === "tienes" && r.decision !== "reject")
    .sort(byPrio);
  // Lo que falta, ordenado por lo que MÁS te suma (desbloquea más looks); a igualdad, prioridad.
  // Incluye lo que el match dio por resuelto y tú desmentiste: un "parecido" que
  // rechazaste o un "tienes" que dijiste que no cubre. Ambos son huecos reales y
  // llevan las mismas puertas que un hueco de origen.
  const falta = rows
    .filter((r) => r.base === "falta" || (r.base !== "pendiente" && r.decision === "reject"))
    .sort((a, b) => unlockOf(b) - unlockOf(a) || byPrio(a, b));
  const decidir = rows
    .filter((r) => r.base === "parecido" && r.decision !== "reject")
    .sort(byPrio);

  // Las que se ven como CARD GRANDE y todavía no tienen imagen, en el orden en
  // que aparecen. Solo esas: precalentar las 33 costaría un dineral en renders
  // para llenar tiles que la persona ni va a mirar (ver lib/prewarm-renders).
  // `decidir` ENTRA: el duelo enseña la sugerida a tamaño grande y, colapsado,
  // como miniatura de 40px — sin su render, abrías la comparación con un lado
  // en gris. Se quedó fuera desde el principio por descuido, no por decisión.
  // El orden es el de la pantalla: lo primero que se ve, lo primero que llega.
  const porPrecalentar: PrewarmJob[] = [...pendiente, ...falta, ...decidir]
    .filter((r) => !catImgs[faltaKey(r.item)] && !faltaImage(r.item))
    .map((r) => ({ key: faltaKey(r.item), args: idealArgs(r.item) }));

  // La lista viva, en un ref, para que el efecto de abajo no dependa de un array
  // que se recrea en cada render (misma técnica que el resto del archivo).
  // Las llaves en cola, para que el tile muestre "ya viene" en vez del botón
  // que invita a generarla a mano.
  const enCola = useMemo(
    () => new Set(porPrecalentar.map((j) => j.key)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [porPrecalentar.map((j) => j.key).join("|")]
  );

  const jobsRef = useRef<PrewarmJob[]>(porPrecalentar);
  useEffect(() => {
    jobsRef.current = porPrecalentar;
  });

  // Salir de la cápsula cancela la fila: no tiene sentido seguir pagando
  // renders de tiles que ya nadie está viendo. El abort vive en su PROPIO
  // efecto de desmontaje, y esto no es cosmético — ver abajo.
  const acPrewarm = useRef<AbortController | null>(null);
  useEffect(() => () => acPrewarm.current?.abort(), []);

  // Dispara el precalentado UNA vez por visita; el ref `lanzado` es el cinturón
  // (pagar dos veces el mismo render sería tirar dinero).
  //
  // La dep es un BOOLEANO ("¿queda algo por precalentar?") y no la firma de las
  // llaves, porque la firma era un lazo: se derivaba de `catImgs`, que este
  // mismo efecto engorda vía `onRendered`. Al aterrizar el PRIMER render la
  // firma cambiaba, React corría el cleanup del efecto viejo —que abortaba la
  // fila entera— y el efecto nuevo salía por `lanzado.current`. O sea: se
  // precalentaba UNA imagen por visita, las que iban en vuelo se pagaban y se
  // tiraban, y el resto de la pantalla seguía en gris. Es el bug que el
  // prewarm existía para matar (Alberto: "salía sin imagen… se ve medio mal
  // todo vacío"), vivo desde entonces y escondido detrás de la subida del tope
  // de 8 a 40. Cazado por la review de ship del 2026-08-13.
  const lanzado = useRef(false);
  const hayQuePrecalentar = porPrecalentar.length > 0;
  useEffect(() => {
    if (lanzado.current || !hayQuePrecalentar) return;
    lanzado.current = true;
    acPrewarm.current = new AbortController();
    void prewarmRenders(jobsRef.current, onRendered, acPrewarm.current.signal);
  }, [hayQuePrecalentar, onRendered]);

  // La cola de TUS prendas sin imagen, en orden de visibilidad: el duelo enseña
  // la tuya en grande, "ya lo tienes" en miniatura. Misma mecánica que el
  // prewarm de arriba (ref + firma + un solo disparo por visita, concurrencia 2).
  const porDibujar: { nombre: string; id: string }[] = [];
  {
    const vistos = new Set<string>();
    for (const r of [...decidir, ...tienes, ...falta]) {
      const nombre = r.by;
      if (!nombre || vistos.has(nombre) || imgs[nombre] || !nameToId[nombre]) continue;
      vistos.add(nombre);
      porDibujar.push({ nombre, id: nameToId[nombre] });
    }
  }
  const dibujarRef = useRef(porDibujar);
  useEffect(() => {
    dibujarRef.current = porDibujar;
  });
  // Vivo mientras la pantalla lo esté: se apaga al DESMONTAR y nunca por un
  // re-render (la trampa que se documenta arriba, en el prewarm).
  const dibujoVivo = useRef(true);
  useEffect(() => {
    dibujoVivo.current = true;
    return () => {
      dibujoVivo.current = false;
    };
  }, []);
  const dibujoLanzado = useRef(false);
  const hayQueDibujar = porDibujar.length > 0;
  useEffect(() => {
    if (dibujoLanzado.current || !hayQueDibujar) return;
    dibujoLanzado.current = true;
    const cola = dibujarRef.current.slice(0, TOPE_DIBUJO);
    const worker = async () => {
      for (let j = cola.shift(); j && dibujoVivo.current; j = cola.shift()) {
        const res = await requestItemRender(j.id);
        const url = res.url;
        if (res.ok && url && dibujoVivo.current) {
          setOwnImgs((m) => ({ ...m, [j.nombre]: url }));
        }
      }
    };
    void Promise.all(
      Array.from({ length: Math.min(CONCURRENCIA_DIBUJO, cola.length) }, worker)
    );
  }, [hayQueDibujar]);

  return (
    <EnColaContext.Provider value={enCola}>
    <div className="flex flex-col gap-7">
      <Toast message={toast} />
      <PrendaZoom data={zoom} onClose={() => setZoom(null)} />

      {lastOwned ? (
        <OwnedPhotoBanner
          itemId={lastOwned.itemId}
          nombre={lastOwned.nombre}
          userId={userId}
          onDismiss={() => setLastOwned(null)}
        />
      ) : null}

      {/* Resumen: eyebrow + "N de M" + barra. */}
      <div className="flex flex-col">
        <div className="flex items-baseline justify-between gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Tus esenciales
          </span>
          <span className="display text-[16px] font-semibold text-ink">
            {match ? (
              <>
                <span className="tabular">{have}</span>{" "}
                <span className="text-xs text-muted">
                  de <span className="tabular">{total}</span>
                </span>
              </>
            ) : (
              <span className="tabular text-xs text-muted">{total} piezas</span>
            )}
          </span>
        </div>
        {match ? (
          <div className="mt-2 h-[5px] w-full overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
        {match ? (
          <p className="mt-2.5 text-[12.5px] leading-snug text-muted">
            {looks > 0 ? (
              <>
                Con lo que ya tienes armas{" "}
                <button
                  type="button"
                  onClick={onViewLooks}
                  className="inline-flex items-center gap-0.5 font-semibold text-accent underline decoration-accent/30 underline-offset-2"
                >
                  ~{looks} looks
                  <Icon name="chevron" size={12} />
                </button>
                .
                {maxUnlock > 0
                  ? " Completa tu base para desbloquear muchos más."
                  : falta.length > 0
                    ? " Lo de abajo le da el remate."
                    : ""}
              </>
            ) : (
              "Estás a unas piezas de tus primeros looks completos — abajo, las que más suman."
            )}
          </p>
        ) : null}
      </div>

      {/* Sin match: la cápsula ideal como lista simple (el botón "calcular" vive
          en la página). */}
      {pendiente.length > 0 ? (
        <Section title="La lista completa" count={pendiente.length}>
          <ul className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3">
            {pendiente.map((r) => (
              <BigCard
                key={rowKey(r)}
                row={r}
                images={imgs}
                catalogImages={catImgs}
                onRendered={(url) => onRendered(faltaKey(r.item), url)}
                onZoom={(url) =>
                  setZoom({ image: url, nombre: r.item.nombre, sub: r.item.porque })
                }
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {falta.length > 0 ? (
        // "Lo que más te suma" describía el premio, no el contenido — y Roberto
        // lo rebotó: "primero vienen las prendas que tú NO tienes". Mismo
        // vocabulario que la sección hermana del viaje. El dato de cuánto suma
        // no se pierde: vive en el eyebrow de cada card ("+N looks").
        <Section title="No la tienes — cómprala o cúbrela" count={falta.length}>
          <ul className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3">
            {falta.map((r) =>
              // Un "parecido" rechazado va por DecideRow: misma SumaCard, pero
              // conserva el "deshacer" para volver a tu prenda si te arrepientes.
              r.base === "parecido" ? (
                <DecideRow
                  key={rowKey(r)}
                  row={r}
                  images={imgs}
                  catalogImages={catImgs}
                  onRendered={(url) => onRendered(faltaKey(r.item), url)}
                  onDecide={decide}
                  unlock={unlockOf(r)}
                  ownBusy={ownBusy.has(r.index)}
                  onOwn={() => markOwned(r.index, r.item.nombre)}
                  wishSaved={wishSaved.has(faltaKey(r.item))}
                  onToggleWish={() => toggleWish(r)}
                  swapBusy={swapBusy.has(r.index)}
                  swapErrored={swapError.has(r.index)}
                  onReject={(reason) => rejectItem(r.index, reason)}
                  onQuitar={(reason) => quitarItem(r.index, reason)}
                  resolvedMotivo={resolved.get(r.index) ?? null}
                  onZoom={(url) =>
                    setZoom({ image: url, nombre: r.item.nombre, sub: r.item.porque })
                  }
                />
              ) : (
                <SumaCard
                  key={rowKey(r)}
                  row={r}
                  catalogImages={catImgs}
                  onRendered={(url) => onRendered(faltaKey(r.item), url)}
                  unlock={unlockOf(r)}
                  ownBusy={ownBusy.has(r.index)}
                  onOwn={() => markOwned(r.index, r.item.nombre)}
                  wishSaved={wishSaved.has(faltaKey(r.item))}
                  onToggleWish={() => toggleWish(r)}
                  swapBusy={swapBusy.has(r.index)}
                  swapErrored={swapError.has(r.index)}
                  onReject={(reason) => rejectItem(r.index, reason)}
                  onQuitar={(reason) => quitarItem(r.index, reason)}
                  resolvedMotivo={resolved.get(r.index) ?? null}
                  // El zoom faltaba AQUÍ y sólo aquí: SumaCard ya lo aceptaba
                  // como prop y el llamador no se lo pasaba, así que la sección
                  // más grande de la pantalla ("no la tienes") era la única sin
                  // poder abrir la prenda en grande. Roberto: "si le pico a una
                  // imagen no me deja verla en grande".
                  onZoom={(url) =>
                    setZoom({ image: url, nombre: r.item.nombre, sub: r.item.porque })
                  }
                  // "tienes" desmentido: nota propia + deshacer (por si fue un
                  // mal tap, o si el match tenía razón después de todo).
                  reject={r.base === "tienes"}
                  note={
                    r.base === "tienes"
                      ? "lo desmentiste"
                      : undefined
                  }
                  onChange={
                    r.base === "tienes" ? () => decide(r.index, "accept") : undefined
                  }
                />
              )
            )}
          </ul>
        </Section>
      ) : null}

      {decidir.length > 0 ? (
        // ABIERTA desde 2026-08-13. Se cerró cuando cada duelo era dos fotos 3:4
        // —"abierta era lo MÁS grande de la pantalla"— pero eso ya lo resolvió
        // el modo compacto: hoy es UNA comparación abierta y el resto filas de
        // 40px. Cerrada, la tarea se escondía detrás de un tap que nadie tiene
        // por qué adivinar (y en el viaje va abierta desde que nació).
        <Section
          title="Decide si te sirve"
          count={decidir.length}
        >
          <ul className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3">
            {decidir.map((r) => (
              <DecideRow
                key={rowKey(r)}
                row={r}
                images={imgs}
                catalogImages={catImgs}
                onRendered={(url) => onRendered(faltaKey(r.item), url)}
                onDecide={decidirYSeguir}
                ownBusy={ownBusy.has(r.index)}
                onOwn={() => markOwned(r.index, r.item.nombre)}
                wishSaved={wishSaved.has(faltaKey(r.item))}
                onToggleWish={() => toggleWish(r)}
                unlock={unlockOf(r)}
                swapBusy={swapBusy.has(r.index)}
                swapErrored={swapError.has(r.index)}
                onReject={(reason) => rejectItem(r.index, reason)}
                onQuitar={(reason) => quitarItem(r.index, reason)}
                resolvedMotivo={resolved.get(r.index) ?? null}
                expandido={abierta === r.index}
                onExpandir={() => setAbierta(r.index)}
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {tienes.length > 0 ? (
        <Section title="Ya lo tienes" count={tienes.length}>
          <TienesSection
            rows={tienes}
            images={imgs}
            catalogImages={catImgs}
            onNoCubre={(index) => decide(index, "reject")}
            onZoom={(r) => setZoom(zoomDe(r))}
          />
        </Section>
      ) : null}
    </div>
    </EnColaContext.Provider>
  );
}

const rowKey = (r: CapsuleRow) => `${r.item.tipo}-${r.item.nombre}`;

// Imagen para una fila: la del clóset (por `by`) o, si es ideal (falta/pendiente),
// la de la biblioteca compartida y luego la curada estática del catálogo.
// OJO: la foto puede ser DE TU PRENDA o de la prenda ideal — quien la muestre
// tiene que etiquetarla con lo que de verdad se ve (ver rowImageKind).
function rowImage(
  r: CapsuleRow,
  images: Record<string, string>,
  catalogImages: Record<string, string>
): string | null {
  return rowImageKind(r, images, catalogImages).src;
}

// La misma imagen, diciendo QUÉ es: "tuya" = la foto de la prenda de tu clóset
// que cubre esa pieza; "ideal" = la de la pieza que te falta. Existe porque
// etiquetar la foto de tu traje de baño con el nombre de la pieza ideal ("Short
// de lino marino") se lee como que la app confunde una prenda con otra.
function rowImageKind(
  r: CapsuleRow,
  images: Record<string, string>,
  catalogImages: Record<string, string>
): { src: string | null; kind: "tuya" | "ideal" } {
  const own = r.by ? images[r.by] : null;
  if (own) return { src: own, kind: "tuya" };
  if (r.base === "falta" || r.base === "pendiente") {
    return {
      src: catalogImages[faltaKey(r.item)] ?? faltaImage(r.item),
      kind: "ideal",
    };
  }
  return { src: null, kind: "ideal" };
}

// Miniatura de prenda con fallback DIGNO: si no hay imagen, un swatch del color de
// la prenda + un gancho (nunca un hueco vacío). Si recibe `renderArgs` (prenda
// sugerida ideal), el placeholder es un botón "ver" → genera la imagen bajo demanda
// (biblioteca compartida) y la muestra. `colorFamilia` viene del item ideal.
function Thumb({
  src,
  colorFamilia,
  sizes,
  icon = 18,
  renderArgs,
  onRendered,
}: {
  src: string | null;
  colorFamilia: string;
  sizes: string;
  icon?: number;
  renderArgs?: RenderArgs;
  // Reporta la URL rendereada al caché de sesión (ver useIdealRender.onReady).
  onRendered?: (url: string) => void;
}) {
  const [generated, setGenerated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const enCola = useContext(EnColaContext);
  const shown = src ?? generated;
  if (shown) return <Image src={shown} alt="" fill sizes={sizes} className="object-cover" />;

  // Mismo tratamiento que IdealTileInner: papel + percha + banda de color al pie
  // (nada de bloques de color a sangre, que se leen como imagen rota).
  const hex = familiaToHex(colorFamilia);
  const tone = "text-muted";

  if (!renderArgs) {
    return (
      <span className="relative flex h-full w-full items-center justify-center bg-tile">
        <Icon name="gancho" size={icon} className="text-ink/25" />
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-[4px]" style={{ background: hex }} />
      </span>
    );
  }

  const onRender = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/render-ideal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(renderArgs),
      });
      const j = (await res.json().catch(() => null)) as { url?: string } | null;
      if (j?.url) {
        setGenerated(j.url);
        onRendered?.(j.url);
      }
    } finally {
      setBusy(false);
    }
  };

  // ¿Esta pieza ya está en la cola del auto-dibujo? Entonces NO se invita a
  // generarla a mano: se dice que viene. Sigue siendo tocable —si alguien tiene
  // prisa, adelanta la suya— pero el mensaje deja de contradecir lo que la
  // pantalla está haciendo por su cuenta.
  const viene = !busy && renderArgs ? enCola.has(faltaKey(renderArgs)) : false;

  return (
    <button
      type="button"
      onClick={onRender}
      disabled={busy}
      className="relative flex h-full w-full flex-col items-center justify-center gap-1 bg-tile px-1 disabled:opacity-80"
      title={viene ? "la estoy dibujando…" : VER_PRENDA_LABEL}
    >
      {busy || viene ? (
        <>
          <Spinner className={`h-4 w-4 ${tone}`} />
          {viene && !busy ? (
            <span className={`text-center text-[9px] font-semibold leading-tight ${tone}`}>
              dibujando…
            </span>
          ) : null}
        </>
      ) : (
        <>
          <Icon name="destello" size={icon} className={tone} />
          <span className={`text-center text-[9px] font-semibold leading-tight ${tone}`}>
            {VER_PRENDA_LABEL}
          </span>
        </>
      )}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-[4px]" style={{ background: hex }} />
    </button>
  );
}

function Section({
  title,
  count,
  children,
  collapsible,
  summary,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  /** Arranca cerrada: solo el rótulo + una barra de resumen que la abre. */
  collapsible?: boolean;
  /** Lo que se ve cerrada (miniaturas + una línea). Obligatorio si collapsible. */
  summary?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const closed = !!collapsible && !open;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          {title}
        </span>
        <span className="tabular text-[11px] text-muted">{count}</span>
      </div>
      {closed ? (
        // Cerrada: una barra que dice qué hay y la abre. No esconde nada — está
        // a un toque — pero deja de competir por atención con lo que sí importa.
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-md border border-line bg-surface p-3 text-left transition-colors hover:border-ink"
        >
          {summary}
          <Icon name="chevron" size={16} className="ml-auto shrink-0 text-faint" />
        </button>
      ) : (
        <>
          {children}
          {collapsible ? (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex min-h-11 w-fit items-center text-[11.5px] font-semibold text-muted underline underline-offset-2 transition-colors hover:text-ink"
            >
              ocultar
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

// Tarjeta grande para lo que falta / la cápsula ideal: miniatura 56×72 + nombre
// (Instrument Serif) + porqué + control a la derecha (p. ej. "ya la tengo").
function BigCard({
  row,
  images,
  catalogImages,
  onRendered,
  right,
  unlock,
  onZoom,
}: {
  row: CapsuleRow;
  images: Record<string, string>;
  catalogImages: Record<string, string>;
  onRendered?: (url: string) => void;
  right?: React.ReactNode;
  unlock?: number;
  /** Un toque en la miniatura la abre en grande. La de 56×72 no deja ver de
   *  qué prenda habla — mismo motivo que en el rail de miniaturas. */
  onZoom?: (url: string) => void;
}) {
  const src = rowImage(row, images, catalogImages);
  return (
    <li className="flex items-center gap-[13px] rounded-lg border border-line bg-surface p-[13px]">
      <span
        className="relative h-[72px] w-[56px] shrink-0 overflow-hidden rounded-sm border border-line bg-bg"
        onClick={src && onZoom ? () => onZoom(src) : undefined}
        role={src && onZoom ? "button" : undefined}
        aria-label={src && onZoom ? `Ver ${row.item.nombre} en grande` : undefined}
      >
        <Thumb
          src={src}
          colorFamilia={row.item.colorFamilia}
          sizes="56px"
          onRendered={onRendered}
          renderArgs={{
            tipo: row.item.tipo,
            colorFamilia: row.item.colorFamilia,
            nombre: row.item.nombre,
            categoria: row.item.category,
            formalidad: row.item.formalidad,
            temporada: row.item.temporada,
            visual: row.item.visual,
          }}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[16px] font-semibold leading-tight text-ink">
          {row.item.nombre}
        </span>
        {unlock && unlock > 0 ? (
          <span className="mt-1 flex w-fit items-center gap-1 rounded-sm bg-accent-soft px-1.5 py-[2px] text-[10.5px] font-semibold text-accent">
            <Icon name="destello" size={11} /> desbloquea ~{unlock} looks
          </span>
        ) : null}
        <span className="mt-1 text-[11.5px] leading-snug text-muted">{row.item.porque}</span>
      </div>
      {right ? <span className="shrink-0">{right}</span> : null}
    </li>
  );
}

// Tarjeta grande para "no la tienes" (y para el estado "quiero la sugerida"
// de Decide): tile grande tappable que GENERA la imagen enfrente + cuerpo con
// nombre/porqué y la fila de acciones "ya la tengo" · "wishlist".
function SumaCard({
  row,
  catalogImages,
  onRendered,
  unlock,
  ownBusy,
  onOwn,
  wishSaved,
  onToggleWish,
  reject,
  note,
  onChange,
  swapBusy = false,
  swapErrored = false,
  onReject,
  onQuitar,
  resolvedMotivo,
  onZoom,
}: {
  row: CapsuleRow;
  catalogImages: Record<string, string>;
  onRendered?: (url: string) => void;
  unlock?: number;
  ownBusy: boolean;
  onOwn: () => void;
  wishSaved: boolean;
  onToggleWish: () => void;
  reject?: boolean;
  /** Nota del banner de "ya decidiste" (por defecto, la del parecido rechazado). */
  note?: string;
  onChange?: () => void;
  // Camino A: "no me convence" → swap. Solo se pasan en la sección de huecos.
  swapBusy?: boolean;
  swapErrored?: boolean;
  onReject?: (reason: VetoReason | null) => void;
  /** "no me va": retira el slot CON su motivo (la hoja lo hace obligatorio). */
  onQuitar?: (reason: VetoReason) => void;
  /** Ya resuelta con "no me va": el card colapsa a su acuse. */
  resolvedMotivo?: string | null;
  /** Con imagen ya lista, el toque la amplía (sin imagen sigue generándola). */
  onZoom?: (url: string) => void;
}) {
  const { item } = row;
  const swapped = row.swapCount > 0;
  // SIEMPRE la imagen ideal/sugerida — nunca la de la prenda del clóset (`by`):
  // esta tarjeta representa "la sugerida" (en falta y al rechazar un parecido).
  // Usar rowImage aquí mostraba la prenda que ya tienes al elegir la sugerida.
  const idealSrc = catalogImages[faltaKey(item)] ?? faltaImage(item);
  const render = useIdealRender(idealArgs(item), idealSrc, onRendered);
  const onTapTile = () => {
    // Con la imagen lista, el toque la AMPLÍA; sin ella, la genera (el tap ya
    // tenía dueño y no se le quita: primero verla, luego verla en grande).
    if (render.src && onZoom) {
      onZoom(render.src);
      return;
    }
    if (render.state === "idle") void render.start();
  };
  // El eyebrow es contexto de una línea — nunca la razón (esa es la serif).
  // Orden: lo que acaba de pasar (swap) > tu decisión (le da sentido al
  // "deshacer" de al lado) > lo que la prenda desbloquea > el caso base.
  const eyebrow = swapped
    ? "te la cambié"
    : reject
      ? (note ?? "preferiste la sugerida")
      : unlock && unlock > 0
        ? `+${unlock} looks`
        : "te falta este básico";

  // "deshacer" = revertir tu decisión entre tu prenda y la sugerida. NUNCA
  // "búscame otra" (corrección de Roberto, 2026-07-29: el primer corte lo usó
  // así y revolvía los dos ejes que esta card vino a separar). El reemplazo
  // vive dentro de "no me va", que primero pide el motivo — y ese motivo es lo
  // que el motor usa para no proponer el mismo error (REASON_HINT).
  //
  // SE LLAMABA "cambiar" y era un homónimo venenoso: en el viaje "cambiar"
  // significa exactamente lo prohibido aquí (búscame otra del clóset). Mismo
  // verbo, significados opuestos, y Roberto —autor de la corrección— ya no
  // recordaba qué hacía este botón. La palabra ahora dice lo que hace.
  const topAction =
    reject && onChange
      ? { label: "deshacer", icon: "repetir" as const, onClick: onChange }
      : null;

  return (
    <SuggestionCard
      eyebrow={eyebrow}
      nombre={item.nombre}
      porque={item.porque}
      foto={
        <button
          type="button"
          onClick={onTapTile}
          className="absolute inset-0 flex items-center justify-center"
        >
          <IdealTileInner render={render} colorFamilia={item.colorFamilia} sizes="86px" />
        </button>
      }
      topAction={topAction}
      footer={[
        {
          label: ownBusy ? "agregando…" : "ya la tengo",
          icon: "mas",
          onClick: onOwn,
          busy: ownBusy,
          primary: true,
        },
        {
          label: wishSaved ? "en wishlist" : "wishlist",
          icon: wishSaved ? "bookmarkFill" : "bookmark",
          onClick: onToggleWish,
          active: wishSaved,
        },
      ]}
      noMeVa={
        onQuitar
          ? {
              // Al tope de swaps ya no se ofrece reemplazo: la hoja salta el
              // paso 2 y el motivo va directo al retiro.
              puedeReemplazar: !!onReject && !row.atSwapCap,
              onReemplazar: (r) => onReject?.(r),
              onQuitar,
              hintTarget: "capsula-swap",
            }
          : null
      }
      resolved={resolvedMotivo ? { motivo: resolvedMotivo } : null}
      busy={swapBusy}
      busyLabel="buscando una alternativa…"
      error={swapErrored ? "No pude buscar otra — inténtalo de nuevo." : null}
    />
  );
}

// "Ya lo tienes": fila horizontal de miniaturas (46px, 3:4) + celda "+N" si hay
// más de las que se muestran.
// "Ya lo tienes": el rail compacto de siempre + un desplegable para VER de qué
// te está acreditando y desmentirlo si el match se equivocó.
//
// Por qué colapsado (decisión con Roberto): esta sección se lee como "esto ya
// está resuelto" — abrirla por default la convertiría en otra lista de
// pendientes y pondría al usuario a auditar 15 emparejamientos que nadie pidió.
// Cerrada, la pantalla se ve idéntica a antes: coste cero para quien no la
// necesita. Se abre cuando YA notaste algo raro ("¿por qué dice que tengo un
// henley?"), no porque la app insista.
function TienesSection({
  rows,
  images,
  catalogImages,
  onNoCubre,
  onZoom,
}: {
  rows: CapsuleRow[];
  images: Record<string, string>;
  catalogImages: Record<string, string>;
  onNoCubre: (index: number) => void;
  /** Toca la miniatura → verla en grande (las de 38px no se distinguen). */
  onZoom: (row: CapsuleRow) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2.5">
      {open ? (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <li
              key={rowKey(r)}
              className="flex items-center gap-2.5 rounded-md border border-line bg-surface p-2"
            >
              <button
                type="button"
                onClick={() => onZoom(r)}
                aria-label={`Ver ${r.by ?? r.item.nombre} en grande`}
                className="relative aspect-[3/4] w-[38px] shrink-0 overflow-hidden rounded-sm border border-line bg-bg transition-colors hover:border-ink"
              >
                <Thumb
                  src={rowImage(r, images, catalogImages)}
                  colorFamilia={r.item.colorFamilia}
                  sizes="38px"
                  icon={13}
                />
              </button>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-medium text-ink">
                  {r.item.nombre}
                </span>
                {/* De QUÉ prenda tuya te está acreditando: hoy esto no se veía en
                    ningún lado, ni con el match perfecto. */}
                <span className="truncate text-[11px] text-muted">
                  {r.by ? `la cubre tu ${r.by}` : "cubierta"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNoCubre(r.index)}
                className="ml-auto flex min-h-11 shrink-0 items-center text-[11px] font-medium text-muted underline underline-offset-2 transition-colors hover:text-ink"
              >
                esta no la cubre
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Rail rows={rows} images={images} catalogImages={catalogImages} onZoom={onZoom} />
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-fit items-center text-[11.5px] font-semibold text-muted underline underline-offset-2 transition-colors hover:text-ink"
      >
        {open ? "ocultar" : "ver cuáles"}
      </button>
    </div>
  );
}

function Rail({
  rows,
  images,
  catalogImages,
  onZoom,
}: {
  rows: CapsuleRow[];
  images: Record<string, string>;
  catalogImages: Record<string, string>;
  onZoom?: (row: CapsuleRow) => void;
}) {
  const MAX = 7;
  const shown = rows.slice(0, MAX);
  const extra = rows.length - shown.length;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {shown.map((r) => {
        const src = rowImage(r, images, catalogImages);
        return (
          <button
            key={rowKey(r)}
            type="button"
            onClick={() => onZoom?.(r)}
            className="relative aspect-[3/4] w-[46px] shrink-0 overflow-hidden rounded-sm border border-line bg-bg transition-colors hover:border-ink"
            title={r.by ?? r.item.nombre}
            aria-label={`Ver ${r.by ?? r.item.nombre} en grande`}
          >
            <Thumb src={src} colorFamilia={r.item.colorFamilia} sizes="46px" icon={15} />
          </button>
        );
      })}
      {extra > 0 ? (
        <span className="flex aspect-[3/4] w-[46px] shrink-0 items-center justify-center rounded-sm border border-line bg-surface text-xs font-semibold text-muted">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

// Las "parecido": se deciden en su lugar con "elige tocando" (adiós al cruce de
// botones Sí/No). Sin decidir → tocas la prenda que prefieres → se marca → barra
// que NOMBRA el veredicto → Confirmar. Aceptada → estado marcado con "deshacer";
// rechazada ("quiero la sugerida") → adopta la SumaCard (tile + acciones).
function DecideRow({
  row,
  images,
  catalogImages,
  onRendered,
  onDecide,
  ownBusy,
  onOwn,
  wishSaved,
  onToggleWish,
  unlock,
  swapBusy = false,
  swapErrored = false,
  onReject,
  onQuitar,
  resolvedMotivo,
  expandido = false,
  onExpandir,
  onZoom,
}: {
  row: CapsuleRow;
  images: Record<string, string>;
  catalogImages: Record<string, string>;
  onRendered?: (url: string) => void;
  onDecide: (index: number, decision: CapsuleDecision) => void;
  ownBusy: boolean;
  onOwn: () => void;
  wishSaved: boolean;
  onToggleWish: () => void;
  /** Cuántos looks desbloquea (para la card de hueco tras rechazar el parecido). */
  unlock?: number;
  swapBusy?: boolean;
  swapErrored?: boolean;
  /** Tercer camino: no te va NI la tuya NI la sugerida. Sale por la hoja de
   *  motivo (obligatoria) y de ahí a reemplazo o retiro — antes era un swap a
   *  ciegas y el motivo, que es lo que el motor necesita, se perdía. */
  onReject?: (reason: VetoReason | null) => void;
  onQuitar?: (reason: VetoReason) => void;
  /** Ya resuelta con "no me va" (lo hereda la SumaCard del estado rechazado). */
  resolvedMotivo?: string | null;
  /** La apertura la manda el padre: al confirmar una, encadena a la siguiente
   *  sin volver al estado neutro (Roberto: "no debería tener que picarle a la
   *  que sigue"). */
  expandido?: boolean;
  onExpandir?: () => void;
  /** Reenviado a la SumaCard del estado ya-rechazado (ver imagen en grande). */
  onZoom?: (url: string) => void;
}) {
  const { item, by, decision, index } = row;
  const src = by ? images[by] : null;
  const idealSrc = catalogImages[faltaKey(item)] ?? faltaImage(item);
  const render = useIdealRender(idealArgs(item), idealSrc, onRendered);
  const [sel, setSel] = useState<null | "ideal" | "tuya">(null);
  // La hoja de motivo del duelo: la MISMA que abre "no me va" en el pie del card
  // ya resuelto (handoff §3 — las dos entradas llaman al mismo openAsk()).
  const [preguntando, setPreguntando] = useState(false);
  const [motivo, setMotivo] = useState<VetoReason | null>(null);
  const cerrarHoja = () => {
    setPreguntando(false);
    setMotivo(null);
  };

  const onTapIdeal = async () => {
    if (render.state === "ready") {
      setSel("ideal");
      return;
    }
    if (render.state === "generating") return;
    const ok = await render.start();
    if (ok) setSel("ideal");
  };

  // "deshacer" desde cualquier estado resuelto: revierte la decisión (el override
  // es un toggle) y devuelve el card al duelo con la selección limpia. Reabrirlo
  // es parte del trabajo: sin `onExpandir` volvías a la fila colapsada y había
  // que picarle otra vez para ver lo que ibas a cambiar.
  const volverAlDuelo = (d: CapsuleDecision) => {
    setSel(null);
    onDecide(index, d);
    onExpandir?.();
  };

  if (decision === "accept") {
    // Elegiste la TUYA. Mismo card de sugerencia que los demás estados — pero
    // con tu prenda al frente y sin pie: no hay veredictos que ofrecer sobre una
    // prenda que ya está en tu clóset. La única salida es deshacer.
    return (
      <SuggestionCard
        eyebrow="en tu clóset"
        nombre={by ?? item.nombre}
        porque="listo — ese hueco lo cubre lo que ya traes."
        foto={
          src ? (
            <Image src={src} alt={by ?? ""} fill sizes="86px" className="object-contain" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center">
              <Icon name="gancho" size={20} className="text-ink/25" />
            </span>
          )
        }
        topAction={{
          label: "deshacer",
          icon: "repetir",
          onClick: () => volverAlDuelo("accept"),
        }}
        footer={[]}
      />
    );
  }

  // Elegiste la SUGERIDA (o la descartaste con motivo, que resuelve igual). El
  // hueco es real: le tocan las mismas puertas que a un hueco de "lo que más te
  // suma" (ya la tengo · wishlist · no me va), y "deshacer" para volver al duelo.
  if (decision === "reject" || resolvedMotivo) {
    return (
      <SumaCard
        row={row}
        catalogImages={catalogImages}
        onRendered={onRendered}
        unlock={unlock}
        ownBusy={ownBusy}
        onOwn={onOwn}
        wishSaved={wishSaved}
        onToggleWish={onToggleWish}
        reject={decision === "reject"}
        note="la sugerida"
        onChange={decision === "reject" ? () => volverAlDuelo("reject") : undefined}
        onZoom={onZoom}
        swapBusy={swapBusy}
        swapErrored={swapErrored}
        onReject={onReject}
        onQuitar={onQuitar}
        resolvedMotivo={resolvedMotivo}
      />
    );
  }

  // Sin decidir, COMPACTA (assessment UX): antes esta card era lo más alto de la
  // pantalla — dos fotos 3:4 por pieza — para la tarea que menos vale. Ahora
  // arranca como una fila y un toque la abre a la comparación grande: quien
  // necesita ver la prenda para decidir la tiene, pero deja de dominar.
  if (!expandido) {
    return (
      <li>
        <button
          type="button"
          onClick={onExpandir}
          className="flex w-full items-center gap-2.5 border border-line bg-surface p-3 text-left transition-colors hover:border-ink"
        >
          <span className="relative aspect-[3/4] w-10 shrink-0 overflow-hidden rounded-sm border border-line bg-tile">
            <IdealTileInner render={render} colorFamilia={item.colorFamilia} sizes="40px" restLabel="" />
          </span>
          <span className="text-[10px] font-bold text-faint">vs</span>
          <span className="relative aspect-[3/4] w-10 shrink-0 overflow-hidden rounded-sm border border-line bg-tile">
            {src ? (
              <Image src={src} alt={by ?? ""} fill sizes="40px" className="object-contain" />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <Icon name="gancho" size={13} className="text-ink/25" />
              </span>
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13.5px] font-semibold leading-tight text-ink">
              {item.nombre}
            </span>
            <span className="truncate text-[11px] text-muted">
              {row.difiere ? `cambia: ${row.difiere}` : "tuya o la sugerida"}
            </span>
          </span>
          <Icon name="chevron" size={16} className="ml-auto shrink-0 text-faint" />
        </button>
      </li>
    );
  }

  // Abierta — EL DUELO. Dos columnas idénticas y sin preselección: si una llega
  // más grande, el card ya decidió por el usuario antes de que comparara.
  // Tocar la sugerida sin imagen la GENERA antes de poder elegirla (nunca eliges
  // un vacío).
  return (
    <li className="border border-line bg-surface">
      {/* a · cabecera. El rótulo nombra EL HUECO y la nota lo argumenta: nunca
          dicen lo mismo, y ninguno repite el nombre de las prendas (ese vive en
          el pie de su columna). */}
      <div className="border-b border-line2 px-[13px] pb-[11px] pt-3">
        <span className="block truncate text-[9.5px] font-bold uppercase tracking-[0.13em] text-faint">
          te falta
          {item.hueco ? (
            <>
              {" · "}
              <b className="text-ink">{item.hueco}</b>
            </>
          ) : null}
        </span>
        <div className="mt-1.5 flex items-start gap-[9px]">
          <span aria-hidden className="display shrink-0 pt-1 text-[14px] leading-none text-ink">
            ✦
          </span>
          <p className="display text-[16px] italic leading-5 text-ink2">{item.porque}</p>
        </div>
      </div>

      {/* EL TÍTULO EN MEDIO: el contexto de que hay que escoger UNA. Con el
          MISMO tratamiento que los rótulos de abajo —9.5px, bold, versalitas,
          faint— para que se lea como etiqueta y nunca como el botón de elegir.
          Nació en el duelo del viaje (2026-08-13) y baja aquí por paridad. */}
      <span className="block border-t border-line2 bg-tile/50 py-[7px] text-center text-[9.5px] font-bold uppercase tracking-[0.13em] text-faint">
        elige una · la que cubre este hueco
      </span>

      {/* b · el duelo, 50/50. El `gap-px` sobre el fondo ES la hairline que las
          separa (una sola línea, sin bordes que se dupliquen). */}
      <div className="grid grid-cols-2 gap-px bg-line">
        <DuelOp
          rotulo="la sugerida"
          nombre={item.nombre}
          elegida={sel === "ideal"}
          onClick={onTapIdeal}
        >
          <IdealTileInner render={render} colorFamilia={item.colorFamilia} sizes="172px" />
        </DuelOp>
        <DuelOp
          rotulo="en tu clóset"
          nombre={by ?? "tu prenda"}
          elegida={sel === "tuya"}
          onClick={() => setSel("tuya")}
        >
          {src ? (
            <Image src={src} alt={by ?? ""} fill sizes="172px" className="object-contain" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center">
              <Icon name="gancho" size={22} className="text-ink/25" />
            </span>
          )}
        </DuelOp>
      </div>

      {/* c · el botón de elegir: aparece al picar, y su label NOMBRA la elección.
          Uno solo y de ancho completo — alineado con una columna se leería como
          el pie de esa columna.

          VA EN NEGRO RELLENO, que es el botón primario de la app. Aquí decía
          "no es negro relleno: ese está reservado a generar en toda la app" y
          era FALSO — hay 152 botones `bg-accent`+`text-on-accent` fuera de
          admin, y dicen "ir a mi perfil", "usar este estilo", "armar mi
          maleta", "recortar". Esa regla inventada empujó el botón a
          `bg-accent-soft`, que en este sistema es el relleno de DISABLED
          (`disabled:bg-accent-soft` en historial-look-detail): por eso Roberto
          reportó que "apenas se nota, no se siente que es un botón". Sobre
          card blanca quedaba en #f1f0ee contra un fondo de página #f4f3f1 —
          y con el mismo peso que la salida de abajo, así que la card cerraba
          con dos filas grises y ninguna se leía como la acción.

          Comparado en pantalla contra un contorno de tinta: el contorno pierde
          porque mete un SEGUNDO trazo de tinta y compite con el anillo de la
          prenda elegida. El negro además cumple lo que este comentario ya
          quería — el anillo de la prenda y la barra se leen como un bloque. */}
      {sel ? (
        <button
          type="button"
          onClick={() => onDecide(index, sel === "tuya" ? "accept" : "reject")}
          style={{ animation: "step-in var(--dur-short) var(--ease-enter) both" }}
          className="flex h-[52px] w-full items-center justify-center border-t border-line bg-accent text-[14.5px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
        >
          elegir {sel === "ideal" ? "la sugerida" : "la tuya"}
        </button>
      ) : null}

      {/* d · la salida, DENTRO del card: en una lista de varios duelos, una
          salida por fuera no se sabría a cuál pertenece. Abre la MISMA hoja de
          motivo que el "no me va" del card ya resuelto. */}
      {swapBusy ? (
        <div className="flex min-h-11 items-center justify-center gap-2 border-t border-line2 text-[12.5px] text-muted">
          <Spinner className="h-3.5 w-3.5" /> buscando una alternativa…
        </div>
      ) : onQuitar ? (
        <button
          type="button"
          onClick={() => setPreguntando(true)}
          className="flex min-h-11 w-full items-center justify-center border-t border-line2 text-[12.5px] font-semibold text-muted transition-colors hover:bg-tile hover:text-ink"
        >
          ninguna de las dos me va
        </button>
      ) : null}

      {swapErrored ? (
        <p className="border-t border-line2 px-[13px] py-2 text-[11px] text-error">
          No pude buscar otra — inténtalo de nuevo.
        </p>
      ) : null}

      {onQuitar ? (
        <MotivoSheet
          open={preguntando}
          onClose={cerrarHoja}
          motivo={motivo}
          onMotivo={setMotivo}
          // Al tope de swaps ya no hay reemplazo que ofrecer: el chip resuelve
          // directo al retiro.
          puedeReemplazar={!!onReject && !row.atSwapCap}
          onReemplazar={(r) => onReject?.(r)}
          onQuitar={onQuitar}
        />
      ) : null}
    </li>
  );
}

// Una columna del duelo. Es un <button> con `flex-direction:column` a propósito:
// un <button> centra su contenido verticalmente, y con un nombre de una línea y
// otro de dos las dos columnas quedaban desalineadas.
function DuelOp({
  rotulo,
  nombre,
  elegida,
  onClick,
  children,
}: {
  rotulo: string;
  nombre: string;
  elegida: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col bg-surface text-left">
      {/* Alto FIJO (no aspect-ratio): así las dos fotos y los dos pies caen en la
          misma línea base sin importar la proporción de cada archivo. */}
      {/* `bg` y no `tile`: ver la nota larga en el duelo del viaje
          (components/trip-result). Mismo defecto, mismas dos líneas — el
          sobrante de `object-contain` dibujaba un rectángulo y se comía la
          divisoria. */}
      <span className="relative block h-[172px] w-full overflow-hidden bg-bg">
        {children}
        {/* Elegida = anillo de tinta sobre la foto. SIN relleno de fondo: ese
            gris es el del botón de elegir, y juntos se fundían en un bloque. */}
        {elegida ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-30 shadow-[inset_0_0_0_2px_var(--c-ink)]"
          />
        ) : null}
      </span>
      <span
        className={`block px-[11px] pt-[9px] text-[9.5px] font-bold uppercase tracking-[0.13em] ${
          elegida ? "text-ink" : "text-faint"
        }`}
      >
        {rotulo}
      </span>
      {/* Dos líneas reservadas: un nombre largo no debe correr el rótulo de su
          columna respecto al de la otra. */}
      <span
        className={`block min-h-12 px-[11px] pb-[11px] pt-[3px] text-[13.5px] leading-[17px] tracking-[-0.005em] text-ink ${
          elegida ? "font-bold" : "font-semibold"
        }`}
      >
        {nombre}
      </span>
    </button>
  );
}
