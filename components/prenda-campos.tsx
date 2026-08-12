"use client";

import type { PrendaAnalisis } from "@/app/api/analizar-prenda/route";

// EL VOCABULARIO DE EDITAR UNA PRENDA — las piezas, no la pantalla.
//
// Sale de components/prenda-draft-card, donde nació para el carrete y el fit
// check. Se extrae porque la ficha del clóset necesita el MISMO lenguaje —
// chips que dicen el valor y abren sólo su editor— pero NO puede reusar
// aquella tarjeta: sus ciclos de vida son opuestos.
//
// DraftCard es un control puro sobre una prenda que TODAVÍA NO EXISTE: cada
// cambio va por onPatch a un objeto en memoria y la escritura ocurre una sola
// vez, al final del flujo. La ficha del clóset edita una fila REAL — estado
// sucio, un guardar que puede fallar, y efectos de servidor (marcar
// confirmados, borrar la descripción que quedó obsoleta). Meter ese ciclo
// dentro de DraftCard le colgaría al carrete un "guardando" que nunca ocurre,
// en el componente por el que entra toda la ropa.
//
// Por eso se comparte esto y no la tarjeta: catálogos, controles tontos
// (valor + onChange) y el chip. Cada pantalla compone su ficha y conserva su
// ciclo de vida.

// LLEVA "SACO", y no siempre lo llevó: sin ese botón la visión sí lo detectaba
// pero la prenda salía con nada marcado y parecía no detectada. 18 prendas de
// foto de la base son categoría 'saco' y todas pasaron por aquí. Quitarlo
// reabre ese hueco.
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
// Tipado con la unión y no con `string`: la ficha del clóset pinta cada corte
// con su silueta (SiluetaCorte sólo acepta los tres), así que un valor de más
// aquí tiene que romper la compilación, no la pantalla.
export const CORTES: { v: "entallado" | "recto" | "holgado"; l: string }[] = [
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
  // METAL entra por los datos, no por intuición: son 15 prendas de la base —
  // cinturones, relojes, joyería— y era el único hueco grande de la lista. Con
  // él, los chips cubren 571 de las 616 prendas que traen material (93%); el
  // resto son colas de una y dos (satén, gamuza, terciopelo) que `conLeido`
  // conserva sin necesidad de un chip propio.
  { v: "metal", l: "metal" },
];
// ESPEJA `PATRONES` de lib/prenda-atributos, que se declara a sí mismo la única
// fuente de verdad de este vocabulario: de ahí derivan los schemas de visión y
// la validación server-side. Aquí sólo se le ponen etiquetas legibles. Un
// patrón que exista en uno y no en el otro se pierde en silencio —o no se puede
// elegir, o no pasa la validación—, así que se tocan los dos o ninguno.
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
 *
 * SÓLO PARA MATERIAL, que es texto libre de verdad. En el patrón sería una
 * trampa: su vocabulario es CERRADO (`cleanPatron` valida contra PATRONES y
 * borra lo que no reconoce), así que un patrón raro se pintaría como chip
 * elegible y tocarlo —el gesto de "sí, ése es"— lo borraría. Hoy no hay ni uno
 * fuera de vocabulario en la base; el chip lo habría creado.
 */
export function conLeido(
  opciones: { v: string; l: string }[],
  leido?: string
): { v: string; l: string }[] {
  const v = (leido ?? "").trim();
  if (!v || opciones.some((o) => igualValor(v, o.v))) return opciones;
  return [{ v, l: v }, ...opciones];
}
export const FORMALIDADES: { v: PrendaAnalisis["formalidad"]; l: string }[] = [
  { v: "casual", l: "Casual" },
  { v: "formal-casual", l: "Casual-formal" },
  { v: "formal", l: "Formal" },
];
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
 * Un grupo de chips de opción única, SIN salida vacía.
 *
 * La diferencia con `Escala` no es cosmética: hay campos donde "ninguno" es una
 * respuesta legítima (el corte de unos leggings) y campos donde no existe —toda
 * prenda tiene un tipo, una formalidad y una temporada—. Ofrecer ahí un "no
 * aplica" sería invitar a borrar un dato que el motor sí usa.
 *
 * Vive aquí porque el mismo markup estaba escrito tres veces (tipo y formalidad
 * en la tarjeta del carrete, y otra vez en la ficha del clóset), que es
 * justamente la duplicación que este módulo existe para no tener.
 */
export function Chips<T extends string>({
  opciones,
  valor,
  onPick,
}: {
  opciones: { v: T; l: string }[];
  valor?: string;
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opciones.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onPick(o.v)}
          className={`min-h-8 rounded-sm border px-2.5 text-xs transition-colors ${
            igualValor(valor, o.v)
              ? "border-accent bg-accent-soft text-accent"
              : "border-line bg-surface text-muted"
          }`}
        >
          {o.l}
        </button>
      ))}
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
            igualValor(valor, o.v)
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
          !valor?.trim()
            ? "border-accent bg-accent-soft text-accent"
            : "border-line bg-surface text-muted"
        }`}
      >
        {vacio}
      </button>
    </div>
  );
}

/**
 * ¿Este chip es el valor que tiene la prenda? Sin distinguir mayúsculas ni
 * espacios, IGUAL QUE `conLeido`.
 *
 * Las dos funciones tienen que decidir lo mismo o se abre un hueco silencioso:
 * `conLeido` ve "Lana" como si estuviera en la lista y no antepone nada, y una
 * comparación estricta no resalta ningún chip — así que el campo se lee VACÍO
 * teniendo dato, y el primer tap sustituye un valor real por otro.
 *
 * Hoy no hay ni una prenda así en la base, y aun así se arregla: el campo de
 * texto libre de la ficha ("es otro material") es exactamente lo que permite
 * teclear "Lana" y crear la primera.
 */
function igualValor(a: string | undefined, b: string): boolean {
  return limpia(a ?? "") === limpia(b);
}
/** Minúsculas, sin espacios de sobra y SIN ACENTOS. Lo último porque la visión
 *  escribe en español y a veces se come una tilde: sin esto, "algodon" y
 *  "algodón" son dos chips gemelos y dos materiales distintos para el motor,
 *  que agrupa por texto. */
const limpia = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

export type Seccion = "tipo" | "color" | "formalidad" | "mas";
export const SECCION_DE_CAMPO: Record<string, Seccion> = {
  categoria: "tipo",
  color: "color",
  formalidad: "formalidad",
  corte: "mas",
  largo: "mas",
  material: "mas",
  patron: "mas",
};

/** Un chip del resumen: enseña el valor actual y abre su editor al tocarlo.
 *  `alerta` = el modelo marcó ese campo como inseguro (borde warning: es la
 *  invitación a revisar justo ése, sin abrir nada más). */
export function ChipResumen({
  activo,
  alerta,
  dashed,
  onClick,
  children,
}: {
  activo: boolean;
  alerta?: boolean;
  dashed?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={activo}
      className={`inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 text-[11.5px] font-medium transition-colors ${
        dashed ? "border-dashed" : ""
      } ${
        activo
          ? "border-accent bg-accent-soft text-accent"
          : alerta
            ? "border-warning/70 bg-surface text-ink"
            : "border-line bg-surface text-ink"
      }`}
    >
      {children}
    </button>
  );
}
