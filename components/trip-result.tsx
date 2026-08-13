"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { PrendaZoom, type PrendaZoomData } from "@/components/prenda-zoom";
import { IdealTileInner, useIdealRender, type RenderArgs } from "@/components/ideal-tile";
import {
  dismissTripCandidate,
  proposeTripSubstitutes,
  undoTripDuel,
  setTripOverride,
  setTripPacked,
  setTripPackedAll,
  setTripSubstitute,
  suggestTripSubstitutes,
  markTripFaltaOwned,
  type SubstituteCandidate,
} from "@/lib/trip-actions";
import type { Candidata } from "@/lib/trip-candidatas";
import { toggleWishlistFromCapsule } from "@/lib/wishlist-actions";
import { SuggestionCard } from "@/components/suggestion-card";
import { useTripPacked } from "@/components/trip-packed-context";
import { familiaToHex } from "@/lib/capsule-images";
import { Toast } from "@/components/toast";
import { useTripGen } from "@/components/trip-gen-context";
import { prewarmRenders, type PrewarmJob } from "@/lib/prewarm-renders";

// Una prenda de la cápsula del viaje, ya resuelta contra el clóset (vista plana
// que arma la página servidor a partir de capsuleRows + el mapa de imágenes).
export type TripRow = {
  index: number;
  nombre: string; // prenda ideal
  porque: string;
  base: "tienes" | "parecido" | "falta" | "pendiente"; // lo que dijo el match
  decision: "accept" | "reject" | null; // decisión guardada (solo en "parecido")
  by: string | null; // prenda del clóset que la cubre / se le parece
  byImage: string | null;
  // Para las faltantes: generar/ver la prenda sugerida y mandarla a wishlist.
  faltaKey: string; // dedup de wishlist (tipo|color)
  idealImage: string | null; // render de catálogo ya existente (instantáneo), si hay
  renderArgs: RenderArgs; // para generar la imagen bajo demanda
};

// Estado efectivo (base + decisión guardada de un "parecido").
function eff(r: TripRow): TripRow["base"] {
  if (r.base === "parecido") {
    return r.decision === "accept" ? "tienes" : r.decision === "reject" ? "falta" : "parecido";
  }
  return r.base;
}

