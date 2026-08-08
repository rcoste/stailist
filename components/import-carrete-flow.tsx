"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { useRouter } from "next/navigation";
import { toUsableImage } from "@/lib/image-file";
import { createClient } from "@/lib/supabase/client";
import { addPhotoItems, addLibraryCandidates, prendasParaComparar } from "@/app/closet/actions";
import { Spinner } from "@/components/spinner";
import { Icon } from "@/components/icon";
import { ImageCrop } from "@/components/image-crop";
import { PrendaZoom } from "@/components/prenda-zoom";
import { EL_CORTE_IMPORTA } from "@/lib/afinar-prendas";
import { paresDeTraje } from "@/lib/par-de-traje";
import { PALETA, coloresCercanos } from "@/lib/paleta-colores";
import { yaLaTienes, type PrendaExistente } from "@/lib/ya-la-tienes";
import type { AddFlowHandle } from "@/components/add-photo-flow";
import type { PrendaAnalisis } from "@/app/api/analizar-prenda/route";
import type { PrendaDetectada } from "@/app/api/analizar-prendas/route";

const MAX_FOTOS = 12;

// FALTABA "SACO" — ver el comentario largo en add-photo-flow.tsx. La visión sí
// lo detecta; sin botón, la prenda salía con nada marcado y parecía no
// detectada. 18 prendas de foto son categoría 'saco' y todas pasaron por aquí.
const CATEGORIAS: { v: PrendaAnalisis["categoria"]; l: string }[] = [
  { v: "top", l: "Top" },
  { v: "saco", l: "Saco" },
  { v: "bottom", l: "Pantalón" },
  { v: "abrigo", l: "Abrigo" },
  { v: "vestido", l: "Vestido" },
  { v: "calzado", l: "Calzado" },
  { v: "accesorio", l: "Accesorio" },
];

// EL CORTE Y EL LARGO en la confirmación. Mi número de ayer —"sólo 36 prendas
// se quedan sin corte"— contestaba la pregunta equivocada: medía los huecos,
// no los ERRORES. La visión llena el corte en 199 prendas y se guarda tal cual
// (addPhotoItems lo escribe), sin que nadie lo vea nunca. Una lectura mala es
// hoy invisible e incorregible, que es el mismo dato inventado de siempre con
// otro disfraz.
//
// CON "no aplica" EXPLÍCITO, como pidió Roberto: unos leggings no tienen corte
// que discutir y una camiseta no tiene largo interesante. Sin esa salida, la
// única forma de no contestar es dejar lo que el modelo puso — o sea, aceptar.
const CORTES: { v: string; l: string }[] = [
  { v: "entallado", l: "entallado" },
  { v: "recto", l: "recto" },
  { v: "holgado", l: "holgado" },
];
const LARGOS: { v: string; l: string }[] = [
  { v: "crop", l: "corto" },
  { v: "regular", l: "regular" },
  { v: "largo", l: "largo" },
];

// MATERIAL Y PATRÓN, que la visión ya leía y NADIE veía. Mismo caso que el
// corte: dato leído, guardado y usado —el material decide "lana en calor" y el
// patrón decide "dos estampados que pelean"— pero invisible en la pantalla
// donde se confirma todo lo demás, y por tanto incorregible.
//
// Son chips y no un campo de texto: esto es la carga MASIVA, y escribir
// "algodón" a mano en doce prendas es exactamente la fricción que este flujo
// existe para no tener. Lo que el modelo lea fuera de la lista se conserva y
// se muestra como una opción más (ver `conLeido`).
const MATERIALES: { v: string; l: string }[] = [
  { v: "algodón", l: "algodón" },
  { v: "lana", l: "lana" },
  { v: "mezclilla", l: "mezclilla" },
  { v: "lino", l: "lino" },
  { v: "punto", l: "punto" },
  { v: "piel", l: "piel" },
  { v: "ante", l: "ante" },
  { v: "sintético", l: "sintético" },
  { v: "seda", l: "seda" },
];
const PATRONES_CHIP: { v: string; l: string }[] = [
  { v: "liso", l: "liso" },
  { v: "rayas", l: "rayas" },
  { v: "cuadros", l: "cuadros" },
  { v: "floral", l: "floral" },
  { v: "animal-print", l: "animal print" },
  { v: "grafico", l: "gráfico" },
  { v: "estampado", l: "estampado" },
];

