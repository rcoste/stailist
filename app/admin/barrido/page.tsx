import Image from "next/image";
import datos from "@/lib/engine/barrido/revision.json";

// Los looks del barrido, para juzgarlos a ojo.
//
// PARA QUÉ
// El barrido produce porcentajes ("15% fuera de la paleta del estilo") y esos
// números no se pueden accionar hasta saber cuántos son fallo REAL del motor y
// cuántos son el juez siendo más literal que la receta. Eso no lo decide otra
// IA: lo decide alguien mirando la ropa.
//
// No se generan imágenes de los looks —serían ~130 renders— porque cada prenda
// del catálogo YA tiene su foto. Ver las piezas juntas alcanza de sobra para
// decir "el juez tiene razón" o "el juez se pasó", que es la única pregunta de
// esta pantalla.
//
// Los marcados van primero: la atención de quien revisa es el recurso caro.
export const dynamic = "force-dynamic";

const looks = datos.looks as {
  n: number;
  titulo: string;
  contexto: string;
  prendas: { nombre: string; foto: string | null }[];
  fallos: string[];
  diagnostico: string;
  vetos: string[];
}[];

export default function AdminBarrido() {
  const marcados = looks.filter((l) => l.fallos.length);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted">
          {looks.length} looks del barrido · {marcados.length} con algo marcado.
          Cada uno lo armó el motor de verdad con un clóset sorteado del catálogo.
        </p>
        <p className="text-sm text-muted">
          La pregunta de esta pantalla: cuando algo está marcado en rojo,{" "}
          <span className="text-ink">¿el juez tiene razón o se pasó?</span>
        </p>
      </div>

      {looks.map((l) => (
        <section
          key={l.n}
          className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-xs font-bold tabular-nums text-muted">#{l.n}</span>
            <h2 className="text-base font-semibold text-ink">{l.titulo}</h2>
            <span className="text-xs text-muted">{l.contexto}</span>
          </div>

          {/* Las prendas, con su foto del catálogo. */}
          <div className="flex flex-wrap gap-2">
            {l.prendas.map((p, i) => (
              <figure key={`${p.nombre}-${i}`} className="flex w-24 flex-col gap-1">
                <div className="aspect-square overflow-hidden rounded-lg border border-line bg-bg">
                  {p.foto ? (
                    <Image
                      src={p.foto}
                      alt={p.nombre}
                      width={96}
                      height={96}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-muted">
                      sin foto
                    </span>
                  )}
                </div>
                <figcaption className="text-[10px] leading-tight text-muted">
                  {p.nombre}
                </figcaption>
              </figure>
            ))}
          </div>

          {l.fallos.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-1.5">
                {l.fallos.map((f) => (
                  <span
                    key={f}
                    className="rounded-full border border-error/40 px-2 py-0.5 text-[11px] font-medium text-error"
                  >
                    {f}
                  </span>
                ))}
              </div>
              {l.diagnostico ? (
                <p className="text-sm text-muted">
                  <span className="text-ink">El juez dice:</span> {l.diagnostico}
                </p>
              ) : null}
              {l.vetos.map((v) => (
                <p key={v} className="text-xs text-muted">
                  · rompe de la receta: “{v}”
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-success">Limpio</p>
          )}
        </section>
      ))}
    </div>
  );
}
