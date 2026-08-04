import Image from "next/image";
import datos from "@/lib/engine/barrido/revision.json";

// Los looks del barrido, para juzgarlos a ojo.
//
// PARA QUÉ
// El barrido produce porcentajes ("15% fuera de la paleta del estilo") y esos
// números no se pueden accionar hasta saber cuántos son fallo REAL del motor y
// cuántos son el revisor automático siendo más literal que la receta. Eso no lo
// decide otra IA —sería calificar su propia tarea—: lo decide alguien mirando.
//
// LA PANTALLA TIENE QUE EXPLICARSE SOLA
// La primera versión listaba "preppy-puro · hostil · frio · invierno" y etiquetas
// sueltas como "silueta" o "veto de la receta". Para quien no construyó el
// barrido eso no dice nada — y quien revisa no tiene por qué cargar el contexto
// de quien lo armó. Ahora cada dato va con su etiqueta en palabras y hay una
// leyenda de qué significa cada marca.
//
// Cada look va en DOS vistas porque contestan preguntas distintas: las fotos de
// catálogo dejan ver el color y la formalidad pieza por pieza, y el render con
// el look puesto deja ver la proporción y si el conjunto se lee como outfit —
// que es justo lo que ni las reglas ni el revisor miden.
export const dynamic = "force-dynamic";

type Look = {
  n: number;
  titulo: string;
  ctx: { perfil: string; closet: string; clima: string; ocasion: string; paleta: string };
  prendas: { nombre: string; foto: string | null }[];
  fallos: string[];
  diagnostico: string;
  vetos: string[];
  tryon?: string;
};

const looks = datos.looks as Look[];

// Del id interno a algo que se entienda sin haber escrito el script.
const PERFIL: Record<string, string> = {
  "preppy-puro": "le gusta el preppy",
  minimalista: "le gusta lo minimalista",
  street: "le gusta el street",
  deportivo: "le gusta lo deportivo",
  "clasico-arreglado": "le gusta lo clásico arreglado",
  caotico: "le gusta de todo un poco",
};
const CLOSET: Record<string, string> = {
  basicos: "clóset básico (18 prendas)",
  completo: "clóset completo (45 prendas)",
  hostil: "clóset pobre a propósito",
};
const CLIMA: Record<string, string> = { frio: "8°C", templado: "22°C", calor: "30°C" };

// Qué quiere decir cada marca. Sin esto, "veto de la receta" no significa nada.
const QUE_SIGNIFICA: Record<string, string> = {
  silueta: "la proporción no es la de ese estilo",
  "paleta del estilo": "usa colores que ese estilo no usa",
  clima: "no va con la temperatura del día",
  ocasión: "demasiado casual (o formal) para la ocasión",
  "color cerca de la cara": "el color de arriba no le favorece",
  "veto de la receta": "hace algo que la receta prohíbe explícitamente",
};
const explicar = (f: string) =>
  QUE_SIGNIFICA[f] ?? (f.startsWith("regla:") ? "lo detectó una regla del código" : "");

export default function AdminBarrido() {
  const marcados = looks.filter((l) => l.fallos.length);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <h1 className="text-lg font-semibold text-ink">Cómo leer esto</h1>
        <p className="text-sm leading-relaxed text-muted">
          Simulé <span className="text-ink">50 usuarios falsos</span>, cada uno con
          gustos, clóset, clima y ocasión distintos. El motor les armó looks de
          verdad. Después una <span className="text-ink">segunda IA revisó cada look</span>{" "}
          y marcó lo que le pareció mal.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          Lo que necesito de ti es una sola cosa:{" "}
          <span className="text-ink">
            cuando algo esté marcado en rojo, ¿esa IA acertó o exageró?
          </span>{" "}
          Yo no puedo saberlo solo, y otra IA tampoco — sería calificar su propia
          tarea. Dime los números y tu veredicto.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          Ojo con los de <span className="text-ink">clóset pobre a propósito</span>: ahí
          el motor no tenía con qué, así que casi siempre la marca es correcta y no
          cuenta como falla suya. Los que valen son los de clóset básico y completo.
        </p>
        <div className="flex flex-col gap-1 border-t border-line pt-3">
          {Object.entries(QUE_SIGNIFICA).map(([k, v]) => (
            <p key={k} className="text-xs text-muted">
              <span className="font-semibold text-error">{k}</span> — {v}
            </p>
          ))}
        </div>
        <p className="text-xs text-muted">
          {looks.length} looks · {marcados.length} con algo marcado · los marcados van
          primero.
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
          </div>

          {/* El contexto, en palabras: quién es, qué tiene y para qué es el look. */}
          <div className="flex flex-wrap gap-1.5">
            {[
              PERFIL[l.ctx.perfil] ?? l.ctx.perfil,
              CLOSET[l.ctx.closet] ?? l.ctx.closet,
              CLIMA[l.ctx.clima] ?? l.ctx.clima,
              `para: ${l.ctx.ocasion}`,
              `colorimetría ${l.ctx.paleta}`,
            ].map((t) => (
              <span
                key={t}
                className="rounded-full bg-bg px-2.5 py-1 text-[11px] font-medium text-muted"
              >
                {t}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-start gap-3">
            {l.tryon ? (
              <figure className="flex w-40 shrink-0 flex-col gap-1">
                <div className="overflow-hidden rounded-lg border border-line bg-bg">
                  <Image
                    src={l.tryon}
                    alt={l.titulo}
                    width={160}
                    height={213}
                    className="h-full w-full object-cover"
                  />
                </div>
                <figcaption className="text-[10px] text-muted">así queda puesto</figcaption>
              </figure>
            ) : null}
            <div className="flex flex-1 flex-wrap gap-2">
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
          </div>

          {l.fallos.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Lo que marcó la IA revisora
              </p>
              <div className="flex flex-col gap-1">
                {l.fallos.map((f) => (
                  <p key={f} className="text-sm">
                    <span className="font-semibold text-error">{f}</span>
                    {explicar(f) ? (
                      <span className="text-muted"> — {explicar(f)}</span>
                    ) : null}
                  </p>
                ))}
              </div>
              {l.diagnostico ? (
                <p className="text-sm text-muted">
                  <span className="text-ink">Su resumen:</span> “{l.diagnostico}”
                </p>
              ) : null}
              {l.vetos.map((v) => (
                <p key={v} className="text-xs text-muted">
                  · la receta de su estilo dice: “{v}”
                </p>
              ))}
            </div>
          ) : (
            <p className="border-t border-line pt-3 text-sm text-success">
              Limpio — no marcó nada
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