/**
 * La lista con el valor leído dentro, si el modelo dijo algo que no está.
 *
 * Sin esto, un material como "cashmere" o "gabardina" se vería como si no
 * hubiera nada seleccionado —el mismo bug del saco y el del color— y tocar
 * cualquier chip para "arreglarlo" destruiría un dato más específico.
 */
function conLeido(
  opciones: { v: string; l: string }[],
  leido?: string
): { v: string; l: string }[] {
  const v = (leido ?? "").trim();
  if (!v || opciones.some((o) => o.v.toLowerCase() === v.toLowerCase())) return opciones;
  return [{ v, l: v }, ...opciones];
}
const FORMALIDADES: { v: PrendaAnalisis["formalidad"]; l: string }[] = [
  { v: "casual", l: "Casual" },
  { v: "formal-casual", l: "Casual-formal" },
  { v: "formal", l: "Formal" },
];
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

type DraftItem = {
  id: string;
  attrs: PrendaDetectada;
  on: boolean;
  photoPreview: string; // dataURL de la foto de origen
  /**
   * Qué campos TOCÓ la persona en esta pantalla.
   *
   * Esta es la confirmación más fuerte que existe en toda la app —aquí se
   * repasa prenda por prenda y campo por campo— y no se registraba en ningún
   * lado: al motor le llegaba igual una prenda revisada a mano que una que
   * nadie miró. Sólo los TOCADOS, porque todo viene preseleccionado y dejarlo
   * como está no es confirmar, es no haber mirado.
   */
  tocados: Set<string>;
  /**
   * El color TAL COMO LO LEYÓ la visión, guardado aparte y sin tocar.
   *
   * Vive fuera de `attrs` porque attrs se sobreescribe al corregir: sin esta
   * copia, tocar un swatch de la paleta por error borraba para siempre un hex
   * exacto (#3A3A3C, gris carbón) y lo cambiaba por el atajo más cercano
   * (#8A8A8A, gris de en medio) — o sea que "corregir" aclaraba la prenda y no
   * había vuelta atrás. Con la copia, el swatch de lo leído siempre está y
   * volver es un tap.
   */
  leido: { color: string; hex: string };
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
  | { kind: "analizando"; done: number; total: number }
  | { kind: "texto"; items: DraftItem[] }
  | { kind: "render"; items: RenderItem[]; done: number; total: number }
  | { kind: "visual"; items: RenderItem[] }
  | { kind: "guardando" }
  | { kind: "error"; msg: string };

/** Mismo color, ignorando mayúsculas y el # — los hex vienen de dos fuentes. */
const mismoHex = (a?: string, b?: string) =>
  !!a && !!b && a.replace("#", "").toLowerCase() === b.replace("#", "").toLowerCase();

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
  // `startConFoto` es la puerta desde el flujo de UNA prenda: cuando la visión
  // avisa que en la foto hay varias, se pasa la misma foto aquí en vez de hacer
  // que la persona vuelva a empezar. Entra directo al recorte —ya está
  // comprimida y ya la eligió— y se salta el explainer y el picker.
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
        msg: e instanceof PermisoError ? e.message : "No pude leer las fotos. Inténtalo otra vez.",
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
    setState({ kind: "analizando", done: 0, total: fotos.length });
    let done = 0;
    try {
      const perPhoto = await Promise.all(
        fotos.map(async (f) => {
          const res = await fetch("/api/analizar-prendas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: f.dataUrl }),
          });
          done += 1;
          setState({ kind: "analizando", done, total: fotos.length });
          if (res.status === 403) {
            // Permiso parental pendiente: no es un problema de la foto — corta
            // el flujo con el mensaje real en vez de "no detecté prendas".
            const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
            if (err.error === "permiso_pendiente" && err.message) throw new PermisoError(err.message);
            return [] as DraftItem[];
          }
          if (!res.ok) return [] as DraftItem[];
          const { prendas } = (await res.json()) as { prendas: PrendaDetectada[] };
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
        setState({
          kind: "error",
          msg: `Sumé ${okItems.added} prendas — son muchas de una vez y ${okItems.dejadas} se quedaron fuera. Vuelve a entrar con esas fotos y las agrego.`,
        });
        router.refresh();
        return;
      }
      setState({ kind: "idle" });
      router.refresh();
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
      <Overlay>
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
        <Footer
          cancel={() => setState({ kind: "idle" })}
          confirmLabel="elegir fotos"
          confirmDisabled={false}
          onConfirm={() => inputRef.current?.click()}
        />
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
      <Overlay>
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
        <Footer
          cancel={() => setState({ kind: "idle" })}
          confirmLabel={`leer ${state.fotos.length} ${state.fotos.length === 1 ? "foto" : "fotos"}`}
          confirmDisabled={state.fotos.length === 0}
          onConfirm={analizarFotos}
        />
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
    return (
      <Overlay>
        <CarreteLoading frase="leyendo tus prendas…" count={`${state.done}/${state.total} fotos`} />
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
      <Overlay>
        <Header
          title="¿Detecté bien tus prendas?"
          sub="Confirma o corrige cada una. Apaga con la ✓ las que no quieras sumar."
        />
        <div className="flex flex-col gap-3">
          {state.items.map((it) => (
            <DraftCard
              key={it.id}
              item={it}
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
          ))}
        </div>

        {/* EL LAZO DEL TRAJE. Un traje se guarda como dos prendas —así debe
            ser—, pero sin decir que van juntas la regla de "traje desparejado"
            marca ese par como error y el motor nunca vuelve a ponerlas juntas.
            Un tap lo arregla, y lo contesta quien sabe: su dueño. */}
        {pares.map((par) => {
          const saco = activos.find((it) => it.id === par.saco);
          const pantalon = activos.find((it) => it.id === par.pantalon);
          const atado = !!saco?.attrs.conjunto;
          return (
            <button
              key={par.foto + par.saco}
              type="button"
              onClick={() => {
                const id = atado ? undefined : uid();
                patchItem(par.saco, { conjunto: id });
                patchItem(par.pantalon, { conjunto: id });
              }}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
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
        <Footer
          cancel={() => setState({ kind: "idle" })}
          confirmLabel={`generar ${activos.length} ${activos.length === 1 ? "prenda" : "prendas"}`}
          confirmDisabled={activos.length === 0}
          onConfirm={generarRenders}
        />
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
              className="flex flex-col gap-2 rounded-xl border border-line bg-bg p-2"
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
      <Overlay>
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
        <Footer
          cancel={() => setState({ kind: "idle" })}
          confirmLabel={`sumar ${keep} al clóset`}
          confirmDisabled={false}
          onConfirm={guardar}
        />
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
        {state.kind === "error" ? (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center lg:items-center bg-ink/40"
            onClick={() => setState({ kind: "idle" })}
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
          </div>
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

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center bg-ink/40">
      <div
        className="flex max-h-[90dvh] w-full max-w-[430px] flex-col gap-4 overflow-y-auto rounded-t-[18px] lg:rounded-[18px] bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5"
        style={{ animation: "var(--dur-short) var(--ease-enter) sheet-up" }}
      >
        {children}
      </div>
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
    <div className="sticky bottom-0 flex gap-3 bg-surface pt-1">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </div>
  );
}

/**
 * Escala de 3 valores + "no aplica" — para corte y largo.
 *
 * El "no aplica" es de Roberto y no es un extra: sin él, la única forma de no
 * contestar es dejar lo que el modelo puso, o sea aceptarlo en silencio. Con la
 * salida explícita, "esta prenda no tiene corte que discutir" se puede DECIR, y
 * el atributo se borra en vez de quedarse con un valor inventado.
 */
function Escala({
  opciones,
  valor,
  onPick,
  vacio = "no aplica",
}: {
  opciones: { v: string; l: string }[];
  valor?: string;
  onPick: (v: string | undefined) => void;
  /** Cómo se llama "ninguno". En el patrón "no aplica" confundiría con "liso". */
  vacio?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opciones.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onPick(o.v)}
          className={`min-h-8 rounded-sm border px-2.5 text-xs transition-colors ${
            valor === o.v
              ? "border-accent bg-accent-soft text-accent"
              : "border-line bg-surface text-muted"
          }`}
        >
          {o.l}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPick(undefined)}
        className={`min-h-8 rounded-sm border px-2.5 text-xs transition-colors ${
          !valor ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-muted"
        }`}
      >
        {vacio}
      </button>
    </div>
  );
}

function DraftCard({
  item,
  yaEsta,
  onToggle,
  onPatch,
}: {
  item: DraftItem;
  /** La prenda del clóset que probablemente sea ésta, si la hay. */
  yaEsta: PrendaExistente | null;
  onToggle: () => void;
  onPatch: (patch: Partial<PrendaDetectada>, campos?: string[]) => void;
}) {
  const a = item.attrs;
  const baja = a.confianza === "baja";
  // Se abre por prenda y no se vuelve a cerrar: quien pidió ver todos los
  // colores es porque la lectura le falló, y volver a esconderlos sería quitarle
  // la salida justo cuando la está usando.
  const [todosLosColores, setTodosLosColores] = useState(false);
  // El nombre que se enseña es el que LEYÓ la visión ("gris oscuro"), no el del
  // atajo más parecido: es más específico y es lo que de verdad se guardó.
  const colorName = a.color;
  // El swatch de lo leído sólo hace falta si no es ya uno de los atajos.
  const hayLeido = !!item.leido.hex && !PALETA.some((p) => mismoHex(item.leido.hex, p.hex));
  // VECINOS PRIMERO (idea de Roberto): un carbón puede confundirse con negro o
  // marino, jamás con rosa. Enseñar las once cada vez obligaba a buscar entre
  // colores que nadie iba a elegir.
  //
  // PERO LA PUERTA SE ABRE SIEMPRE. Filtrar por cercanía da por hecho que la
  // lectura es aproximadamente correcta, que es justo lo que falla cuando más
  // falta hace corregir: un saco marino con luz cálida se puede leer "café", y
  // ahí el color bueno no está entre los vecinos del café. Si el filtro cerrara
  // la puerta, el único error que importa sería el único imposible de arreglar.
  const cercanos = coloresCercanos(item.leido.hex, 4);
  const mostrar = todosLosColores ? PALETA : cercanos;
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-3 transition-opacity ${
        item.on ? "border-line bg-bg" : "border-line bg-bg opacity-50"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.photoPreview}
          alt=""
          className="h-16 w-12 shrink-0 rounded-md border border-line object-cover"
        />
        <div className="flex flex-1 flex-col gap-1.5">
          <input
            value={a.nombre}
            onChange={(e) => onPatch({ nombre: e.target.value }, ["nombre"])}
            className="min-h-9 rounded-sm border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-accent"
          />
          {baja && (
            <span className="w-fit rounded-sm bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
              No la vi bien — confírmala
            </span>
          )}
          {/* "YA LA TIENES": avisa, no borra. De los 25 grupos con nombre
              repetido en la base, 8 son prendas DISTINTAS de verdad (los tres
              pantalones negros de Roberto son de sintético, lana y algodón).
              Apagarla sola le quitaría ropa real sin que se entere; un aviso
              que se ignora cuesta una mirada. Con foto, porque sin ver las dos
              no se puede decidir. */}
          {yaEsta && item.on ? (
            <div className="flex items-center gap-2 rounded-sm bg-warning/10 p-1.5">
              {yaEsta.imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={yaEsta.imagen}
                  alt=""
                  className="h-10 w-8 shrink-0 rounded-sm border border-line object-cover"
                />
              ) : null}
              <span className="flex min-w-0 flex-col">
                <span className="text-[11px] font-medium text-ink">
                  Creo que ya la tienes
                </span>
                <span className="truncate text-[11px] text-muted">{yaEsta.nombre}</span>
              </span>
              <button
                type="button"
                onClick={onToggle}
                className="ml-auto shrink-0 rounded-sm border border-line bg-surface px-2 py-1 text-[11px] text-muted transition-colors hover:border-accent hover:text-accent"
              >
                no sumarla
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={item.on}
          aria-label={item.on ? "Quitar prenda" : "Incluir prenda"}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
            item.on ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-muted"
          }`}
        >
          <Icon name={item.on ? "check" : "mas"} size={14} />
        </button>
      </div>

      {item.on && (
        <>
          <Field label="Tipo">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIAS.map((c) => (
                <button
                  key={c.v}
                  type="button"
                  onClick={() => onPatch({ categoria: c.v }, ["categoria"])}
                  className={`min-h-8 rounded-sm border px-2.5 text-xs transition-colors ${
                    a.categoria === c.v
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line bg-surface text-muted"
                  }`}
                >
                  {c.l}
                </button>
              ))}
            </div>
          </Field>

          <Field label={`Color · ${colorName}`}>
            <div className="flex flex-wrap gap-2">
              {/* EL COLOR QUE LEÍ, con su hex exacto y encendido. Va primero y
                  sólo aparece cuando no coincide con ningún atajo de la paleta:
                  es la respuesta a "¿por qué no hay ninguno marcado?" — sí lo
                  detectó, y con más precisión que cualquiera de los 11. Sin
                  este swatch, la pantalla invita a tocar el gris de en medio
                  para "arreglarlo", y eso EMPEORA el dato. */}
              {hayLeido ? (
                <button
                  type="button"
                  aria-label={`${item.leido.color} — el que leí`}
                  title={`${item.leido.color} — el que leí`}
                  onClick={() =>
                    onPatch(
                      { color: item.leido.color, color_hex: item.leido.hex },
                      ["color"]
                    )
                  }
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${
                    mismoHex(a.color_hex, item.leido.hex)
                      ? "scale-110 border-accent"
                      : "border-line"
                  }`}
                  style={{ backgroundColor: item.leido.hex }}
                />
              ) : null}
              {mostrar.map((p) => (
                <button
                  key={p.hex}
                  type="button"
                  onClick={() => onPatch({ color: p.name, color_hex: p.hex }, ["color"])}
                  aria-label={p.name}
                  title={p.name}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${
                    mismoHex(a.color_hex, p.hex)
                      ? "scale-110 border-accent"
                      : "border-line"
                  }`}
                  style={{ backgroundColor: p.hex }}
                />
              ))}
              {/* La puerta. Sin esto, una lectura MUY equivocada sería
                  incorregible — ver el comentario de `cercanos`. */}
              {!todosLosColores ? (
                <button
                  type="button"
                  onClick={() => setTodosLosColores(true)}
                  className="min-h-7 rounded-sm border border-line bg-surface px-2 text-[11px] text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  otro color
                </button>
              ) : null}
            </div>
          </Field>

          <Field label="Formalidad">
            <div className="flex flex-wrap gap-1.5">
              {FORMALIDADES.map((f) => (
                <button
                  key={f.v}
                  type="button"
                  onClick={() => onPatch({ formalidad: f.v }, ["formalidad"])}
                  className={`min-h-8 rounded-sm border px-2.5 text-xs transition-colors ${
                    a.formalidad === f.v
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-line bg-surface text-muted"
                  }`}
                >
                  {f.l}
                </button>
              ))}
            </div>
          </Field>

          {/* Corte y largo SÓLO donde cambian el look: en un zapato o un
              cinturón no significan nada. La lista se importa de afinar-prendas
              para que ficha, card y este editor no se desincronicen. */}
          {EL_CORTE_IMPORTA.has(a.categoria) ? (
            <>
              <Field label="Cómo le queda">
                <Escala
                  opciones={CORTES}
                  valor={a.corte}
                  onPick={(v) => onPatch({ corte: v as PrendaAnalisis["corte"] }, ["corte"])}
                />
              </Field>
              <Field label="Largo">
                <Escala
                  opciones={LARGOS}
                  valor={a.largo}
                  onPick={(v) => onPatch({ largo: v as PrendaAnalisis["largo"] }, ["largo"])}
                />
              </Field>
            </>
          ) : null}

          {/* Material y patrón van en TODAS las categorías: la lana de unos
              guantes y el estampado de una bufanda cuentan igual. */}
          <Field label="Material">
            <Escala
              opciones={conLeido(MATERIALES, a.material)}
              valor={a.material}
              onPick={(v) => onPatch({ material: v }, ["material"])}
              vacio="no sé"
            />
          </Field>
          <Field label="Patrón">
            <Escala
              opciones={conLeido(PATRONES_CHIP, a.patron)}
              valor={a.patron}
              onPick={(v) => onPatch({ patron: v as PrendaAnalisis["patron"] }, ["patron"])}
              vacio="sin dato"
            />
          </Field>
        </>
      )}
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
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-bg p-2">
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
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-line text-ink motion-safe:animate-[spin_6s_linear_infinite]">
        <Icon name="destello" size={20} />
      </span>
      <p className="text-lg font-medium text-ink">{frase}</p>
      {count ? <p className="tabular text-sm text-muted">{count}</p> : null}
    </div>
  );
}
