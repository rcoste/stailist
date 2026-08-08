// LAS SILUETAS DEL CORTE — para que la pregunta se pueda contestar.
//
// Idea de Roberto, y es la observación correcta: "poner referencias visuales
// para que sea un poquito más claro para las personas saber dónde cae". El
// problema de "¿entallado, recto u holgado?" nunca fue cuántas opciones hay —
// es que las tres palabras no significan nada sin ver a qué se refieren. Una
// persona que no piensa en ropa técnicamente no sabe si sus jeans son "rectos".
//
// SON DIBUJOS, NO FOTOS, y a propósito: una foto de unos jeans concretos
// sugeriría que la respuesta correcta es "los que se parecen a ésos", cuando lo
// que se pregunta es la silueta. Un contorno abstracto se compara con cualquier
// prenda.
//
// SE DIBUJAN COMO UN CONTORNO CERRADO, no como líneas sueltas. La primera
// versión trazaba cada pieza por separado y salían diagonales cruzándose por
// dentro: las tres opciones se veían casi iguales, que es exactamente el
// problema que venían a resolver. Un contorno único no puede cruzarse consigo
// mismo.
//
// MONOCROMAS Y CON currentColor: heredan el color del botón, así que la opción
// elegida se invierte junto con él sin una línea de CSS extra.

type Corte = "entallado" | "recto" | "holgado";
type Props = { corte: Corte; tipo: "bottom" | "top" };

/**
 * Cuánto se ensancha (o estrecha) el bajo respecto a la cadera / al torso.
 *
 * Negativo = se cierra hacia abajo. Los saltos son grandes a propósito: si la
 * diferencia entre "recto" y "holgado" fuera de dos píxeles, la persona tendría
 * que comparar con lupa y volveríamos a decidir por la palabra.
 */
const ABRE_PIERNA: Record<Corte, number> = { entallado: -3, recto: 1, holgado: 7 };
const ABRE_TORSO: Record<Corte, number> = { entallado: -2, recto: 1, holgado: 6 };

export function SiluetaCorte({ corte, tipo }: Props) {
  if (tipo === "bottom") {
    const d = ABRE_PIERNA[corte];
    // Cintura y cadera FIJAS; solo se mueve el bajo. Mover la cadera dibujaría
    // otro cuerpo en vez de otro pantalón.
    const bajoIzqExt = 11 - d;
    const bajoIzqInt = 19 - d / 2;
    const bajoDerInt = 21 + d / 2;
    const bajoDerExt = 29 + d;
    return (
      <svg viewBox="0 0 40 56" className="h-14 w-10" aria-hidden="true">
        <path
          d={`M11 5 H29 L${bajoDerExt} 51 H${bajoDerInt} L20 26 L${bajoIzqInt} 51 H${bajoIzqExt} Z`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const d = ABRE_TORSO[corte];
  // Hombros y mangas FIJOS: son lo que hace la silueta reconocible como prenda
  // de arriba. Lo único que cambia es cuánto se abre el cuerpo hacia el bajo.
  const bajoIzq = 12 - d;
  const bajoDer = 28 + d;
  return (
    <svg viewBox="0 0 40 56" className="h-14 w-10" aria-hidden="true">
      <path
        d={
          `M16 6 L11 8 L6 13 L9 21 L12 18 ` + // hombro y manga izquierda
          `L${bajoIzq} 45 H${bajoDer} ` + //     cuerpo, abriéndose
          `L28 18 L31 21 L34 13 L29 8 L24 6 ` + // manga y hombro derechos
          `Q20 10 16 6 Z` //                     cuello
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
