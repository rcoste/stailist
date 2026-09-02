"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toUsableImage } from "@/lib/image-file";
import { createClient } from "@/lib/supabase/client";
import { addPhotoItems, addLibraryCandidates, prendasParaComparar, esLaMismaPrenda } from "@/app/closet/actions";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import { ImageCrop } from "@/components/image-crop";
import { PrendaZoom } from "@/components/prenda-zoom";
import { EL_CORTE_IMPORTA } from "@/lib/afinar-prendas";
import { paresDeTraje } from "@/lib/par-de-traje";
// La tarjeta de confirmar una prenda y sus vocabularios viven aparte desde que
// el espejo abrió una segunda puerta al clóset: allá reusa ésta, entera.
import { DraftCard, type DraftLeida } from "@/components/prenda-draft-card";
import { mismoHex } from "@/components/prenda-campos";
import { yaLaTienes, type PrendaExistente } from "@/lib/ya-la-tienes";
import type { PrendaAnalisis } from "@/app/api/analizar-prenda/route";
import type { PrendaDetectada } from "@/app/api/analizar-prendas/route";

// Mango imperativo para disparar el flujo desde fuera (la hoja "Agregar", el
// drawer de "Más", el bloque del clóset vacío). Vivía en add-photo-flow, que se
// borró el 2026-08-14 al quedar una sola puerta de fotos.
export type AddFlowHandle = {
  start: () => void;
  /** Recibe una foto ya elegida y salta directo al recorte. */
  startConFoto?: (dataUrl: string) => void;
};

const MAX_FOTOS = 12;

// Paleta de colores comunes de ropa para corregir el color con un tap (swatch +
// alternativas). El swatch detectado se muestra aparte como punto de partida.
// La paleta y el cálculo de vecinos viven en lib/paleta-colores.ts (con tests).