// Tarjeta de una prenda que TE FALTA en el viaje: tile grande que GENERA la imagen
// al tocar (verla antes de decidir) + acciones. Layout Opción 1: "buscar en mi
// clóset" prominente (la jugada del viaje: cúbrelo con lo que ya tienes) y debajo
// la fila "ya lo tengo" · "wishlist", igual que la cápsula del clóset (coherencia).
function FaltaCard({
  row,
  ownBusy,
  onYaLoTengo,
  wishSaved,
  onToggleWish,
  onDeshacer,
}: {
  row: TripRow;
  ownBusy: boolean;
  onYaLoTengo: () => void;
  wishSaved: boolean;
  onToggleWish: () => void;
  /** Llegó aquí por un duelo ("preferiste la sugerida") → se puede deshacer. */
  onDeshacer?: () => void;
}) {
  const render = useIdealRender(row.renderArgs, row.idealImage);
  const onTapTile = () => {
    if (render.state === "idle") void render.start();
  };
  // Misma card que la cápsula (SuggestionCard). "buscar en mi clóset" va en el
  // slot de arriba, donde la cápsula pone "cambiar": las dos son "enséñame otra
  // cosa", no un veredicto sobre esta prenda — y el pie es solo de veredictos.
  //
  // Sin "no me va" aquí: el viaje no tiene dónde guardar un veto de este tipo
  // (la cápsula sí, en capsule_swaps). Ofrecer un botón que solo esconde la fila
  // sería prometer que aprendemos algo que no aprendemos.
  return (
    <SuggestionCard
      nombre={row.nombre}
      porque={row.porque}
      foto={
        <button
          type="button"
          onClick={onTapTile}
          className="absolute inset-0 flex items-center justify-center"
        >
          <IdealTileInner render={render} colorFamilia={row.renderArgs.colorFamilia} sizes="86px" />
        </button>
      }
      // SIN "en mi clóset" desde 2026-08-13 (Roberto): esta sección ya ES lo
      // que la búsqueda de candidatas NO pudo cubrir — ofrecer aquí "buscar en
      // mi clóset" contradice a la propia sección. El precio asumido: una
      // prenda NUEVA del clóset que cubriría el hueco ya no se conecta desde
      // aquí (la búsqueda se paga una vez y cachea su "no hubo nada").
      //
      // El "deshacer" SÓLO aparece si esta card llegó desde un duelo: en las
      // faltas de origen no hay decisión que revertir, y un botón que no
      // deshace nada es peor que ninguno.
      eyebrow={onDeshacer ? "preferiste la sugerida" : "para el viaje"}
      topAction={
        onDeshacer ? { label: "deshacer", icon: "repetir" as const, onClick: onDeshacer } : undefined
      }
      footer={[
        {
          label: ownBusy ? "agregando…" : "ya lo tengo",
          icon: "mas",
          onClick: onYaLoTengo,
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
    />
  );
}

// EL DUELO DE UNA FALTA: la sugerida contra la candidata de TU clóset.
//
// Es la interacción de la cápsula ("decide si te sirve") traída al viaje —
// pieza C de la consistencia (2026-08-13). Antes la candidata vivía detrás de
// la lupa "en mi clóset" y quien no la tocaba veía "cómpralo" teniendo en su
// clóset con qué cubrirlo. Decidir viendo, en un tap.
//
// SIN "ninguna de las dos me va", a propósito: en la cápsula ese botón guarda
// un veto con motivo que el motor aprende; el viaje no tiene dónde guardar
// vetos, y ofrecer el gesto sin la memoria sería prometer aprendizaje que no
// existe (la misma razón por la que la falta del viaje no tiene "no me va").
function DueloCard({
  row,
  tuya,
  onMia,
  onSugerida,
}: {
  row: TripRow;
  /** El lado derecho del duelo: la prenda TUYA (candidata de la búsqueda, o
   *  la que el match emparejó en un "parecido"). */
  tuya: Candidata;
  onMia: () => void;
  onSugerida: () => void;
}) {
  const render = useIdealRender(row.renderArgs, row.idealImage);
  // TOCAS → SE MARCA → BOTÓN QUE NOMBRA LA ELECCIÓN. Es el patrón exacto del
  // duelo de la cápsula (DecideRow), y llegó tras rebote de Roberto: la v1 puso
  // abajo una línea de instrucción ("toca la que te quedas") con el MISMO
  // tratamiento que el botón de "ver otras" — dos filas idénticas donde una era
  // texto y la otra acción, así que ninguna se leía como lo que era. La
  // instrucción sobra cuando el gesto se explica solo: el anillo de tinta dice
  // qué elegiste y el botón dice qué va a pasar.
  const [sel, setSel] = useState<null | "sugerida" | "tuya">(null);
  const onTapSugerida = () => {
    if (render.state === "idle") void render.start();
    setSel("sugerida");
  };
  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-col gap-1 p-3.5 pb-3">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.13em] text-faint">
          ¿te sirve la tuya?
        </span>
        <div className="mt-0.5 flex items-start gap-[9px]">
          <span aria-hidden className="display shrink-0 pt-1 text-[14px] leading-none text-ink">
            ✦
          </span>
          <p className="display text-[16px] italic leading-5 text-ink2">{row.porque}</p>
        </div>
      </div>

      {/* EL TÍTULO EN MEDIO (insistencia de Roberto, y tenía razón dos veces):
          da el contexto de que hay que escoger UNA. Va con el MISMO tratamiento
          que los rótulos "la sugerida"/"en tu clóset" de abajo —9.5px, bold,
          versalitas, faint— para que se lea como etiqueta y no como el botón,
          que fue el error de la v1 al ponerlo abajo con peso de acción. */}
      <span className="block border-t border-line2 bg-tile/50 py-[7px] text-center text-[9.5px] font-bold uppercase tracking-[0.13em] text-faint">
        elige una · la que se va a tu maleta
      </span>

      {/* El duelo 50/50. El `gap-px` sobre el fondo ES la hairline que separa
          las dos mitades (una sola línea, sin bordes duplicados). */}
      <div className="grid grid-cols-2 gap-px bg-line">
        <DuelOpViaje
          rotulo="la sugerida"
          nombre={row.nombre}
          elegida={sel === "sugerida"}
          onClick={onTapSugerida}
        >
          <IdealTileInner render={render} colorFamilia={row.renderArgs.colorFamilia} sizes="172px" />
        </DuelOpViaje>
        <DuelOpViaje
          rotulo="en tu clóset"
          nombre={tuya.nombre}
          elegida={sel === "tuya"}
          onClick={() => setSel("tuya")}
        >
          {tuya.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tuya.image} alt="" className="absolute inset-0 h-full w-full object-contain" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center">
              <Icon name="gancho" size={22} className="text-ink/25" />
            </span>
          )}
        </DuelOpViaje>
      </div>

      {/* El botón aparece AL PICAR y su label nombra la elección. Uno solo y de
          ancho completo: alineado con una columna se leería como su pie. */}
      {sel ? (
        <button
          type="button"
          onClick={() => (sel === "tuya" ? onMia() : onSugerida())}
          style={{ animation: "step-in var(--dur-short) var(--ease-enter) both" }}
          className="flex h-[52px] w-full items-center justify-center border-t border-line bg-accent-soft text-[14.5px] font-bold text-ink transition-colors hover:bg-line2"
        >
          elegir {sel === "sugerida" ? "la sugerida" : "la tuya"}
        </button>
      ) : null}

      {/* SIN "ver otras de mi clóset", y por dos razones (Roberto, 2026-08-13):
          la de producto y la de defecto.
          · Producto: el duelo declara "éstas son las dos contendientes". Una
            tercera puerta a buscar dice, en la misma card, que no confiamos en
            lo que acabamos de proponer. Es el MISMO argumento con el que se
            quitó la lupa de "no lo tienes".
          · Defecto: suggestTripSubstitutes filtra las prendas ya usadas por
            `sub:` y por el match — NO por `cand:`. O sea que en un duelo nacido
            de una falta, "ver otras" pagaba una llamada de IA nueva para
            devolver una lista cuyo #1 era la prenda que ya estabas viendo.
          El cambio de prenda no se pierde del producto: el zoom de cualquier
          prenda de "ya lo tienes" trae "no me convence — cámbiala" (y ahí SÍ
          filtra bien lo ya usado). Aquí se decide entre lo propuesto; el
          intercambio vive sobre la prenda ya elegida. */}
    </li>
  );
}

/** Una mitad del duelo. Elegida = anillo de tinta sobre la foto, SIN relleno:
 *  ese gris es el del botón de elegir y juntos se funden en un bloque. */
