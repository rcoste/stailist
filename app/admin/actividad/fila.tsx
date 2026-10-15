import { etiqueta, nivelDe, type Momento, type Nivel } from "@/lib/admin/actividad";
import { horaEnZona } from "@/lib/admin/adquisicion";
import { Chip, Quien, Renglon } from "../_ui";

// UNA LÍNEA DEL FEED DE ACTIVIDAD y la leyenda de sus niveles. Viven aparte de
// page.tsx para poder pintarlas solas (una página de prueba en local, sin la
// base): el admin no se puede ver en local sin dar is_admin.

// Los cuatro niveles (lib/admin/actividad.ts nivelDe), con tokens del DS: el
// fondo suave y la raya marcan lo que buscamos; el rojo, lo que falló.
const TEXTO_NIVEL: Record<Nivel, string> = {
  oro: "font-bold text-ink",
  valor: "font-semibold text-ink",
  rutina: "text-faint",
  falla: "font-semibold text-error",
};

const LEYENDA: { nivel: Nivel; titulo: string; que: string }[] = [
  { nivel: "oro", titulo: "Lo que buscamos", que: "se puso un look, votó 👍 o 👎, guardó un look, instaló la app" },
  { nivel: "valor", titulo: "Usó el producto", que: "primer look, looks, viajes, cápsula, probador, avatar" },
  { nivel: "rutina", titulo: "Rutina", que: "abrió la app, añadió o borró prendas, pasos del onboarding" },
  { nivel: "falla", titulo: "Algo falló", que: "el look o el avatar no salió: se topó con un error" },
];

export function Leyenda() {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
      {LEYENDA.map((l) => (
        <div
          key={l.nivel}
          className={`relative overflow-hidden rounded-lg border border-line px-3 py-2.5 text-xs leading-[17px] text-muted ${
            l.nivel === "oro" ? "bg-accent-soft" : "bg-surface"
          }`}
        >
          <Raya nivel={l.nivel} />
          <b className={`block text-[13px] ${TEXTO_NIVEL[l.nivel]}`}>{l.titulo}</b>
          {l.que}
        </div>
      ))}
    </div>
  );
}

function Raya({ nivel }: { nivel: Nivel }) {
  if (nivel !== "oro" && nivel !== "falla") return null;
  return <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${nivel === "oro" ? "bg-ink" : "bg-error"}`} />;
}

const APARATO_CORTO: Record<string, string> = { celular: "celular", computadora: "compu", tablet: "tablet" };

export function Fila({
  m,
  email,
  pais,
  aparato,
  origen,
  vuelta,
}: {
  m: Momento;
  email: string;
  pais: string | null;
  /** celular / computadora / tablet; null si nunca se guardó. */
  aparato: string | null;
  /** Sólo en la línea del alta: de dónde llegó. */
  origen: string | null;
  /** Días desde el alta si este es el primer momento de un día de regreso. */
  vuelta: number | null;
}) {
  const detalle = origen ?? extra(m);
  const nivel = nivelDe(m);
  return (
    // En el celular la fila se parte en dos: arriba quién (hora, correo,
    // aparato, chips), abajo lo que hizo a todo lo ancho. En una sola línea el
    // texto quedaba en una columnita, palabra por palabra, y "onboarding" se
    // salía del panel empujando la página entera a la derecha (Roberto, 10-15).
    <Renglon className={`relative flex-wrap gap-y-1 ${nivel === "oro" ? "bg-accent-soft" : ""}`}>
      <Raya nivel={nivel} />
      <span className="w-12 shrink-0 text-xs tabular-nums text-faint">{horaEnZona(m.at)}</span>
      {/* Quien ya trae su tope de ancho (55%) y trunca adentro; envolverlo en
          otro flex lo colapsaba a tres letras. */}
      <Quien correo={email} pais={pais} href={`/admin/usuarios/${m.userId}`} />
      {aparato ? <Chip>{APARATO_CORTO[aparato] ?? aparato}</Chip> : null}
      {vuelta != null ? <Chip tono="success">volvió · {vuelta === 1 ? "al día siguiente" : `a los ${vuelta} días`}</Chip> : null}
      <span className={`min-w-0 flex-1 text-sm max-sm:basis-full max-sm:pl-14 ${TEXTO_NIVEL[nivel]}`}>
        {etiqueta(m)}
        {detalle ? <span className="font-normal text-faint"> · {detalle}</span> : null}
      </span>
    </Renglon>
  );
}

// El dato suelto que hace útil la línea: los segundos del TTV, el paso del
// onboarding. Sin esto, "llegó a su primer look" no dice si tardó 40s u 11 min,
// que es el criterio de éxito #1 del proyecto.
function extra(m: Momento): string | null {
  const d = m.data as { seconds?: number; step?: number; reason?: unknown; message?: unknown } | null;
  if (!d) return null;
  // El porqué del 👎, si lo dejó (lib/outfit-actions.ts saveDownReason).
  if (m.tipo === "ev:vote_down" && typeof d.reason === "string" && d.reason.trim()) return `"${d.reason.trim()}"`;
  if (m.tipo === "ev:generation_failed" && typeof d.message === "string") {
    return d.message === "TOO_FEW_OUTFITS" ? "muy pocas prendas para armar los looks" : d.message.slice(0, 80);
  }
  if (m.tipo === "ev:first_outfit_ttv" && typeof d.seconds === "number") {
    const s = Math.round(d.seconds);
    return s < 120 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  }
  if (m.tipo === "ev:onboarding_step" && typeof d.step === "number") return `paso ${d.step}`;
  return null;
}