// Comprime una imagen a 1280px JPEG; devuelve dataURL para el análisis.
function comprimir(file: Blob): Promise<string> {
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
      URL.revokeObjectURL(img.src);
      resolve(dataUrl);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function uid() {
  return crypto.randomUUID();
}

// Prenda detectada en la curación de texto.
// Error tipado del 403 de permiso parental: corta el análisis con el mensaje
// del server (no es un problema de las fotos).
class PermisoError extends Error {}
/**
 * Tope diario de fotos alcanzado (429). Es su propia clase por lo mismo que
 * PermisoError: sin ella, un 429 caía en el `if (!res.ok)` de abajo, la foto se
 * marcaba como "sin prendas", y si el lote entero topaba la persona leía "no
 * detecté prendas en esas fotos" — culpando a sus fotos por un límite nuestro.
 */
class CuotaError extends Error {}

type DraftItem = DraftLeida & {
  /**
   * Qué campos TOCÓ la persona en esta pantalla.
   *
   * Es lo único que este flujo añade a la prenda leída, y por eso vive aquí y
   * no en el tipo compartido: la confirmación campo por campo sólo existe en la
   * carga masiva. Sin esto, al motor le llegaba igual una prenda revisada a
   * mano que una que nadie miró. Sólo los TOCADOS, porque todo viene
   * preseleccionado y dejarlo como está no es confirmar, es no haber mirado.
   */
  tocados: Set<string>;
};

// Prenda ya renderizada, en la curación visual.
type RenderItem = {
  id: string;
  attrs: PrendaDetectada;
  tocados: Set<string>;
  photo: string; // dataURL de la foto original (para el render imagen→imagen)
  status: "pending" | "done" | "failed";
  path: string | null;
  url: string | null;
  verdict: "keep" | "notmine" | "trash";
};

// Foto elegida, ya comprimida (y opcionalmente recortada) antes de analizarla.
type Foto = { id: string; dataUrl: string };

type State =
  | { kind: "idle" }
  | { kind: "explainer" } // así funciona (timeline de 3 pasos) ANTES de elegir fotos
  | { kind: "preparando" } // convirtiendo/comprimiendo las fotos elegidas
  | { kind: "revisar"; fotos: Foto[] } // recorte opcional por foto antes de leer
  // Las fotos viajan en el estado para pintarlas con su palomita; `encontradas`
  // son los nombres leídos hasta ahora, creciendo en vivo (handoff de carga).
  | { kind: "analizando"; fotos: Foto[]; listas: string[]; encontradas: string[] }
  | { kind: "texto"; items: DraftItem[] }
  | { kind: "render"; items: RenderItem[]; done: number; total: number }
  | { kind: "visual"; items: RenderItem[] }
  | { kind: "guardando" }
  // El cierre: cuánto entró, qué entró, y qué quedó atado como conjunto.
  | {
      kind: "listo";
      added: number;
      conjuntos: number;
      thumbs: { url: string; nombre: string; enConjunto: boolean }[];
    }
  | { kind: "error"; msg: string };


// headless: sin botón propio — lo dispara la hoja "Agregar" vía ref.start().
export function ImportCarreteFlow({
  userId,
  headless = false,
  ref,
}: {
  /** Hace falta para guardar la foto original en la carpeta del usuario. */
  userId?: string;
  headless?: boolean;
  ref?: Ref<AddFlowHandle>;
} = {}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  /** "sí, es la misma": borrador → id de la prenda del clóset con la que empata.
   *
   *  Se APUNTA aquí y se aplica al guardar, no al picar. En el paso de confirmar
   *  la foto todavía no está subida —su ruta se resuelve al guardar— así que
   *  antes no hay a qué apuntar. Y encima es lo correcto: nada se escribe en el
   *  clóset hasta que la persona confirma la pantalla entera. */
  const esLaMisma = useRef(new Map<string, string>());
  const [cropId, setCropId] = useState<string | null>(null); // foto en recorte
  // EL RENDER, EN GRANDE. Aquí se decide "es mía / salió mal" mirando un
  // recuadro de dos columnas, que es justo donde no se distingue si el dibujo
  // salió bien. El visor ya existía —lo usan los looks, la maleta y desde ayer
  // la ficha— y faltaba en el único momento del flujo que es un juicio visual.
  const [zoomId, setZoomId] = useState<string | null>(null);
  // El clóset actual, para poder avisar "creo que ya la tienes". Se pide una
  // vez por tanda, no por prenda: son unos cientos de filas y la pantalla de
  // confirmación no debe esperar a nada.
  const [enElCloset, setEnElCloset] = useState<PrendaExistente[]>([]);
  /**
   * Cuánta gente sale en cada foto, cuando ya se pudo contar.
   *
   * Vive fuera del estado del flujo porque llega DESPUÉS de pintar la pantalla:
   * la rejilla de fotos no puede esperar a una llamada de IA para que la mires.
   * Sin dato (o con dato 0/1) no aparece nada.
   */
  const [personas, setPersonas] = useState<Record<string, number>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // ¿SALE ALGUIEN MÁS EN ESTA FOTO? Se pregunta AQUÍ, con las fotos elegidas y
  // todavía sin leer, porque es el único momento en que la respuesta sirve para
  // algo: después ya se leyó la ropa de tu amigo y ya la estás viendo en la
  // lista. Es una llamada barata y aparte (ver lib/vision-personas).
  //
  // Una por foto y una sola vez: se salta las que ya tienen respuesta, así que
  // recortar una foto no vuelve a pagar la pregunta de las otras.
  const fotosDeRevisar = state.kind === "revisar" ? state.fotos : null;
  useEffect(() => {
    if (!fotosDeRevisar) return;
    let vivo = true;
    for (const f of fotosDeRevisar) {
      if (personas[f.id] !== undefined) continue;
      fetch("/api/contar-personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: f.dataUrl }),
      })
        .then((r) => (r.ok ? r.json() : { personas: 0 }))
        .then((d: { personas?: number }) => {
          if (vivo) setPersonas((p) => ({ ...p, [f.id]: d.personas ?? 0 }));
        })
        .catch(() => {
          // Sin dato no se avisa — queda como estaba antes de que esto existiera.
          if (vivo) setPersonas((p) => ({ ...p, [f.id]: 0 }));
        });
    }
    return () => {
      vivo = false;
    };
    // `personas` se lee para saltarse lo ya contado, pero NO va en las deps: se
    // escribe dentro del efecto y volvería a dispararlo en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotosDeRevisar]);

  // El explainer va ANTES del picker: el valor del carrete (1 foto → la IA separa
  // cada prenda) hay que contarlo primero. "elegir fotos" abre el picker nativo.
  // `startConFoto` recibe una foto ya elegida y comprimida y entra directo al
  // recorte, saltándose el explainer y el picker. La usaba el flujo de UNA
  // prenda para pasar aquí una foto con varias; hoy queda para el mismo salto
  // desde cualquier otra superficie que ya tenga la imagen en la mano.
  useImperativeHandle(
    ref,
    () => ({
      start: () => setState({ kind: "explainer" }),
      startConFoto: (dataUrl: string) =>
        setState({ kind: "revisar", fotos: [{ id: uid(), dataUrl }] }),
    }),
    []
  );

  // --- 1) Selección → comprime y pasa a "revisar" (recorte opcional) ---
  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_FOTOS);
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0) return;

    setState({ kind: "preparando" });
    try {
      const fotos = await Promise.all(
        files.map(async (file) => ({ id: uid(), dataUrl: await comprimir(await toUsableImage(file)) }))
      );
      setState({ kind: "revisar", fotos });
    } catch (e) {
      setState({
        kind: "error",
        msg:
          e instanceof PermisoError || e instanceof CuotaError
            ? e.message
            : "No pude leer las fotos. Inténtalo otra vez.",
      });
    }
  }

  function removeFoto(id: string) {
    setState((s) => (s.kind === "revisar" ? { ...s, fotos: s.fotos.filter((f) => f.id !== id) } : s));
  }
  function applyCrop(id: string, dataUrl: string) {
    setState((s) =>
      s.kind === "revisar" ? { ...s, fotos: s.fotos.map((f) => (f.id === id ? { ...f, dataUrl } : f)) } : s
    );
    // La foto recortada se vuelve a contar. Es lo que cierra el lazo: recortas
    // para dejarte sola y el aviso DESAPARECE — o se queda, y entonces sabes
    // que el recorte no bastó. Un aviso que no reacciona a lo que hiciste no se
    // distingue de un aviso roto.
    setPersonas((p) => {
      const { [id]: _, ...resto } = p;
      return resto;
    });
  }

  // --- 2) Revisadas → extracción de prendas (IA por foto) ---
  async function analizarFotos() {
    if (state.kind !== "revisar") return;
    const fotos = state.fotos;
    if (fotos.length === 0) return;
    setState({ kind: "analizando", fotos, listas: [], encontradas: [] });
    try {
      const perPhoto = await Promise.all(
        fotos.map(async (f) => {
          // La marca va DESPUÉS de parsear, no al llegar la respuesta: así la
          // palomita de la foto y sus nombres en "encontré hasta ahora"
          // aparecen juntos. Funcional porque las fotos corren en paralelo y
          // dos respuestas pueden aterrizar en el mismo tick.
          const marca = (nombres: string[]) =>
            setState((prev) =>
              prev.kind === "analizando"
                ? {
                    ...prev,
                    listas: [...prev.listas, f.id],
                    encontradas: [...prev.encontradas, ...nombres],
                  }
                : prev
            );
          const res = await fetch("/api/analizar-prendas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: f.dataUrl }),
          });
          if (res.status === 403) {
            // Permiso parental pendiente: no es un problema de la foto — corta
            // el flujo con el mensaje real en vez de "no detecté prendas".
            const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
            if (err.error === "permiso_pendiente" && err.message) throw new PermisoError(err.message);
            marca([]);
            return [] as DraftItem[];
          }
          if (res.status === 429) {
            // Tope diario: corta el lote con el mensaje del servidor. Las
            // fotos ya analizadas antes de topar NO se pierden — el error se
            // pinta sobre el clóset, que se refresca (ver el portal de abajo).
            const err = (await res.json().catch(() => ({}))) as { mensaje?: string };
            throw new CuotaError(
              err.mensaje ?? "por hoy llegué a mi tope de fotos. mañana seguimos."
            );
          }
          if (!res.ok) {
            marca([]);
            return [] as DraftItem[];
          }
          const { prendas } = (await res.json()) as { prendas: PrendaDetectada[] };
          marca(prendas.map((pr) => pr.nombre));
          return prendas.map((p) => ({
            id: uid(),
            attrs: p,
            on: true,
            photoPreview: f.dataUrl,
            tocados: new Set<string>(),
            leido: { color: p.color, hex: p.color_hex },
          }));
        })
      );
      const items = perPhoto.flat();
      if (items.length === 0) {
        setState({
          kind: "error",
          msg: "No detecté prendas en esas fotos. Prueba con fotos donde la ropa se vea bien — puesta, o extendida sobre la cama.",
        });
        return;
      }
      setState({ kind: "texto", items });
      // El clóset se pide DESPUÉS de mostrar la pantalla y sin await: el aviso
      // de "ya la tienes" es una ayuda, y hacer esperar la confirmación por una
      // ayuda sería cobrar por ella. Si tarda o falla, aparece tarde o no
      // aparece — nada más.
      prendasParaComparar()
        .then(setEnElCloset)
        .catch(() => {});
    } catch (e) {
      setState({
        kind: "error",
        msg: e instanceof PermisoError ? e.message : "No pude leer las fotos. Inténtalo otra vez.",
      });
    }
  }

  // --- Edición en la curación de texto ---
  //
  // `campos` es lo que la persona DECLARÓ al tocar, y no siempre coincide con
  // las llaves del patch: corregir el color mueve `color` y `color_hex` pero lo
  // confirmado es "color", y el lazo del traje no confirma ningún atributo.
  // Por eso va explícito en vez de deducirse de Object.keys.
  function patchItem(id: string, patch: Partial<PrendaDetectada>, campos: string[] = []) {
    setState((s) =>
      s.kind === "texto"
        ? {
            ...s,
            items: s.items.map((it) =>
              it.id === id
                ? {
                    ...it,
                    attrs: { ...it.attrs, ...patch },
                    tocados: campos.length
                      ? new Set([...it.tocados, ...campos])
                      : it.tocados,
                  }
                : it
            ),
          }
        : s
    );
  }
  function toggleItem(id: string) {
    setState((s) =>
      s.kind === "texto"
        ? { ...s, items: s.items.map((it) => (it.id === id ? { ...it, on: !it.on } : it)) }
        : s
    );
  }

  // --- 2) Texto confirmado → generar renders ---
  async function generarRenders() {
    if (state.kind !== "texto") return;
    const activos = state.items.filter((it) => it.on);
    if (activos.length === 0) {
      setState({ kind: "error", msg: "No dejaste ninguna prenda activa." });
      return;
    }
    const base: RenderItem[] = activos.map((it) => ({
      id: it.id,
      attrs: it.attrs,
      tocados: it.tocados,
      photo: it.photoPreview,
      status: "pending",
      path: null,
      url: null,
      verdict: "keep",
    }));
    setState({ kind: "render", items: base, done: 0, total: base.length });

    // Render con POOL ACOTADO (no secuencial): hasta CONCURRENCY renders a la vez.
    // Antes era un for secuencial (tiempo ≈ N × un render); con el pool baja a
    // ≈ N/CONCURRENCY. El tope evita bombardear Gemini con N a la vez (429s) y
    // mantiene el progreso claro (el contador sube conforme cada uno termina).
    // Pool de 4 con red de seguridad (reintento en 429/red). Sin el reintento, 4
    // concurrentes podrían pegar el rate-limit de Gemini y fallar la prenda; con
    // backoff, reintenta en vez de rendirse.
    const CONCURRENCY = 4;
    const results: RenderItem[] = base.map((it) => ({ ...it })); // por índice, ordenado
    let done = 0;

    const renderOne = async (idx: number) => {
      const it = base[idx];
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch("/api/render-prenda", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: it.photo, attrs: it.attrs }),
          });
          if (res.ok) {
            const { path, url } = (await res.json()) as { path: string; url: string | null };
            results[idx] = { ...it, status: "done", path, url };
            break;
          }
          // 429 = rate-limit de Gemini → backoff y reintenta (hasta 2 veces).
          if (res.status === 429 && attempt < 2) {
            await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
            continue;
          }
          results[idx] = { ...it, status: "failed" };
          break;
        } catch {
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));
            continue;
          }
          results[idx] = { ...it, status: "failed" };
          break;
        }
      }
      done += 1;
      setState({ kind: "render", items: [...results], done, total: base.length });
    };

    // Worker pool: CONCURRENCY "trabajadores" jalan índices de una cola compartida.
    const queue = base.map((_, i) => i);
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        let idx = queue.shift();
        while (idx !== undefined) {
          await renderOne(idx);
          idx = queue.shift();
        }
      })
    );
    setState({ kind: "visual", items: results });
  }

  function setVerdict(id: string, verdict: RenderItem["verdict"]) {
    setState((s) =>
      s.kind === "visual"
        ? { ...s, items: s.items.map((it) => (it.id === id ? { ...it, verdict } : it)) }
        : s
    );
  }

  // --- 3) Visual confirmado → guardar ---
  async function guardar() {
    if (state.kind !== "visual") return;
    setState({ kind: "guardando" });
    try {
      const keep = state.items.filter((it) => it.verdict === "keep");
      const notmine = state.items.filter((it) => it.verdict === "notmine" && it.path);

      // LA FOTO ORIGINAL SE GUARDA, y una sola vez por foto aunque de ella
      // salieran seis prendas: todas comparten la misma imagen de referencia.
      //
      // Se tiraba, y eso cerraba tres puertas: no se podía comprobar de qué
      // foto salió un render raro, ni volver a leer la prenda con un modelo
      // mejor, ni regresar a la fuente cuando el dibujo sale mal. De 325
      // prendas dadas de alta por foto, sólo 5 conservaban el original.
      //
      // FALLA HACIA ADELANTE: si la subida no sale, la prenda se guarda igual
      // sin referencia. La prenda es el trabajo; la foto es el respaldo.
      const rutaDeFoto = new Map<string, string>();
      if (userId && keep.length > 0) {
        const unicas = [...new Set(keep.map((it) => it.photo))];
        const supabase = createClient();
        await Promise.all(
          unicas.map(async (dataUrl) => {
            try {
              const blob = await (await fetch(dataUrl)).blob();
              const path = `${userId}/origen-${uid()}.jpg`;
              const up = await supabase.storage
                .from("prendas")
                .upload(path, blob, { contentType: "image/jpeg" });
              if (!up.error) rutaDeFoto.set(dataUrl, path);
            } catch {
              // sin referencia, pero la prenda entra igual
            }
          })
        );
      }

      const okItems =
        keep.length === 0
          ? { ok: true, added: 0 }
          : await addPhotoItems(
              keep.map((it) => ({
                // `confirmados` viaja DENTRO de attrs porque ahí es donde vive
                // en la base — el mismo lugar que usa la ficha y que el motor
                // consulta para saber qué dato es de la persona.
                attrs: { ...it.attrs, confirmados: [...it.tocados] },
                renderPath: it.status === "done" ? it.path : null,
                renderStatus: it.status === "done" ? "done" : "failed",
                photoPath: rutaDeFoto.get(it.photo) ?? null,
              }))
            );

      // Las que la persona marcó como "es la misma": su foto real pasa a mandar
      // sobre el dibujo de catálogo de la prenda que YA tiene. No borra nada
      // (ver esLaMismaPrenda); best-effort, porque fallar aquí no debe tumbar un
      // alta que ya salió bien.
      for (const [draftId, itemId] of esLaMisma.current) {
        const draft = state.kind === "visual" ? state.items.find((x) => x.id === draftId) : null;
        const ruta = draft ? rutaDeFoto.get(draft.photo) : null;
        if (ruta) await esLaMismaPrenda(itemId, ruta).catch(() => null);
      }

      if (notmine.length > 0) {
        await addLibraryCandidates(
          notmine.map((it) => ({ attrs: it.attrs, imagePath: it.path as string }))
        );
      }

      if (!okItems.ok) {
        setState({ kind: "error", msg: "No pude guardar las prendas. Inténtalo otra vez." });
        return;
      }
      // EL TOPE POR LOTE SE DICE. Se puede llegar a 96 prendas (12 fotos × 8) y
      // la acción guarda hasta 60: antes las de más se perdían sin una palabra,
      // con el botón diciendo "sumar 72 al clóset". Un tope está bien; un tope
      // callado es ropa que desaparece.
      if (okItems.dejadas && okItems.dejadas > 0) {
        // Sin refresh aquí — mismo desmonte que mataba al "listo" (ver abajo):
        // el aviso del tope moría antes de leerse. El refresh va al cerrarlo.
        setState({
          kind: "error",
          msg: `Sumé ${okItems.added} prendas — son muchas de una vez y ${okItems.dejadas} se quedaron fuera. Vuelve a entrar con esas fotos y las agrego.`,
        });
        return;
      }
      // LA PANTALLA DE CIERRE (handoff): antes el flujo simplemente se
      // esfumaba a idle y el clóset aparecía cambiado sin que nadie dijera qué
      // pasó. Ahora se dice: cuánto entró, las miniaturas de lo que entró, y —
      // si ataste un traje— que quedó guardado como conjunto (las piezas del
      // conjunto llevan su subrayado). Con 0 guardadas no hay nada que
      // celebrar: idle directo, como antes.
      if (okItems.added === 0) {
        setState({ kind: "idle" });
        router.refresh();
        return;
      }
      const porConjunto = new Map<string, number>();
      for (const it of keep) {
        const cj = it.attrs.conjunto;
        if (cj) porConjunto.set(cj, (porConjunto.get(cj) ?? 0) + 1);
      }
      // OJO: AQUÍ NO HAY router.refresh(), y es la lección más rara del día.
      // Este flujo vive DENTRO del bloque de clóset-vacío (closet-llenalo), que
      // el servidor QUITA en cuanto tienes fotos propias. Refrescar aquí
      // desmontaba ese bloque con el flujo adentro — y la pantalla de "listo"
      // moría en el mismo frame en que nacía. Se vio en la prueba: la base
      // pasó de 15 a 17 prendas y la pantalla nunca existió. El refresh va en
      // "ver mi clóset", que es cuando ya no importa que nos desmonten.
      setState({
        kind: "listo",
        added: okItems.added,
        conjuntos: [...porConjunto.values()].filter((n) => n >= 2).length,
        thumbs: keep.map((it) => ({
          url: it.status === "done" && it.url ? it.url : it.photo,
          nombre: it.attrs.nombre,
          enConjunto:
            !!it.attrs.conjunto && (porConjunto.get(it.attrs.conjunto) ?? 0) >= 2,
        })),
      });
    } catch {
      setState({ kind: "error", msg: "No pude guardar las prendas. Inténtalo otra vez." });
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*,.heic,.heif"
      multiple
      onChange={onFiles}
      className="hidden"
    />
  );

  // ====== RENDER POR ESTADO ======

  if (state.kind === "explainer") {
    // Los pasos son los estados REALES de este flujo (revisar → analizando →
    // texto → render), no un resumen bonito: así el explainer funciona como
    // avance de lo que va a pasar y nada sorprende a medio camino.
    //
    // Los tres datos que se agregaron (2026-07-29) son los que cambian la
    // decisión de entrar, y ninguno estaba dicho:
    //   · que son VARIAS fotos de una vez — el subtítulo decía "una foto",
    //     justo lo contrario del argumento de la función;
    //   · que puedes recortar cada foto (existe, en el paso "revisar", y es la
    //     salida cuando sales acompañada en la foto);
    //   · que NADA entra al clóset sin que lo apruebes prenda por prenda. Es el
    //     miedo real de un import con IA: que te llene el clóset de basura.
    const pasos = [
      {
        icon: "camara" as const,
        t: "subes tus fotos",
        s: `con la ropa puesta o extendida en la cama. hasta ${MAX_FOTOS} de una vez, y puedes recortar cada una.`,
      },
      {
        icon: "destello" as const,
        t: "separo cada prenda",
        s: "saco, pantalón, zapatos… una por una.",
      },
      {
        icon: "check" as const,
        t: "tú decides qué se queda",
        s: "las repasas antes de que entren; lo que no sea tuyo, fuera.",
      },
      {
        icon: "gancho" as const,
        t: "quedan limpias",
        s: "en tu clóset, como de catálogo.",
      },
    ];
    return (
      <Overlay
        paso={1}
        onBack={() => setState({ kind: "idle" })}
        pie={
          <Footer
            cancel={() => setState({ kind: "idle" })}
            confirmLabel="elegir fotos"
            confirmDisabled={false}
            onConfirm={() => inputRef.current?.click()}
          />
        }
      >
        {input}
        <div className="flex flex-col gap-1">
          <h2 className="text-[24px] font-semibold leading-tight text-ink">
            así <em className="font-normal italic">funciona</em>
          </h2>
          <p className="text-sm text-muted">
            varias fotos de una vez — yo separo cada prenda y tú decides qué se
            queda.
          </p>
        </div>
        <ol className="flex flex-col">
          {pasos.map((p, i) => (
            <li key={p.t} className="flex gap-3.5">
              <div className="flex flex-col items-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-accent text-on-accent">
                  <Icon name={p.icon} size={19} />
                </span>
                {i < pasos.length - 1 ? (
                  <span className="my-1 w-px flex-1 bg-line" aria-hidden />
                ) : null}
              </div>
              <div className="flex flex-col pb-5 pt-1.5">
                <span className="text-[15px] font-semibold leading-tight text-ink">{p.t}</span>
                <span className="editorial text-sm text-muted">{p.s}</span>
              </div>
            </li>
          ))}
        </ol>
      </Overlay>
    );
  }

  if (state.kind === "preparando") {
    return (
      <Overlay>
        <CarreteLoading frase="preparando tus fotos…" />
      </Overlay>
    );
  }

  if (state.kind === "revisar") {
    const cropFoto = state.fotos.find((f) => f.id === cropId) ?? null;
    // Las fotos donde de verdad sale alguien más. El aviso genérico de arriba
    // preguntaba lo mismo en TODAS ("¿sale alguien más en alguna?"), que es la
    // clase de aviso que se aprende a ignorar porque siempre está.
    const conCompania = state.fotos.filter((f) => (personas[f.id] ?? 0) > 1);
    return (
      <Overlay
        paso={2}
        onBack={() => setState({ kind: "explainer" })}
        pie={
          <Footer
            cancel={() => setState({ kind: "idle" })}
            confirmLabel={`leer ${state.fotos.length} ${state.fotos.length === 1 ? "foto" : "fotos"}`}
            confirmDisabled={state.fotos.length === 0}
            onConfirm={analizarFotos}
          />
        }
      >
        {input}
        <Header
          title="revisa tus fotos"
          sub={
            conCompania.length > 0
              ? `En ${conCompania.length === 1 ? "una de tus fotos sale" : `${conCompania.length} de tus fotos sale`} alguien más. Recórtala para dejarte solo a ti, o te sumaré su ropa como tuya.`
              : "¿Sale alguien más en alguna? Recórtala para dejarte solo a ti. Es opcional."
          }
        />
        <div className="grid grid-cols-3 gap-2">
          {state.fotos.map((f) => {
            const acompanada = (personas[f.id] ?? 0) > 1;
            return (
            <div
              key={f.id}
              className={`relative aspect-[3/4] overflow-hidden rounded-sm border bg-bg ${
                acompanada ? "border-warning" : "border-line"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.dataUrl} alt="" className="h-full w-full object-cover" />
              {/* SOBRE LA FOTO QUE LO NECESITA, no en un texto general: con
                  doce miniaturas, "en alguna sale alguien más" obliga a
                  buscarla, y buscar es justo lo que nadie hace. */}
              {acompanada ? (
                <span className="absolute left-1 top-1 rounded-sm bg-warning px-1.5 py-0.5 text-[10px] font-semibold text-on-accent">
                  salen {personas[f.id]}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setCropId(f.id)}
                className={`absolute bottom-1 left-1 rounded-sm px-1.5 py-1 text-[11px] font-semibold text-on-accent ${
                  acompanada ? "bg-warning" : "bg-ink/70"
                }`}
              >
                recortar
              </button>
              <button
                type="button"
                onClick={() => removeFoto(f.id)}
                aria-label="quitar foto"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-[13px] font-bold text-on-accent"
              >
                ×
              </button>
            </div>
            );
          })}
        </div>
        {cropFoto ? (
          <ImageCrop
            src={cropFoto.dataUrl}
            onCancel={() => setCropId(null)}
            onDone={(url) => {
              applyCrop(cropFoto.id, url);
              setCropId(null);
            }}
          />
        ) : null}
      </Overlay>
    );
  }

  if (state.kind === "analizando") {
    // EL LOADING QUE ENSEÑA SU TRABAJO (handoff de carga). Antes era un spinner
    // con "2/3 fotos"; ahora cada foto lleva su palomita al terminar, la barra
    // avanza, y los nombres leídos van cayendo en "encontré hasta ahora" — la
    // espera se vuelve el avance de la pantalla siguiente.
    //
    // La "línea de escaneo" del handoff NO está, a propósito: sería una
    // animación nueva y el DS obliga a preguntar antes de inventar una. El
    // spinner sobre la foto pendiente (patrón que ya existe en todo el
    // proyecto) comunica lo mismo: ésta es la que va.
    const hechas = state.listas.length;
    return (
      <Overlay>
        <div className="my-auto flex flex-col gap-5">
          <div className="flex flex-col items-center gap-0.5 text-center">
            <p className="shimmer-txt text-lg font-medium">leyendo tus prendas…</p>
            <p className="tabular text-sm text-muted">
              {hechas} de {state.fotos.length} {state.fotos.length === 1 ? "foto" : "fotos"}
            </p>
          </div>
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-500"
              style={{ width: `${Math.max(4, (hechas / state.fotos.length) * 100)}%` }}
            />
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {state.fotos.map((f) => {
              const lista = state.listas.includes(f.id);
              return (
                <div
                  key={f.id}
                  className="relative h-20 w-14 overflow-hidden rounded-md border border-line bg-surface"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.dataUrl}
                    alt=""
                    className={`h-full w-full object-cover transition-opacity ${lista ? "" : "opacity-50"}`}
                  />
                  {lista ? (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-on-accent">
                      <Icon name="check" size={9} />
                    </span>
                  ) : (
                    <span className="absolute inset-0 m-auto h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent" />
                  )}
                </div>
              );
            })}
          </div>
          {state.encontradas.length > 0 ? (
            <div className="flex flex-col items-center gap-1 px-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
                encontré hasta ahora
              </p>
              <p className="text-center text-sm leading-snug text-ink">
                {state.encontradas.join(" · ")}
              </p>
            </div>
          ) : null}
        </div>
      </Overlay>
    );
  }

  if (state.kind === "texto") {
    const activos = state.items.filter((it) => it.on);
    // ¿Hay un saco y un pantalón formal? Entonces puede ser un traje — y sólo
    // la persona lo sabe. Ver lib/par-de-traje.ts para por qué no se deduce.
    //
    // POR FOTO, no por tanda: agrupado por tanda, subir el esmoquin y el traje
    // gris juntos daba DOS sacos, la pregunta se consideraba ambigua y no salía
    // ninguna. Roberto lo cazó en vivo y diagnosticó la causa él mismo.
    const pares = paresDeTraje(
      activos.map((it) => ({ id: it.id, foto: it.photoPreview, ...it.attrs }))
    );
    return (
      <Overlay
        paso={3}
        pie={
          <Footer
            cancel={() => setState({ kind: "idle" })}
            confirmLabel={`generar ${activos.length} ${activos.length === 1 ? "prenda" : "prendas"}`}
            confirmDisabled={activos.length === 0}
            onConfirm={generarRenders}
          />
        }
      >
        <Header
          title="¿Detecté bien tus prendas?"
          sub="Confirma o corrige cada una. Apaga con la ✓ las que no quieras sumar."
        />
        <div className="flex flex-col gap-3">
          {/* LAS PIEZAS ATADAS SE VEN ATADAS (handoff de carga). El modelo de
              conjunto ya existía (attrs.conjunto, el mismo que llevan 12
              prendas en prod) — lo que no existía era VERLO: atabas el traje
              con la casilla de abajo y las dos tarjetas seguían pintadas como
              prendas sin relación. Ahora las piezas del mismo conjunto se
              agrupan en un contenedor con cabecera y "separar".
              El orden se conserva por primera aparición; una prenda suelta se
              pinta plana, igual que siempre. */}
          {(() => {
            const card = (it: (typeof state.items)[number]) => (
              <DraftCard
                key={it.id}
                item={it}
                onEsLaMisma={(itemId) => esLaMisma.current.set(it.id, itemId)}
                yaEsta={yaLaTienes(
                  {
                    nombre: it.attrs.nombre,
                    categoria: it.attrs.categoria,
                    colorHex: it.attrs.color_hex,
                    material: it.attrs.material,
                    corte: it.attrs.corte,
                  },
                  enElCloset
                )}
                onToggle={() => toggleItem(it.id)}
                onPatch={(p, campos) => patchItem(it.id, p, campos)}
              />
            );
            const vistos = new Set<string>();
            return state.items.map((it) => {
              if (vistos.has(it.id)) return null;
              const c = it.attrs.conjunto;
              const grupo = c
                ? state.items.filter((x) => x.attrs.conjunto === c)
                : [it];
              grupo.forEach((x) => vistos.add(x.id));
              if (grupo.length < 2) return card(it);
              return (
                <div
                  key={`conj-${c}`}
                  className="flex flex-col gap-3 rounded-lg border border-accent p-2.5"
                >
                  <div className="flex items-center justify-between gap-2 px-0.5">
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                      <Icon name="gancho" size={13} />
                      mismo traje · {grupo.length} piezas
                    </span>
                    {/* Separar sólo quita la RELACIÓN, no las prendas — y es
                        reversible: al soltar, la pregunta de "¿son un traje?"
                        vuelve a aparecer abajo, que es el "volver a unir". */}
                    <button
                      type="button"
                      onClick={() =>
                        grupo.forEach((g) => patchItem(g.id, { conjunto: undefined }))
                      }
                      className="text-[12px] font-medium text-muted underline decoration-line underline-offset-2 transition-colors hover:text-ink"
                    >
                      separar
                    </button>
                  </div>
                  {grupo.map(card)}
                </div>
              );
            });
          })()}
        </div>

        {/* EL LAZO DEL TRAJE. Un traje se guarda como dos prendas —así debe
            ser—, pero sin decir que van juntas la regla de "traje desparejado"
            marca ese par como error y el motor nunca vuelve a ponerlas juntas.
            Un tap lo arregla, y lo contesta quien sabe: su dueño. */}
        {pares.map((par) => {
          const saco = activos.find((it) => it.id === par.saco);
          const pantalon = activos.find((it) => it.id === par.pantalon);
          const atado = !!saco?.attrs.conjunto;
          // Atados, la pregunta sobra: el contenedor de arriba ya enseña la
          // relación y el "separar". Dejar las dos cosas era decirlo dos veces
          // con dos controles distintos.
          if (atado) return null;
          return (
            <button
              key={par.foto + par.saco}
              type="button"
              onClick={() => {
                const id = atado ? undefined : uid();
                patchItem(par.saco, { conjunto: id });
                patchItem(par.pantalon, { conjunto: id });
              }}
              className={`flex items-center gap-3 rounded-sm border p-3 text-left transition-colors ${
                atado ? "border-accent bg-accent-soft" : "border-line bg-bg"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border ${
                  atado ? "border-accent bg-accent text-on-accent" : "border-line bg-surface"
                }`}
              >
                {atado ? <Icon name="check" size={13} /> : null}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                {/* CON NOMBRE Y APELLIDO. Antes sólo podía haber una casilla, y
                    "el saco y el pantalón" bastaba. Ahora puede haber dos o
                    tres en la misma pantalla —un esmoquin y un traje gris— y
                    sin decir cuáles, marcar la correcta sería adivinar. */}
                <span className="text-sm font-medium text-ink">
                  {saco?.attrs.nombre ?? "El saco"} y {(pantalon?.attrs.nombre ?? "el pantalón").toLowerCase()} son un traje
                </span>
                <span className="text-xs leading-snug text-muted">
                  Si no me lo dices, los tomo como dos prendas sueltas y nunca te
                  los pongo juntos.
                </span>
              </span>
            </button>
          );
        })}
        {/* CUÁNTO VA A TARDAR, ANTES DE COMPROMETERSE. El paso siguiente dibuja
            una imagen por prenda (~17s cada una, de cuatro en cuatro) y no se
            puede cancelar: con 12 fotos se puede llegar a 96 prendas, o sea
            siete minutos mirando una barra. El número de prendas ya estaba en
            el botón; lo que faltaba era lo único que hace decidible ese número.
            Se dice sólo cuando pasa de un minuto — antes de eso es ruido. */}
        {activos.length > 14 ? (
          <p className="text-xs leading-snug text-muted">
            Son muchas de una vez: dibujarlas tarda unos{" "}
            {Math.ceil((activos.length / 4) * 17 / 60)} minutos y no se puede
            parar a medias. Si tienes prisa, apaga algunas y vuelve luego por
            ellas.
          </p>
        ) : null}
      </Overlay>
    );
  }

  if (state.kind === "render") {
    return (
      <Overlay>
        <div className="flex flex-col items-center gap-3 pb-1 text-center">
          <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-line text-ink motion-safe:animate-[spin_6s_linear_infinite]">
            <Icon name="destello" size={18} />
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="text-lg font-medium text-ink">generando tus prendas…</p>
            <p className="tabular text-sm text-muted">
              {state.done}/{state.total}
            </p>
          </div>
        </div>
        {/* Grid que se LLENA: cada prenda con spinner hasta que su render llega
            (en vez de un spinner global) — se siente mucho más rápido. */}
        <div className="grid grid-cols-2 gap-3">
          {state.items.map((it) => (
            <div
              key={it.id}
              className="flex flex-col gap-2 rounded-lg border border-line bg-bg p-2"
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-line bg-surface">
                {it.status === "done" && it.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.url}
                    alt={it.attrs.nombre}
                    className="h-full w-full object-cover"
                    style={{ animation: "var(--dur-short) var(--ease-enter) step-in" }}
                  />
                ) : it.status === "failed" ? (
                  <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-muted">
                    No se pudo generar
                  </div>
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Spinner className="h-5 w-5 text-accent" />
                  </div>
                )}
              </div>
              <p className="truncate text-xs font-medium text-ink">{it.attrs.nombre}</p>
            </div>
          ))}
        </div>
      </Overlay>
    );
  }

  if (state.kind === "visual") {
    const keep = state.items.filter((it) => it.verdict === "keep").length;
    const grande = state.items.find((it) => it.id === zoomId) ?? null;
    return (
      <Overlay
        paso={3}
        pie={
          <Footer
            cancel={() => setState({ kind: "idle" })}
            confirmLabel={`sumar ${keep} al clóset`}
            confirmDisabled={false}
            onConfirm={guardar}
          />
        }
      >
        <Header
          title="¿Cuáles son tuyas?"
          // LA COPY ANTERIOR EXPLICABA UNA DE LAS TRES SALIDAS Y ESCONDÍA LA
          // QUE SÍ PIERDE ALGO. Roberto, mirándola: "¿qué significa mala?".
          // "Mala" no habla de la prenda sino del RENDER, y eso no estaba
          // escrito en ningún lado; encima el subtítulo prometía que "no se
          // pierden", que es cierto para "no es mía" y falso para la tercera.
          sub="Si no es tuya, la imagen nos sirve para la biblioteca. Si el dibujo salió mal, lo tiro."
        />
        <div className="grid grid-cols-2 gap-3">
          {state.items.map((it) => (
            <RenderCard
              key={it.id}
              item={it}
              onVerdict={(v) => setVerdict(it.id, v)}
              onZoom={() => setZoomId(it.id)}
            />
          ))}
        </div>
        <PrendaZoom
          data={
            grande?.url
              ? { image: grande.url, nombre: grande.attrs.nombre, sub: grande.attrs.color }
              : null
          }
          onClose={() => setZoomId(null)}
        />
      </Overlay>
    );
  }

  if (state.kind === "listo") {
    return (
      <Overlay
        pie={
          <button
            type="button"
            onClick={() => {
              setState({ kind: "idle" });
              router.refresh();
            }}
            className="flex min-h-[54px] w-full items-center justify-center rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            ver mi clóset
          </button>
        }
      >
        <div className="my-auto flex flex-col items-center gap-5 text-center">
          {/* El mismo anillo del loading, quieto: la tarea acabó. */}
          <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-line text-ink">
            <Icon name="check" size={18} />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-[26px] font-semibold leading-tight text-ink">
              +{state.added} a tu clóset
            </p>
            {state.conjuntos > 0 ? (
              <p className="max-w-[300px] text-sm leading-snug text-muted">
                {state.conjuntos === 1
                  ? "y guardé tu traje como conjunto — sus piezas quedan relacionadas y las verás marcadas."
                  : `y guardé ${state.conjuntos} conjuntos — sus piezas quedan relacionadas y las verás marcadas.`}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-center gap-2 px-2">
            {state.thumbs.map((t, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.url}
                  alt={t.nombre}
                  title={t.nombre}
                  className="h-20 w-14 rounded-md border border-line bg-surface object-cover"
                />
                {/* El subrayado del conjunto (handoff): la marca de "éstas van
                    juntas" sin inventar un badge más. */}
                {t.enConjunto ? (
                  <span className="h-[3px] w-10 rounded-full bg-ink" aria-hidden />
                ) : (
                  <span className="h-[3px] w-10" aria-hidden />
                )}
              </div>
            ))}
          </div>
        </div>
      </Overlay>
    );
  }

  if (state.kind === "guardando") {
    return (
      <Overlay>
        <CarreteLoading frase="guardando tu clóset…" />
      </Overlay>
    );
  }

  // Modo headless: la hoja "Agregar" es el trigger. Solo input + error flotante.
  if (headless) {
    return (
      <>
        {input}
        {/* El error del modo headless también va por portal: este componente vive
            hasta en el drawer de la tab bar (translate), donde un fixed hijo se
            queda confinado — el mismo bug del wizard, en miniatura. */}
        {state.kind === "error" && typeof document !== "undefined" ? (
          createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center lg:items-center bg-ink/40"
            onClick={() => {
              setState({ kind: "idle" });
              // Por si el error llegó DESPUÉS de un guardado parcial (el tope):
              // el clóset de atrás debe verse al día. En errores sin guardado
              // es un refetch de más, inofensivo.
              router.refresh();
            }}
          >
            <div
              className="flex w-full max-w-[430px] flex-col gap-3 rounded-t-[18px] lg:rounded-[18px] bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-center"
              style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm text-error">{state.msg}</p>
              <button
                type="button"
                onClick={() => setState({ kind: "idle" })}
                className="min-h-11 rounded-sm border border-line bg-surface text-sm font-medium text-ink"
              >
                entendido
              </button>
            </div>
          </div>,
            document.body
          )
        ) : null}
      </>
    );
  }

  // idle / error
  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setState({ kind: "explainer" })}
        className="flex min-h-12 items-center gap-2 rounded-sm border border-line bg-surface px-5 text-sm font-medium text-ink transition-colors duration-200 hover:border-accent"
      >
        <Icon name="destello" size={16} className="text-accent" />
        importar del carrete
      </button>
      {state.kind === "error" && (
        <p className="max-w-[14rem] text-right text-xs text-error">{state.msg}</p>
      )}
      {input}
    </div>
  );
}

// ====== Subcomponentes ======

/** El contenedor del flujo: PANTALLA COMPLETA, no hoja.
 *
 *  POR QUÉ CAMBIÓ. Esto no es una hoja: es un wizard de cinco estados
 *  (explainer → revisar → analizando → texto/visual → guardando) en el que se
 *  construye el clóset, con N prendas × 3 decisiones y scroll. Una hoja promete
 *  "corto y desechable", que es lo contrario. Y el proyecto YA tiene el patrón
 *  correcto para esta clase de tarea —el wizard de avatar, pantalla completa con
 *  "paso 1 de 3"—, así que dos tareas del mismo tipo estaban en dos registros, y
 *  la que vivía en la hoja era la más larga de las dos.
 *
 *  Lo que se arregla de paso, todo visible en la captura de Roberto:
 *   · la franja de la pantalla de atrás asomando arriba, que no daba contexto
 *     sino ruido (un "hoy Traje marino de gala" cortado a la mitad);
 *   · el scroll dentro de scroll;
 *   · el pie `sticky` rebanando las tarjetas — ahora vive FUERA del área que
 *     hace scroll, así que ya no puede pisar nada;
 *   · no había dónde decir cuánto falta.
 *
 *  Lo que NO cambia, porque era lo bueno de la hoja: se puede salir en
 *  cualquier momento, y salir no pierde lo hecho. */
function Overlay({
  children,
  paso,
  onBack,
  pie,
}: {
  children: React.ReactNode;
  /** Paso del wizard para la barra de progreso. Los estados de carga no lo pasan. */
  paso?: 1 | 2 | 3;
  onBack?: () => void;
  /** El pie va aparte de los hijos a propósito: fuera del scroll. */
  pie?: React.ReactNode;
}) {
  // POR PORTAL AL BODY — la misma lección que el recortador, un día después.
  //
  // Este flujo se monta desde CUATRO lugares, y uno de ellos —el drawer de
  // "más"— es hijo de la tab bar, que lleva un translate. Un ancestro con
  // transform se vuelve el bloque contenedor de los `fixed` de sus hijos, así
  // que el "fixed inset-0" del wizard se resolvía contra la CAJA DE LA BARRA:
  // Roberto lo fotografió como "el modal aparece metido abajo" — el paso 1
  // asomando en una franja bajo su look. Ya estaba escrito en la memoria del
  // proyecto ("el translate de la tab bar confina los fixed de sus hijos");
  // el Overlay nuevo no se protegió. Portado al body, da igual quién lo monte.
  const montado = useMontadoCarrete();
  if (!montado) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-bg"
      style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
    >
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col overflow-hidden px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        {paso ? <PasoHeader paso={paso} onBack={onBack} /> : null}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto pb-4">{children}</div>
        {pie ? (
          <div className="shrink-0 border-t border-line pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {pie}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

/** `document` no existe en SSR; el portal espera al cliente. */
function useMontadoCarrete(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/** Progreso del wizard — el mismo lenguaje que el de avatar, para que dos
 *  tareas iguales se lean iguales. Sin `onBack` la flecha no se pinta (los
 *  estados de carga no admiten volver a medias). */
function PasoHeader({ paso, onBack }: { paso: 1 | 2 | 3; onBack?: () => void }) {
  return (
    <div className="flex min-h-11 shrink-0 items-center gap-3 pb-4">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="atrás"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-accent-soft"
        >
          <Icon name="flecha" size={18} className="rotate-180" />
        </button>
      ) : (
        <span className="h-9 w-9 shrink-0" aria-hidden />
      )}
      <div className="flex flex-1 gap-1.5">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-[3px] flex-1 rounded-full ${i <= paso ? "bg-ink" : "bg-line"}`}
          />
        ))}
      </div>
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.1em] tabular-nums text-muted">
        paso {paso} de 3
      </span>
    </div>
  );
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <p className="text-sm text-muted">{sub}</p>
    </div>
  );
}

function Footer({
  cancel,
  confirmLabel,
  confirmDisabled,
  onConfirm,
}: {
  cancel: () => void;
  confirmLabel: string;
  confirmDisabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={cancel}
        className="min-h-12 flex-1 rounded-sm border border-line bg-surface text-sm font-medium text-ink"
      >
        cancelar
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={confirmDisabled}
        className="min-h-12 flex-[2] rounded-sm bg-accent text-sm font-medium text-on-accent disabled:opacity-50"
      >
        {confirmLabel}
      </button>
    </div>
  );
}

function RenderCard({
  item,
  onVerdict,
  onZoom,
}: {
  item: RenderItem;
  onVerdict: (v: RenderItem["verdict"]) => void;
  onZoom: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-bg p-2">
      <button
        type="button"
        onClick={item.url ? onZoom : undefined}
        aria-label={item.url ? `Ver ${item.attrs.nombre} en grande` : undefined}
        className="relative block aspect-[3/4] w-full overflow-hidden rounded-md border border-line bg-surface"
      >
        {item.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.attrs.nombre} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center text-[11px] text-muted">
            No se pudo generar — se guarda con su color
          </div>
        )}
      </button>
      <p className="truncate text-xs font-medium text-ink">{item.attrs.nombre}</p>
      <div className="flex gap-1">
        <VerdictBtn label="es mía" on={item.verdict === "keep"} onClick={() => onVerdict("keep")} />
        <VerdictBtn
          label="no es mía"
          on={item.verdict === "notmine"}
          onClick={() => onVerdict("notmine")}
        />
        <VerdictBtn
          label="salió mal"
          on={item.verdict === "trash"}
          onClick={() => onVerdict("trash")}
        />
      </div>
    </div>
  );
}

function VerdictBtn({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-8 flex-1 rounded-sm border px-1 text-[11px] font-medium transition-colors ${
        on ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-muted"
      }`}
    >
      {label}
    </button>
  );
}

// Loading canónico del carrete (v3): spark girando lento + frase serif + conteo.
function CarreteLoading({ frase, count }: { frase: string; count?: string }) {
  return (
    // `my-auto`: en pantalla completa el loader se centra vertical cuando sobra
    // sitio, y no recorta nada cuando no (que es lo que sí haría justify-center
    // en el contenedor con scroll). Antes se apoyaba en que la hoja se encogía
    // al contenido; ahora la pantalla mide lo que mide.
    <div className="my-auto flex flex-col items-center gap-4 py-8 text-center">
      <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-line text-ink motion-safe:animate-[spin_6s_linear_infinite]">
        <Icon name="destello" size={20} />
      </span>
      <p className="text-lg font-medium text-ink">{frase}</p>
      {count ? <p className="tabular text-sm text-muted">{count}</p> : null}
    </div>
  );
}
