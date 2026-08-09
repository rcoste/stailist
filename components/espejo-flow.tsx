"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toUsableImage } from "@/lib/image-file";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { addPhotoItems, ligarPrendasAlEspejo, ponerRenderAPrenda } from "@/app/closet/actions";
import { DraftCard, type DraftLeida } from "@/components/prenda-draft-card";
import type { PrendaDetectada } from "@/app/api/analizar-prendas/route";
import type { LecturaEspejo } from "@/lib/espejo";

// "¿ME VEO BIEN?" — el flujo de una sola pantalla.
//
// Todo lo que aquí se decide sale del encuadre (ver lib/espejo): ella pregunta,
// la amiga contesta. Eso manda sobre la UI:
//
// · NO hay calificación, ni estrellas, ni barra de "qué tan bien vas". Un
//   número convierte una respuesta en una nota, y una nota diaria a alguien
//   inseguro es otro producto.
// · La respuesta se lee de corrido, no en tarjetas separadas por categoría:
//   una amiga te dice tres cosas seguidas, no te entrega un informe.
// · La foto se ve grande arriba. Es SU foto, no un dato de entrada.
//
// SE SUBE ANTES DE PREGUNTAR: la foto va al bucket primero y su ruta viaja con
// la petición, así el diario guarda la imagen sin una segunda subida. Si la
// subida falla, se pregunta igual — el consejo es el trabajo, el diario es el
// registro.
export type EspejoHandle = { start: () => void };

type State =
  | { kind: "idle" }
  | { kind: "mirando"; preview: string }
  | {
      kind: "listo";
      preview: string;
      lectura: LecturaEspejo;
      outfitId: string | null;
      /** Dónde quedó la foto en Storage — la heredan las prendas que sume. */
      rutaFoto: string | null;
    }
  | { kind: "error"; msg: string };

// SUMAR AL CLÓSET LO QUE TRAES PUESTO — el segundo tiempo, opcional.
//
// El enemigo declarado del proyecto no es combinar ropa: es la fricción de
// catalogar el clóset. Si vestirte lo va llenando, ese problema se resuelve
// viviendo. Por eso vale la pena aunque la foto sea mal insumo para catalogar.
//
// PERO VA DESPUÉS Y APARTE, nunca automático:
// · el consejo es el trabajo — meterlo antes lo convierte en un trámite;
// · leer prendas es otra llamada de visión, y correrla a diario para alguien
//   que se puso lo que ya tiene sería pagar todos los días por nada;
// · nada entra sin que lo marque: una foto de espejo tiene oclusión, luz de
//   ambiente y prendas fuera de cuadro, y con la misma camisa tres veces por
//   semana el auto-alta llenaría el clóset de duplicados en un mes.
/** Una prenda de la foto que no se propone porque ya parece estar en el clóset. */
type YaEsta = { id: string; nombre: string; comoEsta: string; imagen: string | null };

type Sumar =
  | { paso: "buscando" }
  | { paso: "nada"; vistas: number; yaEstan: YaEsta[]; fallo?: boolean }
  | {
      paso: "elegir";
      prendas: DraftLeida[];
      tocados: Record<string, Set<string>>;
      vistas: number;
      /** Lo que descarté por parecerse a algo tuyo — se DICE, no se esconde. */
      yaEstan: YaEsta[];
    }
  | { paso: "guardando" }
  | {
      paso: "hecho";
      cuantas: number;
      /** Lo recién creado, para poder dibujarlo aquí mismo si quiere. */
      nuevas: { id: string; attrs: PrendaDetectada }[];
    }
  /**
   * DIBUJANDO AQUÍ MISMO — lo pidió Roberto: "debería darme la opción de
   * generar ahí las imágenes, no forzar a después, igual así evalúo si quedan
   * fieles, como en el flujo del multi upload".
   *
   * Las dos mitades importan, y la segunda más: no es sólo adelantar el dibujo,
   * es poder JUZGAR si se parece. Dejándolo para el clóset, un render infiel se
   * descubre días después y hay que ir a buscarlo.
   *
   * Sale de la FOTO (imagen→imagen, el mismo /api/render-prenda del carrete) y
   * no del nombre: con la prenda delante el modelo copia el corte y el color
   * reales en vez de inventar un "suéter azul marino" cualquiera.
   */
  | {
      paso: "dibujando";
      items: { id: string; attrs: PrendaDetectada; url: string | null; listo: boolean }[];
    };

