"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { EL_CORTE_IMPORTA } from "@/lib/afinar-prendas";
import { PALETA, coloresCercanos } from "@/lib/paleta-colores";
import { ejemploDeTalla } from "@/lib/prenda-atributos";
import type { PrendaExistente } from "@/lib/ya-la-tienes";
import type { PrendaAnalisis } from "@/app/api/analizar-prenda/route";
import type { PrendaDetectada } from "@/app/api/analizar-prendas/route";

// LA TARJETA DE CONFIRMAR UNA PRENDA LEÍDA — UNA SOLA, PARA TODAS LAS PUERTAS.
//
// Vivía dentro del flujo del carrete, y mientras ésa fuera la única forma de
// que una prenda entrara por foto, ahí estaba bien. Dejó de estarlo el día que
// el espejo abrió una segunda puerta: le escribí una lista propia —nombre,
// color y una casilla— y el resultado fue que el carrete confirmaba SIETE
// campos y el espejo CERO.
//
// Y al revés de como debería: la foto de espejo es el PEOR insumo que recibe el
// producto (oclusión, luz de ambiente, prendas a medio ver), o sea justo la que
// más necesita poder corregirse, y era la única sin nada que corregir. Es el
// mismo bug de siempre con otro disfraz — dato leído, guardado, usado por el
// motor, invisible e incorregible — sólo que esta vez lo construí yo el mismo
// día que lo estaba arreglando en otra pantalla.
//
// Roberto lo cazó de una: "se reusa mucha de la lógica que hicimos hace rato".
// Las LIBS sí se reusaban (leer la foto, el aviso de duplicado, el alta); lo
// que no era la pantalla donde la persona corrige, que es donde se decide si el
// dato entra bien o entra mal.
//
// `compacta` es lo que hace que quepa en el espejo: la tarjeta arranca cerrada
// y sólo se abre si la persona quiere afinar. Ahí está saliendo de su casa —
// exigirle siete campos por prenda sería convertir un favor en un trámite—,
// pero la puerta para corregir existe, que es lo que faltaba.