function DuelOpViaje({
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
      {/* Alto FIJO (no aspect-ratio): las dos fotos y los dos pies caen en la
          misma línea base sin importar la proporción de cada archivo. */}
      {/* EL FONDO ES `bg` Y NO `tile`, y la diferencia se ve: los renders de
          prenda vienen sobre papel #F5F3F0 y traen proporciones distintas —la
          sugerida del catálogo es 3:4, la tuya del clóset suele ser 1:1— así
          que con `object-contain` SIEMPRE sobra fondo en uno de los dos lados.
          Con `tile` (#f7f6f4, a 9 puntos del papel) ese sobrante dibujaba un
          rectángulo visible y la divisoria real se perdía dentro de él: lo que
          se leía como línea era el borde de la segunda foto (Roberto,
          2026-08-13). `bg` (#f4f3f1) está a 2 puntos: el sobrante desaparece,
          las dos mitades quedan como un solo campo y la hairline se ve. */}
      <span className="relative block h-[172px] w-full overflow-hidden bg-bg">
        {children}
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
        className={`block min-h-12 px-[11px] pb-[11px] pt-[3px] text-[13.5px] leading-[17px] text-ink ${
          elegida ? "font-bold" : "font-semibold"
        }`}
      >
        {nombre}
      </span>
    </button>
  );
}