// Comprime a 1280px: lo mismo que el resto de los flujos de foto.
function comprimir(file: Blob): Promise<{ dataUrl: string; blob: Blob }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const max = 1280;
      let { width, height } = img;
      if (width > height && width > max) {
        height = (height * max) / width;
        width = max;
      } else if (height > max) {
        width = (width * max) / height;
        height = max;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src);
          if (blob) resolve({ dataUrl, blob });
          else reject(new Error("no_blob"));
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** La ubicación, para el clima. Sin permiso se sigue sin clima, no se insiste. */
function dondeEstoy(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { timeout: 4000, maximumAge: 15 * 60 * 1000 }
    );
  });
}

export function EspejoFlow({
  userId,
  headless = false,
  ref,
}: {
  userId: string;
  headless?: boolean;
  ref?: Ref<EspejoHandle>;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [sumar, setSumar] = useState<Sumar>({ paso: "buscando" });
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useImperativeHandle(ref, () => ({ start: () => inputRef.current?.click() }), []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;

    let preview = "";
    try {
      const { dataUrl, blob } = await comprimir(await toUsableImage(file));
      preview = dataUrl;
      setState({ kind: "mirando", preview });

      // La foto y la ubicación, en paralelo: ninguna de las dos debe hacer
      // esperar a la otra.
      const [ruta, donde] = await Promise.all([
        (async () => {
          try {
            const supabase = createClient();
            const path = `${userId}/espejo-${crypto.randomUUID()}.jpg`;
            const up = await supabase.storage
              .from("prendas")
              .upload(path, blob, { contentType: "image/jpeg" });
            return up.error ? null : path;
          } catch {
            return null; // sin foto en el diario, pero el consejo sale igual
          }
        })(),
        dondeEstoy(),
      ]);

      // UNA ACCIÓN, DOS LLAMADAS, EN PARALELO — idea de Roberto.
      //
      // Son dos trabajos distintos y por eso son dos llamadas distintas desde el
      // principio: la evaluación la hace el modelo bueno con su propio prompt, y
      // el reconocimiento es EXACTAMENTE el mismo `leerPrendas` del multiprenda.
      // Mezclarlos en un prompt sería lo que ya se midió que cuesta caro (añadir
      // un campo al schema de un lector mueve otras lecturas con z = 3.05).
      //
      // Lo que cambia es que ya no hace falta pedir el segundo: antes vivía
      // detrás de un enlace, y si no lo tocabas, la entrada del diario se
      // quedaba sin prendas. Reconocer no depende del clima ni de la ubicación,
      // así que arranca a la vez y suele terminar ANTES que el consejo — cuando
      // el consejo aparece, la lista ya está.
      //
      // Y son independientes: si el reconocimiento falla, el consejo sale igual.
      const hora = new Date().getHours();
      const reconocer = fetch("/api/espejo/prendas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      const res = await fetch("/api/espejo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: dataUrl,
          photoPath: ruta,
          ...(donde ?? {}),
          momento: hora >= 19 || hora < 6 ? "noche" : "dia",
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        setState({
          kind: "error",
          msg:
            err.error === "permiso_pendiente" && err.message
              ? err.message
              : "No pude verte bien. Inténtalo con otra foto.",
        });
        return;
      }
      const lectura = (await res.json()) as LecturaEspejo & { outfitId?: string | null };
      const outfitId = lectura.outfitId ?? null;
      setSumar({ paso: "buscando" });
      setState({ kind: "listo", preview, lectura, outfitId, rutaFoto: ruta });

      // El reconocimiento, que ya venía corriendo.
      const rec = (await reconocer) as
        | { prendas: PrendaDetectada[]; vistas: number; yaEstan: YaEsta[] }
        | null;
      if (!rec) {
        setSumar({ paso: "nada", vistas: 0, yaEstan: [], fallo: true });
      } else {
        // Las suyas se cuelgan solas: no hay nada que confirmar en una prenda
        // que ya está en su clóset.
        if (outfitId && rec.yaEstan.length > 0) {
          await ligarPrendasAlEspejo(outfitId, rec.yaEstan.map((y) => y.id));
        }
        setSumar(
          rec.prendas.length === 0
            ? { paso: "nada", vistas: rec.vistas, yaEstan: rec.yaEstan }
            : {
                paso: "elegir",
                prendas: rec.prendas.map((p) => ({
                  id: crypto.randomUUID(),
                  attrs: p,
                  on: true,
                  photoPreview: preview,
                  leido: { color: p.color, hex: p.color_hex },
                })),
                tocados: {},
                vistas: rec.vistas,
                yaEstan: rec.yaEstan,
              }
        );
      }
      // El diario ya tiene una entrada nueva, con sus prendas.
      router.refresh();
    } catch {
      setState({ kind: "error", msg: "No pude leer la foto. Inténtalo otra vez." });
    }
  }

  /** Busca en la foto lo que NO parece estar ya en el clóset. */
  async function buscarPrendas(preview: string, outfitId: string | null) {
    setSumar({ paso: "buscando" });
    try {
      const res = await fetch("/api/espejo/prendas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: preview }),
      });
      // "Falló ahora" NO es "no se ven prendas": lo primero se reintenta, lo
      // segundo no. Decirle lo segundo cuando pasó lo primero le quita la única
      // salida que tenía.
      if (!res.ok) return setSumar({ paso: "nada", vistas: 0, yaEstan: [], fallo: true });
      const { prendas, vistas, yaEstan } = (await res.json()) as {
        prendas: PrendaDetectada[];
        vistas: number;
        yaEstan: YaEsta[];
      };
      // LAS RECONOCIDAS SE CUELGAN EN CUANTO SE SABEN, sin esperar a que sume
      // nada: son prendas suyas que la foto identificó, y el look ya se puede
      // ver completo aunque decida no añadir ninguna de las nuevas.
      if (outfitId && yaEstan.length > 0) {
        void ligarPrendasAlEspejo(outfitId, yaEstan.map((y) => y.id)).then(() => router.refresh());
      }
      if (prendas.length === 0) return setSumar({ paso: "nada", vistas, yaEstan });
      setSumar({
        paso: "elegir",
        prendas: prendas.map((p) => ({
          id: crypto.randomUUID(),
          attrs: p,
          // Todas encendidas: ya se filtró lo que parece estar, así que lo
          // normal es quererlas. Apagar es la excepción.
          on: true,
          photoPreview: preview,
          leido: { color: p.color, hex: p.color_hex },
        })),
        tocados: {},
        vistas,
        yaEstan,
      });
    } catch {
      setSumar({ paso: "nada", vistas: 0, yaEstan: [], fallo: true });
    }
  }

  /** Guarda las marcadas. La imagen limpia la dibuja el clóset después. */
  async function guardarPrendas(outfitId: string | null, rutaFoto: string | null) {
    if (sumar.paso !== "elegir") return;
    const elegidas = sumar.prendas.filter((p) => p.on);
    if (elegidas.length === 0) return setSumar({ paso: "hecho", cuantas: 0, nuevas: [] });
    setSumar({ paso: "guardando" });
    try {
      const res = await addPhotoItems(
        elegidas.map((p) => ({
          // Lo que corrigió a mano viaja como confirmado, igual que en el
          // carrete: es el MISMO contrato, porque ahora es la misma tarjeta.
          attrs: { ...p.attrs, confirmados: [...(sumar.tocados[p.id] ?? [])] },
          // SIN RENDER Y SIN FOTO, las dos cosas a propósito:
          //
          // · renderStatus "none" (ni 'failed' ni null): dibujar cinco prendas
          //   son ~85s y aquí la persona está saliendo de su casa. Entran sin
          //   imagen y el auto-sanado del clóset las dibuja después — pero ESE
          //   sólo recoge las que están en 'none'. Con 'failed' se quedarían sin
          //   imagen para siempre; con null el insert truena (la columna es NOT
          //   NULL) y no se suma NADA, que es lo que pasó.
          // · photoPath null aunque la foto exista: es un espejo de cuerpo
          //   entero, no la prenda. Ponerla haría que la miniatura de "camisa
          //   blanca" fuera tu foto completa, y además bloquearía el dibujo
          //   limpio (tener foto cuenta como tener imagen).
          renderPath: null,
          renderStatus: "none" as const,
          photoPath: null,
          // De qué foto salió. NO va en photoPath —eso decidiría la miniatura y
          // enseñaría su cuerpo entero— pero sí deja que el clóset la dibuje
          // después con la misma técnica que el carrete: desde la foto.
          origenFoto: rutaFoto,
        }))
      );
      // Las recién creadas se cuelgan del mismo look: la entrada del diario
      // queda con TODO lo que traía puesto, lo suyo de antes y lo de hoy.
      const idsNuevos = res.ok ? res.ids ?? [] : [];
      if (outfitId && idsNuevos.length > 0) {
        await ligarPrendasAlEspejo(outfitId, [
          ...sumar.yaEstan.map((y) => y.id),
          ...idsNuevos,
        ]);
      }
      setSumar({
        paso: "hecho",
        cuantas: res.ok ? res.added : 0,
        // Los ids llegan en el MISMO orden en que se insertaron, que es el de
        // `elegidas`: por eso se emparejan por índice.
        nuevas: idsNuevos.map((id, i) => ({ id, attrs: elegidas[i].attrs })),
      });
      router.refresh();
    } catch {
      setSumar({ paso: "hecho", cuantas: 0, nuevas: [] });
    }
  }

  /**
   * Dibuja aquí mismo las prendas recién sumadas, desde SU foto.
   *
   * En paralelo y con reintento, igual que el carrete: el servicio de imagen da
   * 500 intermitentes y sin reintentar cada uno deja una prenda sin foto.
   * Falla hacia adelante — la que no salga se queda en 'none' y el clóset la
   * dibuja después, que es exactamente donde estábamos antes.
   */
  async function dibujarNuevas(
    nuevas: { id: string; attrs: PrendaDetectada }[],
    preview: string
  ) {
    setSumar({
      paso: "dibujando",
      items: nuevas.map((n) => ({ ...n, url: null, listo: false })),
    });
    // POOL ACOTADO, no un Promise.all suelto. Es la lección que el carrete ya
    // pagó: disparar N renders a la vez pega el rate-limit de Gemini y cada 429
    // deja una prenda sin foto. Con 2 prendas da igual; con 8 no. El tope es el
    // mismo (4) para que las dos puertas se comporten igual bajo carga.
    const CONCURRENCIA = 4;
    const cola = [...nuevas];
    const dibujarUna = async (n: { id: string; attrs: PrendaDetectada }) => {
      let url: string | null = null;
      for (let intento = 0; intento < 2 && !url; intento++) {
        try {
          const res = await fetch("/api/render-prenda", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: preview, attrs: n.attrs }),
          });
          if (res.ok) {
            const d = (await res.json()) as { path: string; url: string | null };
            await ponerRenderAPrenda(n.id, d.path);
            url = d.url;
          }
        } catch {
          // reintenta una vez; si no, se queda para el clóset
        }
      }
      setSumar((sm) =>
        sm.paso !== "dibujando"
          ? sm
          : {
              ...sm,
              items: sm.items.map((x) => (x.id === n.id ? { ...x, url, listo: true } : x)),
            }
      );
    };
    const trabajar = async () => {
      for (let n = cola.shift(); n; n = cola.shift()) await dibujarUna(n);
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCIA, nuevas.length) }, trabajar)
    );
    router.refresh();
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      // Sin extensiones pegadas: con ellas Android abre el carrete directo y no
      // ofrece la cámara, y aquí la cámara es el caso principal — estás vestida
      // frente al espejo. HEIC no se pierde: toUsableImage lo detecta igual.
      accept="image/*"
      onChange={onFile}
      className="hidden"
    />
  );

  const cerrar = () => setState({ kind: "idle" });

  if (state.kind === "mirando" || state.kind === "listo") {
    const lista = state.kind === "listo" ? state.lectura : null;
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 lg:items-center">
        <div
          className="flex max-h-[92dvh] w-full max-w-[430px] flex-col gap-4 overflow-y-auto rounded-t-[18px] bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 lg:rounded-[18px]"
          style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
        >
          <div className="flex items-start justify-between">
            <h2 className="text-[22px] font-semibold leading-tight text-ink">
              {lista ? (
                <>
                  te <em className="font-normal italic">veo</em>
                </>
              ) : (
                "te estoy viendo…"
              )}
            </h2>
            {lista ? (
              <button type="button" onClick={cerrar} aria-label="Cerrar" className="text-muted">
                <Icon name="equis" size={18} />
              </button>
            ) : null}
          </div>

          {/* Su foto, grande. Es ella, no un dato de entrada. */}
          <div className="relative overflow-hidden rounded-xl border border-line bg-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.preview} alt="" className="max-h-[44dvh] w-full object-contain" />
            {!lista ? (
              <div className="absolute inset-0 flex items-center justify-center bg-bg/60">
                <Spinner className="h-6 w-6 text-accent" />
              </div>
            ) : null}
          </div>

          {lista ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">{lista.resumen}</p>
              {/* De corrido y sin etiquetas de categoría: una amiga te dice tres
                  cosas seguidas, no te entrega un informe por secciones. */}
              <p className="text-[15px] leading-relaxed text-ink">{lista.colorimetria}</p>
              {lista.clima ? (
                <p className="flex gap-2 text-[15px] leading-relaxed text-ink">
                  <Icon name="destello" size={16} className="mt-1 shrink-0 text-accent" />
                  <span>{lista.clima}</span>
                </p>
              ) : null}
              <p className="rounded-xl bg-accent-soft px-3.5 py-3 text-[15px] leading-relaxed text-ink">
                {lista.ajuste}
              </p>
              <p className="text-xs text-muted">Ya quedó en tu diario.</p>

              {/* SEGUNDO TIEMPO — sumar al clóset lo que no tenga.
                  Va DEBAJO del consejo y detrás de una línea discreta: el
                  consejo es a lo que vino, y esto es un extra que la mayoría de
                  los días no aplica porque te pusiste lo que ya tienes. */}
              <div className="border-t border-line pt-3">
                {sumar.paso === "buscando" ? (
                  <p className="flex items-center gap-2 text-[13px] text-muted">
                    <Spinner className="h-3.5 w-3.5" /> viendo qué traes puesto…
                  </p>
                ) : null}

                {sumar.paso === "nada" ? (
                  <div className="flex flex-col gap-1.5">
                    {sumar.fallo ? (
                      <button
                        type="button"
                        onClick={() =>
                          buscarPrendas(
                            state.preview,
                            state.kind === "listo" ? state.outfitId : null
                          )
                        }
                        className="flex items-center gap-2 text-[13px] text-muted transition-colors hover:text-accent"
                      >
                        <Icon name="destello" size={14} />
                        se me atravesó algo — reintentar
                      </button>
                    ) : (
                      <p className="text-[13px] text-muted">
                        {sumar.vistas > 0
                          ? "Todo lo que traes ya está en tu clóset."
                          : "No pude distinguir las prendas en esta foto."}
                      </p>
                    )}
                    <YaEstanLista items={sumar.yaEstan} />
                  </div>
                ) : null}

                {sumar.paso === "elegir" ? (
                  <div className="flex flex-col gap-2.5">
                    <p className="text-[13px] text-ink">
                      Esto no lo veo en tu clóset. Marca lo que sí sea tuyo:
                    </p>
                    {/* LA MISMA TARJETA DEL CARRETE, en compacto.
                        La primera versión de esta lista era mía y sólo enseñaba
                        nombre y color: el carrete confirmaba SIETE campos y el
                        espejo cero — y al revés de como debería, porque la foto
                        de espejo es el peor insumo del producto y por tanto la
                        que más necesita corregirse. Compartirla no es limpieza
                        de código: es lo que decide si el dato entra bien. */}
                    {sumar.prendas.map((p) => (
                      <DraftCard
                        key={p.id}
                        item={p}
                        compacta
                        yaEsta={null}
                        onToggle={() =>
                          setSumar((sm) =>
                            sm.paso !== "elegir"
                              ? sm
                              : {
                                  ...sm,
                                  prendas: sm.prendas.map((x) =>
                                    x.id === p.id ? { ...x, on: !x.on } : x
                                  ),
                                }
                          )
                        }
                        onPatch={(patch, campos) =>
                          setSumar((sm) => {
                            if (sm.paso !== "elegir") return sm;
                            const previos = sm.tocados[p.id] ?? new Set<string>();
                            return {
                              ...sm,
                              prendas: sm.prendas.map((x) =>
                                x.id === p.id ? { ...x, attrs: { ...x.attrs, ...patch } } : x
                              ),
                              tocados: campos?.length
                                ? { ...sm.tocados, [p.id]: new Set([...previos, ...campos]) }
                                : sm.tocados,
                            };
                          })
                        }
                      />
                    ))}
                    <YaEstanLista items={sumar.yaEstan} />
                    <button
                      type="button"
                      onClick={() =>
                        guardarPrendas(
                          state.kind === "listo" ? state.outfitId : null,
                          state.kind === "listo" ? state.rutaFoto : null
                        )
                      }
                      className="min-h-10 rounded-sm border border-accent text-[13px] font-semibold text-accent transition-colors hover:bg-accent-soft"
                    >
                      sumar {sumar.prendas.filter((p) => p.on).length} al clóset
                    </button>
                  </div>
                ) : null}

                {sumar.paso === "guardando" ? (
                  <p className="flex items-center gap-2 text-[13px] text-muted">
                    <Spinner className="h-3.5 w-3.5" /> sumándolas…
                  </p>
                ) : null}

                {sumar.paso === "dibujando" ? (
                  <div className="flex flex-col gap-2.5">
                    <p className="text-[13px] text-ink">
                      {sumar.items.every((x) => x.listo)
                        ? "Así quedaron. Si alguna no se parece, la rehaces desde su ficha."
                        : "Dibujándolas desde tu foto…"}
                    </p>
                    {/* La rejilla se LLENA conforme llegan, como en el carrete:
                        con un spinner global se siente el doble de lento. */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {sumar.items.map((x) => (
                        <div key={x.id} className="flex flex-col gap-1.5">
                          <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-line bg-bg">
                            {x.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={x.url}
                                alt={x.attrs.nombre}
                                className="h-full w-full object-cover"
                                style={{ animation: "var(--dur-short) var(--ease-enter) step-in" }}
                              />
                            ) : x.listo ? (
                              <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-muted">
                                No salió — la dibujo en tu clóset
                              </div>
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Spinner className="h-5 w-5 text-accent" />
                              </div>
                            )}
                          </div>
                          <p className="truncate text-[11.5px] text-ink">{x.attrs.nombre}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {sumar.paso === "hecho" ? (
                  sumar.cuantas > 0 ? (
                    // CUÁNDO Y DÓNDE, no "en un momento". Roberto: "no entendí
                    // en qué momento va a renderizar las nuevas". Con razón: la
                    // prenda entra sin imagen y el clóset la dibuja SOLO cuando
                    // se abre esa pantalla. Prometer un dibujo que ocurre en
                    // otro sitio, sin decir cuál, es una promesa que no se puede
                    // ver cumplir — así que ahora se dice, y se ofrece ir.
                    <div className="flex flex-col gap-2">
                      <p className="text-[13px] text-ink">
                        Listo, {sumar.cuantas}{" "}
                        {sumar.cuantas === 1 ? "prenda nueva" : "prendas nuevas"} en tu
                        clóset. Les dibujo su foto cuando lo abras.
                      </p>
                      {/* DIBUJARLAS AQUÍ, no obligado a después. Lo pidió
                          Roberto, y la razón de peso es la segunda mitad de su
                          frase: "así evalúo si quedan fieles". Dejándolo para el
                          clóset, un dibujo que no se parece se descubre días
                          después y hay que ir a buscarlo. */}
                      {sumar.nuevas.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => dibujarNuevas(sumar.nuevas, state.preview)}
                          className="flex min-h-10 items-center justify-center gap-1.5 rounded-sm bg-accent text-[13px] font-semibold text-on-accent transition-colors hover:bg-accent-deep"
                        >
                          <Icon name="destello" size={14} />
                          dibujarlas ahora · ~{Math.max(20, sumar.nuevas.length * 18)}s
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          cerrar();
                          router.push("/closet");
                        }}
                        className="flex min-h-10 items-center justify-center gap-1.5 rounded-sm border border-line text-[13px] font-medium text-muted transition-colors hover:border-accent hover:text-accent"
                      >
                        verlas en mi clóset
                        <Icon name="flecha" size={14} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-[13px] text-ink">No sumé nada.</p>
                  )
                ) : null}
              </div>

              <button
                type="button"
                onClick={cerrar}
                className="min-h-12 rounded-sm bg-accent text-sm font-semibold text-on-accent"
              >
                gracias
              </button>
            </div>
          ) : (
            <p className="editorial text-center text-sm text-muted">
              mirando los colores, el clima y cómo te queda…
            </p>
          )}
        </div>
        {input}
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 lg:items-center" onClick={cerrar}>
        <div
          className="flex w-full max-w-[430px] flex-col gap-3 rounded-t-[18px] bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-center lg:rounded-[18px]"
          style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm text-error">{state.msg}</p>
          <button
            type="button"
            onClick={cerrar}
            className="min-h-11 rounded-sm border border-line bg-surface text-sm font-medium text-ink"
          >
            entendido
          </button>
        </div>
        {input}
      </div>
    );
  }

  if (headless) return input;

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-sm border border-line text-[15px] font-semibold text-ink transition-colors duration-200 hover:border-accent hover:text-accent"
      >
        <Icon name="camara" size={18} />
        ¿me veo bien?
      </button>
      {input}
    </>
  );
}