// FALTABA "SACO" — ver el comentario largo en add-photo-flow.tsx. La visión sí
// lo detecta; sin botón, la prenda salía con nada marcado y parecía no
// detectada. 18 prendas de foto son categoría 'saco' y todas pasaron por aquí.
export const CATEGORIAS: { v: PrendaAnalisis["categoria"]; l: string }[] = [
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
export const CORTES: { v: string; l: string }[] = [
  { v: "entallado", l: "entallado" },
  { v: "recto", l: "recto" },
  { v: "holgado", l: "holgado" },
];
export const LARGOS: { v: string; l: string }[] = [
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
export const MATERIALES: { v: string; l: string }[] = [
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
export const PATRONES_CHIP: { v: string; l: string }[] = [
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
export function conLeido(
  opciones: { v: string; l: string }[],
  leido?: string
): { v: string; l: string }[] {
  const v = (leido ?? "").trim();
  if (!v || opciones.some((o) => o.v.toLowerCase() === v.toLowerCase())) return opciones;
  return [{ v, l: v }, ...opciones];
}
export const FORMALIDADES: { v: PrendaAnalisis["formalidad"]; l: string }[] = [
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
export const mismoHex = (a?: string, b?: string) =>
  !!a && !!b && a.replace("#", "").toLowerCase() === b.replace("#", "").toLowerCase();

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // `min-w-0 flex-1`: cuando dos Field comparten fila (marca y talla), sin
    // esto el input no baja de lo que mide su texto de ejemplo y se sale.
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
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
export function Escala({
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

/** Lo mínimo que la tarjeta necesita saber de una prenda leída. */
export type DraftLeida = {
  id: string;
  attrs: PrendaDetectada;
  on: boolean;
  /** La foto de donde salió (dataURL) — la miniatura de la izquierda. */
  photoPreview: string;
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

export function DraftCard({
  item,
  yaEsta,
  onToggle,
  onPatch,
  onEsLaMisma,
  compacta = false,
}: {
  item: DraftLeida;
  /** La prenda del clóset que probablemente sea ésta, si la hay. */
  yaEsta: PrendaExistente | null;
  onToggle: () => void;
  onPatch: (patch: Partial<PrendaDetectada>, campos?: string[]) => void;
  /** "sí, es la misma": el padre le pone esta foto a la prenda que ya existe. */
  onEsLaMisma?: (itemId: string) => void;
  /**
   * Arranca cerrada, con un "afinar" que la abre.
   *
   * Es lo que la hace caber en el espejo: ahí la persona está saliendo de su
   * casa y pedirle siete campos por prenda convertiría un favor en un trámite.
   * Pero la puerta para corregir EXISTE, que es todo el punto — y se abre sola
   * cuando el modelo dijo que no la vio bien, porque ése es exactamente el caso
   * en que hay algo que arreglar.
   */
  compacta?: boolean;
}) {
  const a = item.attrs;
  const baja = a.confianza === "baja";
  // Se abre por prenda y no se vuelve a cerrar: quien pidió ver todos los
  // colores es porque la lectura le falló, y volver a esconderlos sería quitarle
  // la salida justo cuando la está usando.
  const [todosLosColores, setTodosLosColores] = useState(false);
  /** La decisión del duplicado: null = sin contestar. */
  const [dupe, setDupe] = useState<null | "misma" | "otra">(null);
  // Cerrada sólo si se pidió compacta Y el modelo dice que la vio bien. Cuando
  // declara baja confianza o marca campos inseguros, se abre sola: esconder
  // justo lo que hay que revisar sería quedarse con lo peor de las dos formas.
  const [abierta, setAbierta] = useState(
    !compacta || baja || (a.inseguro ?? []).length > 0
  );
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
        {/* LA MINIATURA, O EL COLOR.
            En el carrete cada prenda viene de una foto distinta, así que la
            miniatura sirve para saber de cuál. En el espejo TODAS salen de la
            misma foto: enseñar tu cuerpo entero cuatro veces seguidas no
            identifica nada, sólo llena la pantalla de ruido. Ahí manda el color
            leído, que es lo único que distingue una fila de la siguiente. */}
        {compacta ? (
          <span
            className="h-16 w-12 shrink-0 rounded-md border border-line"
            style={{ backgroundColor: item.leido.hex }}
            aria-hidden
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photoPreview}
            alt=""
            className="h-16 w-12 shrink-0 rounded-md border border-line object-cover"
          />
        )}
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
          {/* EL DUPLICADO, LADO A LADO — del handoff de carga.
              Antes era una tira con una miniatura de 40×32 RECORTADA y un solo
              botón ("no sumarla"). Dos problemas: comparar una foto recortada
              induce error —el recorte esconde justo el detalle que distingue una
              camisa de otra—, y "no sumarla" es media decisión: dice qué NO
              hacer y no qué sí.
              Ahora las dos imágenes van completas (`object-contain`, nunca
              crop), rotuladas, del mismo alto, y la pregunta se contesta con dos
              botones en el MISMO bloque. Resuelto, colapsa a una línea con ✓.
              El fondo es `accent-soft` y la señal de atención la da el filete
              `warning`: el handoff pedía un tono arena (#efeae0) que no está en
              el DS, y no se inventa un token para un aviso. */}
          {yaEsta && item.on ? (
            dupe ? (
              <p className="flex items-start gap-1.5 rounded-sm bg-accent-soft px-2 py-1.5 text-[11px] leading-snug text-muted">
                <Icon name="check" size={12} className="mt-px shrink-0 text-success" />
                {dupe === "misma"
                  ? "es la misma — le pongo tu foto a la que ya tienes"
                  : `se suma como ${a.categoria ?? "prenda"} nueva`}
              </p>
            ) : (
              <div className="flex flex-col gap-2 rounded-sm border-l-2 border-warning bg-accent-soft p-2.5">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { src: item.photoPreview, rotulo: "EN TU FOTO" },
                    { src: yaEsta.imagen, rotulo: "YA EN TU CLÓSET" },
                  ].map((x) => (
                    <div key={x.rotulo} className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-faint">
                        {x.rotulo}
                      </span>
                      {x.src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={x.src}
                          alt=""
                          className="h-32 w-full rounded-sm border border-line bg-surface object-contain"
                        />
                      ) : (
                        <span className="h-32 w-full rounded-sm border border-line bg-surface" />
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[12px] leading-snug text-ink">
                  ¿es {a.categoria === "calzado" ? "el mismo" : "la misma"}{" "}
                  {(yaEsta.nombre || a.nombre).toLowerCase()}?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDupe("misma");
                      onEsLaMisma?.(yaEsta.id);
                      onToggle(); // no se suma otra vez: se le pone la foto a la que ya está
                    }}
                    className="min-h-9 flex-1 rounded-sm bg-accent px-2 text-[12px] font-semibold text-on-accent"
                  >
                    sí, es la misma
                  </button>
                  <button
                    type="button"
                    onClick={() => setDupe("otra")}
                    className="min-h-9 flex-1 rounded-sm border border-line bg-surface px-2 text-[12px] font-medium text-ink"
                  >
                    no, es otra
                  </button>
                </div>
              </div>
            )
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

      {item.on && !abierta ? (
        <button
          type="button"
          onClick={() => setAbierta(true)}
          className="flex min-h-9 items-center justify-center gap-1.5 rounded-sm border border-line bg-surface text-[12.5px] font-medium text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <Icon name="mas" size={13} />
          afinar color, tipo, material y marca
        </button>
      ) : null}

      {item.on && abierta && (
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

          {/* MARCA Y TALLA, y aquí sí — pero sólo aquí dentro.
              Roberto las pidió al dar de alta, y la objeción sigue en pie: en la
              carga masiva, quince prendas por dos campos de texto es la fricción
              de catalogar que este producto existe para no tener. Pero este
              bloque está CERRADO por defecto: quien lo abrió ya decidió afinar
              esa prenda, y negárselas ahí sería mandarlo a la ficha a repetir un
              viaje que ya venía haciendo.
              Ningún modelo las lee (marca: 2 de 336 prendas, y sólo por el logo;
              la talla vive en una etiqueta por dentro), así que llegan vacías
              siempre — nada que corregir, sólo que escribir si quiere. */}
          <div className="flex gap-2">
            <Field label="Marca">
              <input
                value={a.marca ?? ""}
                onChange={(e) => onPatch({ marca: e.target.value }, ["marca"])}
                placeholder="Uniqlo, Zara…"
                className="min-h-9 w-full rounded-sm border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-accent"
              />
            </Field>
            <Field label="Talla">
              <input
                value={a.talla ?? ""}
                onChange={(e) => onPatch({ talla: e.target.value }, ["talla"])}
                placeholder={ejemploDeTalla(a.categoria)}
                className="min-h-9 w-full rounded-sm border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-accent"
              />
            </Field>
          </div>
        </>
      )}
    </div>
  );
}