// LA MISMA PANTALLA, DOS FASES — el flujo del handoff de Roberto (2026-08-13):
//
//   1. EL PLAN (antes de confirmar): revisar qué propone la maleta, en SU
//      orden — lo que te falta y deberías comprar arriba, lo que te sugiero
//      del clóset y puedes cambiar en medio, lo que ya tienes hasta abajo — y
//      cerrar con "arma mis looks". SIN cheques ni barra de empacado: todavía
//      no estás empacando, estás decidiendo.
//   2. LA MALETA (después): los cheques de empacar + "empacar todo" + el
//      progreso. Aquí ya no se decide, se mete a la maleta.
//
// La primera versión del candado dejó la pantalla vieja (cheques desde el
// primer segundo) y Roberto la rebotó con razón: "no se parece nada al flujo
// del handoff". La frontera entre fases es la misma señal del candado de
// looks: confirmado ≡ ya generaste alguna vez (trips.outfits !== null) — cero
// columnas nuevas. Confirmar ES generar; al regresar de los looks, esta
// pestaña ya amaneció en modo maleta.
export function TripResult({
  tripId,
  rows,
  savedWishKeys = [],
  confirmado = true,
  candidatasIniciales = {},
  descartadosIniciales = [],
  ganadosIniciales = [],
}: {
  tripId: string;
  rows: TripRow[];
  savedWishKeys?: string[];
  /** false = fase de plan (revisar y confirmar); true = fase de empacar. */
  confirmado?: boolean;
  /** Candidatas del duelo ya persistidas (overrides "cand:i"). */
  candidatasIniciales?: Record<number, Candidata>;
  /** Duelos ya cerrados con "prefiero la sugerida" ("candNo:i"). */
  descartadosIniciales?: number[];
  /** Duelos ya ganados por TU prenda (cand:i === sub:i). */
  ganadosIniciales?: number[];
}) {
  // Flujo maleta→looks (CTA "Generar/Ver mis looks"): viene del context de TripTabs,
  // no por props — cruzan la frontera RSC y la inyección por cloneElement no llegaba
  // (botón muerto). Ver components/trip-gen-context.
  const { onGenerateLooks, onViewLooks, looksExist, generating } = useTripGen();
  // El estado de empacado vive en el context (lo comparte el rail de desktop).
  const { packed, setPackedFor } = useTripPacked();
  const [zoom, setZoom] = useState<(PrendaZoomData & { index: number }) | null>(null);
  // Sustitutos elegidos en esta sesión (optimista; el server los persiste).
  const [localSub, setLocalSub] = useState<
    Record<number, { by: string; byImage: string | null }>
  >({});
  // Flujo "Buscar en mi clóset": hoja con candidatos de la IA. Dos modos:
  // "falta" (cubrir un hueco sin comprar) y "swap" ("no me convence" sobre una prenda
  // ya cubierta — cámbiala por otra del clóset).
  const [subFlow, setSubFlow] = useState<{
    index: number;
    nombre: string;
    mode: "falta" | "swap";
    status: "loading" | "done" | "empty" | "error";
    candidates: SubstituteCandidate[];
  } | null>(null);
  const isPacked = (i: number) => !!packed[String(i)];
  const router = useRouter();
  // EL DUELO (pieza C, 2026-08-13): la candidata de tu clóset para cada falta,
  // propuesta sola en vez de escondida tras la lupa. Server-first (persistidas
  // en overrides), y el efecto de abajo completa las que falten UNA vez.
  const [candidatas, setCandidatas] = useState<Record<number, Candidata>>(candidatasIniciales);
  const [descartados, setDescartados] = useState<Set<number>>(
    () => new Set(descartadosIniciales)
  );
  const propuse = useRef(false);
  // PRECALENTAR LAS SUGERIDAS SIN IMAGEN — la misma medicina que la cápsula
  // (lib/prewarm-renders, queja de Alberto 2026-07-30) y la misma queja aquí,
  // ahora de Roberto: "está medio fea la experiencia de tener que picar uno
  // por uno". El viaje nunca recibió el mecanismo, y el duelo lo volvió
  // urgente: un duelo con un lado gris es una comparación rota.
  //
  // SOLO las ideales (van a la biblioteca compartida — el segundo usuario con
  // ese combo no paga nada). Las prendas TUYAS sin foto no se auto-renderizan:
  // ese render es personal, por prenda, y tiene su propio flujo.
  const [prewarmed, setPrewarmed] = useState<Record<string, string>>({});
  useEffect(() => {
    const jobs: PrewarmJob[] = rows
      .filter((r) => (eff(r) === "falta" || eff(r) === "parecido") && !r.idealImage)
      .map((r) => ({ key: String(r.index), args: r.renderArgs }));
    if (jobs.length === 0) return;
    const abort = new AbortController();
    void prewarmRenders(jobs, (key, url) => setPrewarmed((m) => ({ ...m, [key]: url })), abort.signal);
    return () => abort.abort();
    // Al montar, una vez: si una falta se resuelve a media cola, el render de
    // más cae igual a la biblioteca compartida — no se pierde.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** La fila con su render precalentado, si ya llegó. El KEY del card cambia
   *  con la imagen a propósito: useIdealRender siembra su estado del prop
   *  inicial y no reacciona a cambios — remontar es lo que lo enciende. */
  const conRender = (r: TripRow): TripRow =>
    prewarmed[String(r.index)] ? { ...r, idealImage: prewarmed[String(r.index)] } : r;
  const renderKey = (r: TripRow) => `${r.index}${prewarmed[String(r.index)] ? ":img" : ""}`;
  useEffect(() => {
    // Solo en fase de plan, solo una vez, y solo si hay faltas sin resolver.
    // proposeTripSubstitutes es idempotente y barato de llamar de más (si no
    // hay huecos nuevos regresa vacío sin tocar la IA), pero el guard evita el
    // doble disparo del strict mode y los re-renders.
    if (confirmado || propuse.current) return;
    const hayHuecoSinPropuesta = rows.some(
      (r) =>
        eff(r) === "falta" &&
        candidatasIniciales[r.index] === undefined &&
        !descartadosIniciales.includes(r.index)
    );
    if (!hayHuecoSinPropuesta) return;
    propuse.current = true;
    void proposeTripSubstitutes(tripId).then((nuevas) => {
      setCandidatas((c) => ({ ...nuevas, ...c }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // "Ya lo tengo" en curso por índice (agrega al clóset + genera imagen, ~unos seg).
  const [ownBusy, setOwnBusy] = useState<Set<number>>(new Set());
  // Wishlist in-situ (coherente con la cápsula del clóset): manda/quita una
  // faltante de "lo que deberías comprar" sin sacarla de la maleta. Optimista + toast.
  const [wishSaved, setWishSaved] = useState<Set<string>>(() => new Set(savedWishKeys));
  const [toast, setToast] = useState<string | null>(null);

  function toggleWish(r: TripRow) {
    const key = r.faltaKey;
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
    void toggleWishlistFromCapsule({
      capsuleKey: key,
      name: r.nombre,
      colorHex: familiaToHex(r.renderArgs.colorFamilia),
      imageUrl: r.idealImage,
      porque: r.porque,
    });
  }

  // by/byImage efectivos: el sustituto elegido esta sesión gana sobre lo del server.
  const ov = (r: TripRow) => localSub[r.index] ?? { by: r.by, byImage: r.byImage };

  // Empaca: lo que tienes/parecido + cualquier faltante ya marcado "ya lo tengo".
  // Te falta: lo que falta y aún no marcas.
  const empaca = rows.filter((r) => eff(r) !== "falta" || isPacked(r.index));
  const falta = rows.filter((r) => eff(r) === "falta" && !isPacked(r.index));
  const packedCount = empaca.filter((r) => isPacked(r.index)).length;
  // Decisiones de duelo de ESTA sesión (parecido aceptado/rechazado), encima
  // de lo que el server ya sabe. El server las persiste (setTripOverride);
  // esto es el espejo optimista.
  const [localDecide, setLocalDecide] = useState<Record<number, "accept" | "reject">>({});
  // EL DUELO ABIERTO (uno a la vez, patrón de la cápsula — Roberto: "para no
  // mostrar tanto de golpe... ya que escoges, se va haciendo grande el otro").
  // null = el primero pendiente. Al decidir uno, vuelve a null y el siguiente
  // se abre solo.
  const [duelAbierto, setDuelAbierto] = useState<number | null>(null);
  /** Duelos ganados por tu prenda, para pintarles su "deshacer". Arranca del
   *  server y crece con lo que decidas en esta sesión. */
  const [ganados, setGanados] = useState<Set<number>>(() => new Set(ganadosIniciales));
  /** Deshacer: limpia veredicto local Y en la base, y reabre ese duelo. */
  function deshacerDuelo(index: number) {
    setGanados((g) => {
      const n = new Set(g);
      n.delete(index);
      return n;
    });
    setDescartados((d) => {
      const n = new Set(d);
      n.delete(index);
      return n;
    });
    setLocalDecide((d) => {
      const n = { ...d };
      delete n[index];
      return n;
    });
    setLocalSub((s) => {
      const n = { ...s };
      delete n[index];
      return n;
    });
    setPackedFor(index, false);
    setDuelAbierto(index);
    void undoTripDuel(tripId, index);
  }
  const effLocal = (r: TripRow): TripRow["base"] => {
    const d = localDecide[r.index];
    if (d === "accept") return "tienes";
    if (d === "reject") return "falta";
    return eff(r);
  };

  // LOS GRUPOS DE LA FASE DE PLAN, partidos por SIGNIFICADO (segunda ronda de
  // Roberto): si hay comparación sugerida-vs-tuya, es duelo — venga del match
  // ("parecido") o de la búsqueda de candidatas (falta con candidata). Lo que
  // no tiene con qué compararse es compra; lo cubierto es "ya lo tienes".
  // Un duelo RESUELTO no desaparece: se queda en su sección, marcado y con su
  // "deshacer" (patrón de la cápsula — Roberto: "esto antes ya lo teníamos
  // así"). Los que ganó la sugerida SÍ se mudan a compras, porque ahí es donde
  // viven sus acciones reales (wishlist / ya lo tengo), y ahí llevan el
  // "deshacer" en el topAction.
  const duelos: {
    r: TripRow;
    tuya: Candidata;
    tipo: "falta" | "parecido";
    ganado: boolean;
  }[] = [];
  const planCompras: { r: TripRow; deDuelo: boolean }[] = [];
  const planTienes: TripRow[] = [];
  for (const r of rows) {
    const cand = candidatas[r.index];
    const esParecido = r.base === "parecido";
    if (!esParecido && !cand) {
      // Nunca fue duelo: el camino de siempre.
      const e = effLocal(r);
      if (e === "falta" && !isPacked(r.index) && !localSub[r.index]) {
        planCompras.push({ r, deDuelo: false });
      } else if (e !== "pendiente") {
        planTienes.push(r);
      }
      continue;
    }
    // Es (o fue) un duelo. ¿En qué quedó?
    const tuya: Candidata = esParecido
      ? { nombre: ov(r).by ?? r.nombre, image: ov(r).byImage }
      : cand!;
    const tipo = esParecido ? ("parecido" as const) : ("falta" as const);
    const decision = localDecide[r.index] ?? (esParecido ? r.decision : null);
    const gano =
      decision === "accept" || ganados.has(r.index) || !!localSub[r.index];
    const perdio = decision === "reject" || descartados.has(r.index);
    if (perdio) planCompras.push({ r, deDuelo: true });
    else duelos.push({ r, tuya, tipo, ganado: gano });
  }
  /** El duelo abierto: el elegido a mano, o el PRIMERO sin resolver. */
  const abierto =
    duelos.find((d) => d.r.index === duelAbierto)?.r.index ??
    duelos.find((d) => !d.ganado)?.r.index ??
    null;


  function togglePacked(index: number, value?: boolean) {
    const next = value ?? !isPacked(index);
    setPackedFor(index, next);
    setTripPacked(tripId, index, next);
  }

  // "Empacar todo": palomear 15 prendas de una en una es tedio puro (queja de
  // Roberto al pedirlo). Optimista + UN write (la action hace merge, así que
  // correrlo con la mitad ya palomeada solo suma las que faltan).
  function empacarTodo() {
    const faltantes = empaca.filter((r) => !isPacked(r.index)).map((r) => r.index);
    if (faltantes.length === 0) return;
    for (const i of faltantes) setPackedFor(i, true);
    setTripPackedAll(tripId, faltantes);
  }

  // "Ya lo tengo" sobre un faltante: lo suma a tu clóset de verdad + le genera
  // imagen (server, inline) y lo marca cubierto en el viaje. Spinner mientras;
  // al terminar, refresca y la prenda se reubica en "Empaca esto" con su imagen.
  async function marcarYaLoTengo(index: number) {
    setOwnBusy((s) => new Set(s).add(index));
    const res = await markTripFaltaOwned(tripId, index);
    if (res.ok) router.refresh();
    setOwnBusy((s) => {
      const n = new Set(s);
      n.delete(index);
      return n;
    });
  }

  async function buscarSustituto(r: TripRow, mode: "falta" | "swap" = "falta") {
    setSubFlow({ index: r.index, nombre: r.nombre, mode, status: "loading", candidates: [] });
    try {
      const cands = await suggestTripSubstitutes(tripId, r.index);
      setSubFlow({
        index: r.index,
        nombre: r.nombre,
        mode,
        status: cands.length ? "done" : "empty",
        candidates: cands,
      });
    } catch {
      setSubFlow({ index: r.index, nombre: r.nombre, mode, status: "error", candidates: [] });
    }
  }

  function elegirSustituto(index: number, c: SubstituteCandidate) {
    setLocalSub((s) => ({ ...s, [index]: { by: c.nombre, byImage: c.image } }));
    setPackedFor(index, true);
    setSubFlow(null);
    setTripSubstitute(tripId, index, c.nombre);
  }

  return (
    <div className="flex flex-col gap-4">
      <Toast message={toast} />

      {/* ══ FASE 1: EL PLAN — el orden del handoff: lo que pide decisión
          arriba, lo resuelto abajo. REACOMODO 2026-08-13 (segunda ronda de
          Roberto): las secciones se parten por SIGNIFICADO, no por origen del
          dato. "No lo tienes" = solo lo que de verdad no hay con qué cubrir
          (comprar/wishlist). "Decide si te sirve" = TODO lo que compara la
          sugerida contra algo tuyo — venga del match (parecido) o de la
          búsqueda de candidatas (falta con candidata). La primera versión puso
          el duelo dentro de "no lo tienes" porque el dato nace de una falta, y
          Roberto lo rebotó: para quien mira, si hay comparación, es decisión. ══ */}
      {!confirmado ? (
        <>
          {planCompras.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">
                  No lo tienes — cómpralo o cúbrelo
                </span>
                <span className="tabular text-[11px] text-muted">{planCompras.length}</span>
              </div>
              <ul className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3">
                {planCompras.map(({ r, deDuelo }) => (
                  <FaltaCard
                    key={renderKey(r)}
                    row={conRender(r)}
                    ownBusy={ownBusy.has(r.index)}
                    onYaLoTengo={() => marcarYaLoTengo(r.index)}
                    wishSaved={wishSaved.has(r.faltaKey)}
                    onToggleWish={() => toggleWish(r)}
                    onDeshacer={deDuelo ? () => deshacerDuelo(r.index) : undefined}
                  />
                ))}
              </ul>
            </div>
          ) : null}

          {duelos.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between">
                {/* El nombre de la cápsula, que Roberto pidió de referencia:
                    aquí viven TODAS las comparaciones sugerida-vs-tuya. */}
                <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">
                  Decide si te sirve — la sugerida o la tuya
                </span>
                <span className="tabular text-[11px] text-muted">{duelos.length}</span>
              </div>
              <ul className="flex flex-col gap-2.5 lg:max-w-[560px]">
                {duelos.map(({ r, tuya, tipo, ganado }) =>
                  ganado ? (
                    // RESUELTO a favor de tu prenda: se queda a la vista con su
                    // veredicto y su deshacer. Desaparecer sin dejar rastro era
                    // lo que dejaba la decisión sin vuelta atrás.
                    <li
                      key={renderKey(r)}
                      className="flex items-center gap-3 rounded-md border border-line bg-surface p-2.5"
                    >
                      <span className="relative block h-[52px] w-[40px] shrink-0 overflow-hidden rounded-sm border border-line bg-tile">
                        {tuya.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={tuya.image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-muted">
                            <Icon name="gancho" size={13} />
                          </span>
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[9.5px] font-bold uppercase tracking-[0.13em] text-faint">
                          te quedas con la tuya
                        </span>
                        <b className="truncate text-[13.5px] font-semibold text-ink">
                          {tuya.nombre}
                        </b>
                      </span>
                      <button
                        type="button"
                        onClick={() => deshacerDuelo(r.index)}
                        className="flex shrink-0 items-center gap-1 text-[12px] font-semibold text-muted transition-colors hover:text-ink"
                      >
                        <Icon name="repetir" size={13} /> deshacer
                      </button>
                    </li>
                  ) : abierto !== r.index ? (
                    // Compacta: la decisión existe y espera turno. Tap = abrirla.
                    <li key={renderKey(r)}>
                      <button
                        type="button"
                        onClick={() => setDuelAbierto(r.index)}
                        className="flex w-full items-center gap-3 rounded-md border border-line bg-surface p-2.5 text-left transition-colors hover:border-ink"
                      >
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span className="relative block h-[52px] w-[40px] overflow-hidden rounded-sm border border-line bg-tile">
                            {conRender(r).idealImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={conRender(r).idealImage!} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-muted">
                                <Icon name="gancho" size={13} />
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] font-bold uppercase text-muted">vs</span>
                          <span className="relative block h-[52px] w-[40px] overflow-hidden rounded-sm border border-line bg-tile">
                            {tuya.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={tuya.image} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-muted">
                                <Icon name="gancho" size={13} />
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <b className="truncate text-[13.5px] font-semibold text-ink">{r.nombre}</b>
                          <span className="truncate text-[11.5px] text-muted">
                            ¿o tu {tuya.nombre}?
                          </span>
                        </span>
                        <Icon name="chevron" size={16} className="shrink-0 text-muted" />
                      </button>
                    </li>
                  ) : (
                  <DueloCard
                    key={renderKey(r)}
                    row={conRender(r)}
                    tuya={tuya}
                    onMia={() => {
                      setDuelAbierto(null);
                      if (tipo === "falta") {
                        elegirSustituto(r.index, { nombre: tuya.nombre, image: tuya.image, porque: "" });
                      } else {
                        // Parecido: "me quedo con la mía" = aceptar el match.
                        setLocalDecide((d) => ({ ...d, [r.index]: "accept" }));
                        void setTripOverride(tripId, r.index, "accept");
                      }
                    }}
                    onSugerida={() => {
                      setDuelAbierto(null);
                      if (tipo === "falta") {
                        setDescartados((d) => new Set(d).add(r.index));
                        void dismissTripCandidate(tripId, r.index);
                      } else {
                        // Parecido: "prefiero la sugerida" = tu prenda no la
                        // cubre → pasa a compras. El candNo va detrás para que
                        // el hueco recién nacido no re-abra duelo con OTRA
                        // candidata: ya dijiste que quieres la sugerida.
                        // Secuencial a propósito — las dos actions hacen
                        // read-modify-write del MISMO blob de overrides.
                        setLocalDecide((d) => ({ ...d, [r.index]: "reject" }));
                        setDescartados((d) => new Set(d).add(r.index));
                        void (async () => {
                          await setTripOverride(tripId, r.index, "reject");
                          await dismissTripCandidate(tripId, r.index);
                        })();
                      }
                    }}
                  />
                  )
                )}
              </ul>
            </div>
          ) : null}

          {planTienes.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">
                  Ya lo tienes
                </span>
                <span className="tabular text-[11px] text-muted">{planTienes.length}</span>
              </div>
              <p className="-mt-1 text-[11.5px] leading-snug text-muted">
                toca una para ver por qué va — y si no te late, ahí la cambias
              </p>
              {/* SIN cheques y a plena opacidad: aquí no se empaca, se revisa.
                  Los cheques llegan con la fase de maleta, tras confirmar. */}
              <ul className="grid grid-cols-4 gap-2">
                {planTienes.map((r) => {
                  const { by, byImage } = ov(r);
                  return (
                    <li key={r.index}>
                      <button
                        type="button"
                        onClick={() =>
                          setZoom({
                            index: r.index,
                            image: byImage,
                            nombre: by ?? r.nombre,
                            sub: r.porque,
                          })
                        }
                        title={by ?? r.nombre}
                        aria-label={`Ver ${by ?? r.nombre}`}
                        className="block w-full"
                      >
                        <span className="relative block aspect-[3/4] overflow-hidden rounded-md border border-line bg-surface">
                          {byImage ? (
                            <Image
                              src={byImage}
                              alt={by ?? r.nombre}
                              fill
                              sizes="(max-width:430px) 25vw, 100px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-muted">
                              <Icon name="gancho" size={20} />
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      {/* ══ FASE 2: LA MALETA — cheques, empacar todo y progreso. ══ */}

      {/* Progreso de empacado (móvil — en desktop vive en el rail izquierdo) */}
      {confirmado ? (
      <div className="flex items-center gap-2.5 lg:hidden">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${empaca.length ? (packedCount / empaca.length) * 100 : 0}%` }}
          />
        </div>
        <span className="tabular whitespace-nowrap text-xs font-semibold text-ink">
          {packedCount} / {empaca.length} empacadas
        </span>
      </div>
      ) : null}

      {confirmado && empaca.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">
              <span className="lg:hidden">Empaca esto</span>
              <span className="hidden lg:inline">Por empacar — palomea al meterla</span>
            </span>
            {/* "empacar todo" solo mientras quede algo por palomear: ya completo
                sería un botón muerto ocupando el lugar del conteo. */}
            {packedCount < empaca.length ? (
              <button
                type="button"
                onClick={empacarTodo}
                className="text-[12px] font-semibold text-ink underline underline-offset-2 hover:text-accent"
              >
                empacar todo
              </button>
            ) : (
              <span className="tabular text-[11px] text-muted">{empaca.length}</span>
            )}
          </div>
          {/* El porqué de cada prenda vive tras el tap (y ahí también se cambia) —
              sin esta línea nadie lo descubre. En desktop el porqué ya es visible. */}
          <p className="-mt-1 text-[11.5px] leading-snug text-muted lg:hidden">
            toca una prenda para ver por qué va — y si no te late, ahí la cambias
          </p>

          {/* Desktop (handoff desktop_f3): filas compactas con el PORQUÉ visible.
              Tap en la fila → zoom (ahí vive el swap); check a la derecha. */}
          <ul className="hidden lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-2.5">
            {empaca.map((r) => {
              const on = isPacked(r.index);
              const { by, byImage } = ov(r);
              return (
                <li key={r.index} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setZoom({
                        index: r.index,
                        image: byImage,
                        nombre: by ?? r.nombre,
                        sub: r.porque,
                      })
                    }
                    className="group flex min-w-0 flex-1 items-center gap-3 rounded-md py-1 text-left"
                  >
                    <span
                      className={`relative block h-[64px] w-[52px] shrink-0 overflow-hidden rounded-sm border border-line bg-surface ${
                        on ? "opacity-55" : ""
                      }`}
                    >
                      {byImage ? (
                        <Image src={byImage} alt="" fill sizes="52px" className="object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-muted">
                          <Icon name="gancho" size={16} />
                        </span>
                      )}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span
                        className={`truncate text-[13.5px] font-semibold ${
                          on ? "text-muted line-through" : "text-ink group-hover:underline"
                        }`}
                      >
                        {by ?? r.nombre}
                      </span>
                      <span className="line-clamp-2 text-[11.5px] leading-snug text-muted">
                        {r.porque}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePacked(r.index)}
                    aria-label={on ? "Quitar de la maleta" : "Empacar"}
                    aria-pressed={on}
                    className="shrink-0 p-1"
                  >
                    <span
                      className={`flex h-[22px] w-[22px] items-center justify-center rounded-full transition-colors ${
                        on ? "bg-accent text-on-accent" : "border-[1.5px] border-line hover:border-ink"
                      }`}
                    >
                      {on ? <Icon name="check" size={13} strokeWidth={2.4} /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <ul className="grid grid-cols-4 gap-2 lg:hidden">
            {empaca.map((r) => {
              const on = isPacked(r.index);
              const { by, byImage } = ov(r);
              return (
                <li key={r.index} className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setZoom({
                        index: r.index,
                        image: byImage,
                        nombre: by ?? r.nombre,
                        sub: r.porque,
                      })
                    }
                    title={by ?? r.nombre}
                    aria-label={`Ver ${by ?? r.nombre}`}
                    className="block w-full"
                  >
                    <span className="relative block aspect-[3/4] overflow-hidden rounded-md border border-line bg-surface">
                      {byImage ? (
                        <Image
                          src={byImage}
                          alt={by ?? r.nombre}
                          fill
                          sizes="(max-width:430px) 25vw, 100px"
                          className={`object-cover ${on ? "" : "opacity-[0.62]"}`}
                        />
                      ) : (
                        <span
                          className={`flex h-full w-full items-center justify-center text-muted ${
                            on ? "" : "opacity-[0.62]"
                          }`}
                        >
                          <Icon name="gancho" size={20} />
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePacked(r.index)}
                    aria-label={on ? "Quitar de la maleta" : "Empacar"}
                    aria-pressed={on}
                    className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center"
                  >
                    <span
                      className={`flex h-[19px] w-[19px] items-center justify-center rounded-full ${
                        on ? "bg-accent text-on-accent" : "border-[1.5px] border-line bg-bg/85"
                      }`}
                    >
                      {on ? <Icon name="check" size={12} strokeWidth={2.4} /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {confirmado && falta.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">
              <span className="lg:hidden">Te falta</span>
              <span className="hidden lg:inline">Te falta conseguir</span>
            </span>
            <span className="tabular text-[11px] text-muted">{falta.length}</span>
          </div>
          <ul className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3">
            {falta.map((r) => (
              <FaltaCard
                key={renderKey(r)}
                row={conRender(r)}
                ownBusy={ownBusy.has(r.index)}
                onYaLoTengo={() => marcarYaLoTengo(r.index)}
                wishSaved={wishSaved.has(r.faltaKey)}
                onToggleWish={() => toggleWish(r)}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {/* Cierre del paso "maleta": de aquí se pasa a generar los looks. */}
      {empaca.length > 0 ? (
        <div className="flex flex-col gap-1.5 pt-1">
          {looksExist ? (
            <button
              type="button"
              onClick={onViewLooks}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm border border-line bg-surface text-sm font-semibold text-ink transition-colors duration-200 hover:border-ink"
            >
              ver mis looks
            </button>
          ) : (
            <button
              type="button"
              onClick={onGenerateLooks}
              disabled={generating}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-accent text-sm font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
            >
              {/* En fase de plan el botón ES la confirmación del handoff:
                  "me late" = quedó el plan, arma los looks y pasa a empacar. */}
              <Icon name="destello" size={18} />{" "}
              {confirmado ? "generar mis looks" : "me late — arma mis looks"}
            </button>
          )}
          {!looksExist && falta.length > 0 ? (
            <p className="text-center text-[11.5px] text-muted">
              Los armo con lo que ya empacas — te {falta.length === 1 ? "falta" : "faltan"}{" "}
              {falta.length} {falta.length === 1 ? "prenda" : "prendas"}.
            </p>
          ) : null}
        </div>
      ) : null}

      <PrendaZoom
        data={zoom}
        onClose={() => setZoom(null)}
        action={
          zoom ? (
            <div className="flex flex-col gap-2">
              {confirmado ? (
              <button
                type="button"
                onClick={() => {
                  togglePacked(zoom.index);
                  setZoom(null);
                }}
                className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-sm text-sm font-semibold transition-colors duration-200 ${
                  isPacked(zoom.index)
                    ? "border border-line bg-surface text-muted hover:border-ink hover:text-ink"
                    : "bg-accent text-on-accent hover:bg-accent-deep"
                }`}
              >
                {isPacked(zoom.index) ? (
                  "quitar de la maleta"
                ) : (
                  <>
                    <Icon name="check" size={16} /> empacar
                  </>
                )}
              </button>
              ) : null}
              {/* Swap "no me convence": busca en el clóset otra prenda que cubra este
                  hueco (mismo flujo que "buscar en mi clóset" de las faltantes). */}
              <button
                type="button"
                onClick={() => {
                  const r = rows.find((x) => x.index === zoom.index);
                  setZoom(null);
                  if (r) void buscarSustituto(r, "swap");
                }}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm border border-line bg-surface text-sm font-semibold text-ink transition-colors duration-200 hover:border-ink"
              >
                <Icon name="repetir" size={15} /> no me convence — cámbiala
              </button>
            </div>
          ) : null
        }
      />

      {subFlow ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center lg:items-center bg-ink/50"
          onClick={() => setSubFlow(null)}
        >
          <div
            className="flex max-h-[85dvh] w-full max-w-[430px] flex-col gap-3 overflow-y-auto rounded-t-[18px] lg:rounded-[18px] bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"
            style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="h-1 w-9 rounded-full bg-line" aria-hidden />
              <button
                type="button"
                onClick={() => setSubFlow(null)}
                aria-label="Cerrar"
                className="-mr-1 flex h-9 w-9 items-center justify-center text-muted hover:text-ink"
              >
                <Icon name="equis" size={20} />
              </button>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">
                {subFlow.mode === "swap" ? "Cambiar" : "Sustituir"}
              </span>
              <span className="editorial text-h3 leading-tight text-ink">{subFlow.nombre}</span>
            </div>

            {subFlow.status === "loading" ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <Spinner className="h-7 w-7 text-accent" />
                <p className="text-base font-medium text-ink">buscando en tu clóset…</p>
              </div>
            ) : null}

            {subFlow.status === "empty" ? (
              <p className="rounded-md border border-line bg-bg px-4 py-6 text-center text-sm text-muted">
                {subFlow.mode === "swap"
                  ? "No tengo nada más en tu clóset que cubra esto igual de bien — si no te late, quítala de la maleta y listo."
                  : "Nada de tu clóset lo cubre bien — para esta tendrías que conseguirla."}
              </p>
            ) : null}

            {subFlow.status === "error" ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-sm text-error">
                  El servicio está ocupado un momento — espera unos segundos y reintenta.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const r = rows.find((x) => x.index === subFlow.index);
                    if (r) void buscarSustituto(r, subFlow.mode);
                  }}
                  className="min-h-10 rounded-sm border border-line bg-surface px-4 text-sm font-medium text-ink hover:border-ink"
                >
                  Reintentar
                </button>
              </div>
            ) : null}

            {subFlow.status === "done" ? (
              <ul className="flex flex-col gap-2 pb-1">
                {subFlow.candidates.map((c) => (
                  <li key={c.nombre}>
                    <button
                      type="button"
                      onClick={() => elegirSustituto(subFlow.index, c)}
                      className="flex w-full items-center gap-3 rounded-md border border-line bg-surface p-2.5 text-left transition-colors hover:border-accent"
                    >
                      <span className="h-16 w-12 shrink-0 overflow-hidden rounded-sm border border-line bg-bg">
                        {c.image ? (
                          <Image
                            src={c.image}
                            alt={c.nombre}
                            width={48}
                            height={64}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-muted">
                            <Icon name="gancho" size={18} />
                          </span>
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <b className="text-sm font-semibold leading-tight text-ink">{c.nombre}</b>
                        {c.porque ? (
                          <span className="text-[11.5px] leading-snug text-muted">{c.porque}</span>
                        ) : null}
                      </span>
                      <Icon name="chevron" size={16} className="shrink-0 text-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