/**
 * Lo que vi en la foto y NO te propongo, con la prenda tuya que creo que es.
 *
 * Roberto: "no sé si las cosas que no detectó es porque ya las tengo o porque
 * no las detectó". Filtrando en silencio, tres cosas muy distintas —ya la
 * tienes, no la vi, la vi mal— se ven exactamente igual desde su lado.
 *
 * Y decir CON QUÉ la emparejé no es un adorno: es la única forma de que un
 * empate equivocado se pueda ver. Si le digo "ya tienes Pantalón de lino" y
 * éste es otro pantalón de lino distinto, sin nombrarlo nunca se entera — y esa
 * prenda no entra a su clóset jamás.
 */
function YaEstanLista({ items }: { items: YaEsta[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-sm bg-bg px-3 py-2.5">
      <p className="text-[12px] font-medium text-muted">
        Esto también lo vi, y creo que ya lo tienes:
      </p>
      {/* CON LA FOTO DE LA PRENDA QUE CREO QUE ES — pedido por Roberto, y es el
          mismo argumento que ya vale en el carrete: "creo que ya tienes unos
          mocasines café" no dice si son ESOS mocasines. Con la imagen delante,
          un empate equivocado se ve; sin ella, esa prenda no entra a su clóset
          nunca y él no se entera de por qué. */}
      {items.map((x, i) => (
        <div key={`${x.nombre}-${i}`} className="flex items-center gap-2.5">
          {x.imagen ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={x.imagen}
              alt=""
              className="h-11 w-9 shrink-0 rounded-sm border border-line bg-surface object-cover"
            />
          ) : (
            <span className="h-11 w-9 shrink-0 rounded-sm border border-line bg-surface" aria-hidden />
          )}
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[12.5px] text-ink">{x.comoEsta}</span>
            <span className="truncate text-[11px] text-muted">lo vi como “{x.nombre}”</span>
          </span>
        </div>
      ))}
    </div>
  );
}
