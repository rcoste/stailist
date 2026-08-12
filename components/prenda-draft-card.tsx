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
// El vocabulario (catálogos, Field, Escala, conLeido, el chip y su mapa de
// secciones) vive en components/prenda-campos desde 2026-08-12: la ficha del
// clóset necesita el mismo lenguaje y no puede reusar esta tarjeta.
// Se re-exporta lo que ya era público aquí para no mover a los consumidores.
import {
  CATEGORIAS,
  CORTES,
  LARGOS,
  MATERIALES,
  PATRONES_CHIP,
  FORMALIDADES,
  SECCION_DE_CAMPO,
  conLeido,
  mismoHex,
  Field,
  Escala,
  ChipResumen,
  type Seccion,
} from "@/components/prenda-campos";

export {
  CATEGORIAS,
  CORTES,
  LARGOS,
  MATERIALES,
  PATRONES_CHIP,
  FORMALIDADES,
  conLeido,
  mismoHex,
  Field,
  Escala,
};

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

// LOS CHIPS TOCABLES (handoff de carga): la tarjeta ya no se abre entera.
//
// Antes el carrete pintaba el formulario COMPLETO por prenda —siete secciones
// siempre visibles— y el espejo lo escondía todo tras un "afinar" que también
// lo abría entero. Las dos formas fallaban igual: para corregir UN campo había
// que atravesar seis sanos, y con doce prendas la pantalla era un muro.
//
// Ahora cada prenda es una fila con chips que DICEN el valor actual (tipo,
// color con su punto, formalidad, "+ más"), y tocar uno abre SOLO su editor.
// Elegir cierra. El chip es a la vez el resumen y la puerta — no hay estado
// "abierto del todo".

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
  // Qué editor arranca abierto: el del PRIMER campo que el modelo marcó como
  // inseguro. Sustituye al viejo "se abre entera cuando hay algo dudoso" —
  // abrir siete secciones para revisar una enterraba la dudosa entre seis
  // sanas. Con confianza baja y sin campo señalado, no se abre nada: el badge
  // de "no la vi bien" y los bordes warning de los chips ya dicen dónde mirar.
  const [seccion, setSeccion] = useState<Seccion | null>(() => {
    for (const campo of a.inseguro ?? []) {
      const sec = SECCION_DE_CAMPO[campo];
      if (sec) return sec;
    }
    return null;
  });
  const inseguro = new Set<string>(a.inseguro ?? []);
  /** Tocar el chip abierto lo cierra; tocar otro cambia de editor. */
  const abre = (sec: Seccion) => setSeccion(seccion === sec ? null : sec);
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
            className={`min-h-9 rounded-sm border border-line bg-surface px-2.5 text-sm outline-none focus:border-accent ${
              item.on ? "text-ink" : "text-muted line-through"
            }`}
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

      {/* Los chips sólo viven mientras la prenda está prendida: apagada, la
          fila queda en nombre tachado y nada tocable (handoff). */}
      {item.on ? (
        <div className="flex flex-wrap gap-1.5">
          <ChipResumen
            activo={seccion === "tipo"}
            alerta={inseguro.has("categoria")}
            onClick={() => abre("tipo")}
          >
            {CATEGORIAS.find((c) => c.v === a.categoria)?.l ?? "tipo"}
          </ChipResumen>
          <ChipResumen
            activo={seccion === "color"}
            alerta={inseguro.has("color")}
            onClick={() => abre("color")}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-line"
              style={{ backgroundColor: a.color_hex }}
              aria-hidden
            />
            {colorName}
          </ChipResumen>
          <ChipResumen
            activo={seccion === "formalidad"}
            alerta={inseguro.has("formalidad")}
            onClick={() => abre("formalidad")}
          >
            {FORMALIDADES.find((f) => f.v === a.formalidad)?.l ?? "formalidad"}
          </ChipResumen>
          <ChipResumen
            dashed
            activo={seccion === "mas"}
            alerta={["corte", "largo", "material", "patron"].some((c) => inseguro.has(c))}
            onClick={() => abre("mas")}
          >
            + más
          </ChipResumen>
        </div>
      ) : null}

      {/* EL EDITOR EN SITIO: sólo la sección del chip tocado. En tipo, color
          y formalidad ELEGIR CIERRA — la corrección típica es un tap, no una
          sesión de formulario. En "+ más" no: son varios campos opcionales y
          cerrarse al primero obligaría a reabrir por cada uno; ahí cierra el
          botón "listo". */}
      {item.on && seccion === "tipo" && (
        <Field label="Tipo">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIAS.map((c) => (
              <button
                key={c.v}
                type="button"
                onClick={() => {
                  onPatch({ categoria: c.v }, ["categoria"]);
                  setSeccion(null);
                }}
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
      )}

      {item.on && seccion === "color" && (
        <Field label={`Color · ${colorName}`}>
          <div className="flex flex-wrap gap-2">
            {/* EL COLOR QUE LEÍ, con su hex exacto y encendido. Va primero y
                sólo aparece cuando no coincide con ningún atajo de la paleta:
                es la respuesta a "¿por qué no hay ninguno marcado?" — sí lo
                detectó, y con más precisión que cualquiera de los 11. Sin este
                swatch, la pantalla invita a tocar el gris de en medio para
                "arreglarlo", y eso EMPEORA el dato. */}
            {hayLeido ? (
              <button
                type="button"
                aria-label={`${item.leido.color} — el que leí`}
                title={`${item.leido.color} — el que leí`}
                onClick={() => {
                  onPatch({ color: item.leido.color, color_hex: item.leido.hex }, ["color"]);
                  setSeccion(null);
                }}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${
                  mismoHex(a.color_hex, item.leido.hex)
                    ? "scale-110 border-accent"
                    : "border-line"
                }`}
                style={{ backgroundColor: item.leido.hex }}
              />
            ) : null}
            {mostrar.map((pOp) => (
              <button
                key={pOp.hex}
                type="button"
                onClick={() => {
                  onPatch({ color: pOp.name, color_hex: pOp.hex }, ["color"]);
                  setSeccion(null);
                }}
                aria-label={pOp.name}
                title={pOp.name}
                className={`h-7 w-7 rounded-full border-2 transition-transform ${
                  mismoHex(a.color_hex, pOp.hex) ? "scale-110 border-accent" : "border-line"
                }`}
                style={{ backgroundColor: pOp.hex }}
              />
            ))}
            {/* La puerta. Sin esto, una lectura MUY equivocada sería
                incorregible — ver el comentario de `cercanos`. Abre más
                swatches SIN cerrar la sección: quien la pidió sigue buscando. */}
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
      )}

      {item.on && seccion === "formalidad" && (
        <Field label="Formalidad">
          <div className="flex flex-wrap gap-1.5">
            {FORMALIDADES.map((f) => (
              <button
                key={f.v}
                type="button"
                onClick={() => {
                  onPatch({ formalidad: f.v }, ["formalidad"]);
                  setSeccion(null);
                }}
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
      )}

      {item.on && seccion === "mas" && (
        <>
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
              de catalogar que este producto existe para no tener. Pero "+ más"
              está cerrado por defecto: quien lo abrió ya decidió afinar esa
              prenda, y negárselas ahí sería mandarlo a la ficha a repetir un
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

          <button
            type="button"
            onClick={() => setSeccion(null)}
            className="min-h-9 rounded-sm border border-line bg-surface text-[12.5px] font-medium text-ink transition-colors hover:border-accent"
          >
            listo
          </button>
        </>
      )}
    </div>
  );
}

