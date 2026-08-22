"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import type { CajaCruce, LookCruzado, ResumenCruce } from "@/lib/comparador/cruce";
import type { PrendaUI } from "@/lib/comparador/motor-servidor";
import { formalidadLegible } from "@/lib/formalidad";
import { hayLluvia } from "@/lib/weather";
import { calificarJuez } from "../../../motor-actions";

// CALIFICAR AL JUEZ, look por look, con el look a la vista.
//
// La diferencia con la pantalla de votar: ahí juzgas el OUTFIT, aquí juzgas el
// HALLAZGO. Roberto: "estoy viendo que muchos sí le pegó el juez, pero me
// gustaría poner yo ahí comentarios para que sea más fácil que lo proceses".
//
// Se guarda al tocar, sin botón de guardar: la sesión son ~20 tarjetas y un
// "guardar" al final es exactamente donde se pierde el trabajo (ya pasó en la
// ficha de prenda, ver TODOS.md). La nota se manda al salir del campo.

function Chip({ children, tono = "gris" }: { children: React.ReactNode; tono?: "gris" | "rojo" | "ink" }) {
  const clases =
    tono === "rojo"
      ? "border-error text-error"
      : tono === "ink"
        ? "border-ink text-ink"
        : "border-line text-muted";
  return (
    <span className={`shrink-0 rounded-sm border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${clases}`}>
      {children}
    </span>
  );
}

/** La llave de una tarjeta, para contar y para saltar a ella. */
const llaveDe = (l: LookCruzado) => `${l.parId}-${l.variante}-${l.indice}`;

function Tarjeta({
  look,
  prendas,
  etiqueta,
  gender,
  onCalificado,
}: {
  look: LookCruzado;
  prendas: Record<string, PrendaUI>;
  etiqueta: string;
  /** El ancla concreta de la formalidad es por género (ver lib/formalidad). */
  gender: "hombre" | "mujer" | null;
  /** Avisa al contenedor para que el avance y el "siguiente" se muevan sin recargar. */
  onCalificado: (llave: string, v: "acuerdo" | "exagero" | null) => void;
}) {
  const [v, setV] = useState(look.veredicto?.v ?? null);
  const [nota, setNota] = useState(look.veredicto?.nota ?? "");
  const [guardando, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const guardar = (
    siguienteV: "acuerdo" | "exagero" | null,
    siguienteNota: string
  ) =>
    empezar(async () => {
      const r = await calificarJuez(
        look.parId,
        look.variante,
        look.indice,
        siguienteV,
        siguienteNota
      );
      setError(r.ok ? null : (r.error ?? "no se guardó"));
    });

  const tocar = (opcion: "acuerdo" | "exagero") => {
    const siguiente = v === opcion ? null : opcion;
    setV(siguiente);
    onCalificado(llaveDe(look), siguiente);
    guardar(siguiente, nota);
  };
  const pendiente = look.juez.hallazgos.length > 0 && !v;

  return (
    <article
      id={llaveDe(look)}
      className={`flex scroll-mt-24 flex-col gap-2 rounded-lg border bg-surface p-3 ${
        pendiente ? "border-ink" : "border-line"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold leading-tight text-ink">{look.nombre}</h3>
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">
          par {look.parN} · {etiqueta}
        </span>
      </div>

      {/* PARA QUÉ SE PIDIÓ ESTE LOOK. Sin esto no se puede calificar un
          hallazgo: "rompe el clima" es justo con 8°C y lluvia e injusto con
          24°C despejado. Va en cada tarjeta y no en un encabezado porque el
          cruce agrupa por caja, no por par — dos tarjetas vecinas pueden venir
          de briefs opuestos. Roberto: "no quitaste esa información, entonces me
          es complicado el evaluar sin ese contexto completo". */}
      <div className="flex flex-col gap-0.5 rounded-sm bg-tile px-2 py-1.5">
        <p className="text-[11px] font-semibold leading-tight text-ink">
          {look.brief.etiqueta}
          {/* LOS GRADOS, no sólo la banda. Roberto, calificando un hallazgo de
              clima: "cuando dices 'frío' es ambiguo — pon grados, porque no sé
              si me estás diciendo este look para los 8°". Los jueces siempre
              recibieron la temperatura exacta; el que veía "frío" a secas era
              él — así que calificaba con menos contexto que el juez al que
              calificaba. */}
          {look.brief.weather ? (
            <span className="font-normal text-muted">
              {" · "}
              {Math.round(look.brief.weather.temp_c)}°C
              {hayLluvia(look.brief.weather.condition) ? " · con lluvia" : ""}
            </span>
          ) : null}
          {formalidadLegible(look.brief.formality ?? null, gender) ? (
            <span className="font-normal text-muted">
              {" · "}
              {formalidadLegible(look.brief.formality ?? null, gender)}
            </span>
          ) : null}
        </p>
        {look.brief.plan ? (
          <p className="text-[11px] leading-tight text-muted">
            Pidió: “{look.brief.plan}”
          </p>
        ) : null}
        {look.brief.paraguas ? (
          <p className="text-[11px] leading-tight text-muted">lleva paraguas</p>
        ) : null}
      </div>

      {/* Las prendas EN GRANDE y con su nombre al pasar el mouse. A 56px no se
          distinguía un mocasín de un botín, que es justo lo que hay que ver
          para calificar un hallazgo sobre el calzado. Y el nombre iba en el
          `title` del navegador: tarda ~1s en salir y la mitad de las veces no
          aparece — o sea, el dato existía y no se leía. */}
      {/* El nombre va DEBAJO, siempre visible. Iba en un overlay al pasar el
          mouse — y en el celular no hay mouse: Roberto calificaba "el cinturón
          choca" sin poder leer qué cinturón era. */}
      <div className="flex flex-wrap gap-2">
        {look.itemIds.map((id) => {
          const p = prendas[id];
          return (
            <span key={id} className="flex w-20 flex-col items-center gap-0.5">
              <span className="relative block h-20 w-20 overflow-hidden rounded-sm border border-line bg-tile">
                {p?.imagen ? (
                  <Image src={p.imagen} alt={p.nombre} fill sizes="80px" className="object-cover" />
                ) : (
                  <span className="absolute inset-0" style={{ backgroundColor: p?.swatch }} aria-hidden />
                )}
              </span>
              <span className="line-clamp-2 text-center text-[10px] leading-tight text-muted">
                {p?.nombre ?? "sin nombre"}
              </span>
            </span>
          );
        })}
      </div>

      {/* Las dos lecturas, sin promediar: si discrepan, esa discrepancia ES el
          dato. Promediarlas sería justo lo que esconde el hallazgo. */}
      <div className="flex flex-col gap-2 text-xs sm:flex-row sm:gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1 border-b border-line pb-2 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
          <span className="text-[10px] uppercase tracking-wide text-muted">
            tú {look.humano.marca === "abajo" ? "👎" : look.humano.marca === "arriba" ? "👍" : ""}
          </span>
          {look.humano.defectos.length ? (
            <span className="flex flex-wrap gap-1">
              {look.humano.defectos.map((d) => (
                <Chip key={d} tono="ink">{d}</Chip>
              ))}
            </span>
          ) : null}
          {look.humano.comentario ? (
            <p className="text-ink">“{look.humano.comentario}”</p>
          ) : !look.humano.defectos.length ? (
            <p className="italic text-muted">sin peros</p>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted">el juez</span>
          {look.juez.hallazgos.length ? (
            <>
              <span className="flex flex-wrap gap-1">
                {look.juez.defectos.map((d) => (
                  <Chip key={d} tono={look.juez.rompe > 0 ? "rojo" : "gris"}>{d}</Chip>
                ))}
              </span>
              {/* EL ARREGLO QUE PROPONE, no sólo la crítica. Roberto,
                  calificando: "yo le preguntaría al juez: ¿cómo lo mejor
                  harías tú? No nada más criticar". El dato SIEMPRE estuvo en
                  el hallazgo; esta pantalla no lo pintaba — así que el juez
                  parecía un crítico y era un stylist con propuesta. */}
              {look.juez.hallazgos.slice(0, 2).map((h, i) => (
                <div key={i} className="flex flex-col">
                  <p className="text-ink">
                    <span className="font-medium">{h.pieza}:</span> {h.problema}
                  </p>
                  {h.arreglo ? (
                    <p className="text-muted">→ {h.arreglo}</p>
                  ) : null}
                </div>
              ))}
            </>
          ) : (
            <p className="italic text-muted">no marcó nada</p>
          )}
        </div>
      </div>

      {/* El control sólo aparece si hay hallazgo que calificar: sin él no hay
          juez que medir, y un control muerto invita a llenarlo por llenar. */}
      {look.juez.hallazgos.length ? (
        <div className="flex flex-col gap-1.5 border-t border-line pt-2">
          <p className="text-[10px] uppercase tracking-wide text-muted">
            ¿el juez tiene razón?
            {guardando ? <span className="normal-case"> · guardando…</span> : null}
            {error ? <span className="normal-case text-error"> · {error}</span> : null}
          </p>
          {/* Dos botones a todo lo ancho, al tamaño de un dedo: es la acción
              que se repite ~20 veces por ronda, y estaba en dos chips de 10px. */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => tocar("acuerdo")}
              className={`rounded-lg border py-2.5 text-sm font-semibold transition-colors ${
                v === "acuerdo" ? "border-ink bg-ink text-bg" : "border-line text-ink active:bg-tile"
              }`}
            >
              tiene razón
            </button>
            <button
              type="button"
              onClick={() => tocar("exagero")}
              className={`rounded-lg border py-2.5 text-sm font-semibold transition-colors ${
                v === "exagero" ? "border-error bg-error text-on-accent" : "border-line text-ink active:bg-tile"
              }`}
            >
              se pasó
            </button>
          </div>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onBlur={() => {
              if ((look.veredicto?.nota ?? "") !== nota.trim()) guardar(v, nota);
            }}
            rows={2}
            placeholder="por qué (opcional) — esto es lo que leo yo"
            className="w-full resize-y rounded-sm border border-line bg-bg px-2 py-1 text-xs text-ink placeholder:text-faint focus:border-ink focus:outline-none"
          />
        </div>
      ) : null}
    </article>
  );
}

const CAJAS: { clave: CajaCruce; titulo: string; sub: string }[] = [
  {
    clave: "soloJuez",
    titulo: "Sólo el juez lo vio",
    sub: "Los aprobaste sin peros. Aquí se decide si el juez es útil o pedante — y eso sólo lo dices tú. Es la caja que hay que calificar.",
  },
  {
    clave: "coinciden",
    titulo: "Coincidieron",
    sub: "Los dos marcaron el mismo look. Es donde el juez ya está haciendo tu trabajo.",
  },
  {
    clave: "soloHumano",
    titulo: "Sólo tú lo viste",
    sub: "El punto ciego del juez: lo marcaste y él no dijo nada. Si esta caja se queda en cero varias rondas, el juez se ganó correr sin ti.",
  },
  { clave: "limpios", titulo: "Los dos limpios", sub: "Ni tú ni el juez tuvieron nada que decir." },
];

export function CruceClient({
  resumen,
  prendas,
  etiquetas,
  gender,
}: {
  resumen: ResumenCruce;
  prendas: Record<string, PrendaUI>;
  etiquetas: Record<string, string>;
  gender: "hombre" | "mujer" | null;
}) {
  const { conteo } = resumen;

  // EL AVANCE SE MUEVE SIN RECARGAR, y la cola se recorre con un botón. Cada
  // tarjeta guarda al tocar; el contenedor sólo lleva la cuenta de cuáles ya
  // tienen veredicto para decir "llevas X de N" y saltar a la siguiente.
  const [veredictos, setVeredictos] = useState<Record<string, "acuerdo" | "exagero" | null>>(
    () => Object.fromEntries(resumen.looks.map((l) => [llaveDe(l), l.veredicto?.v ?? null]))
  );
  const conJuez = useMemo(() => resumen.looks.filter((l) => l.juez.hallazgos.length > 0), [resumen]);
  const calificados = conJuez.filter((l) => veredictos[llaveDe(l)]).length;
  const acuerdo = conJuez.filter((l) => veredictos[llaveDe(l)] === "acuerdo").length;
  const exagero = conJuez.filter((l) => veredictos[llaveDe(l)] === "exagero").length;
  // Pendientes PRIMERO dentro de cada caja: lo que falta arriba, lo hecho abajo.
  const orden = (l: LookCruzado) => (l.juez.hallazgos.length && !veredictos[llaveDe(l)] ? 0 : 1);
  const siguiente = () => {
    const pend = conJuez.find((l) => !veredictos[llaveDe(l)]);
    if (pend) document.getElementById(llaveDe(pend))?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const onCalificado = (llave: string, v: "acuerdo" | "exagero" | null) =>
    setVeredictos((prev) => ({ ...prev, [llave]: v }));

  return (
    <div className="flex flex-col gap-8">
      {/* La barra de avance, fija arriba: dice cuánto falta y lleva a lo que falta. */}
      <div className="sticky top-0 z-30 -mx-4 flex items-center justify-between gap-3 border-b border-line bg-bg px-4 py-2 text-xs">
        <span className="text-ink">
          <b className="tabular-nums">{calificados}</b> de {conJuez.length} calificados
          <span className="text-muted"> · razón {acuerdo} · se pasó {exagero}</span>
        </span>
        {calificados < conJuez.length ? (
          <button
            type="button"
            onClick={siguiente}
            className="shrink-0 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-bg active:opacity-80"
          >
            siguiente sin calificar →
          </button>
        ) : (
          <span className="shrink-0 font-semibold text-ink">✓ listo</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CAJAS.map((c) => (
          <a
            key={c.clave}
            href={`#${c.clave}`}
            className="flex flex-col rounded-lg border border-line bg-surface px-3 py-2"
          >
            <span className="text-h2 font-semibold tabular-nums text-ink">{conteo[c.clave]}</span>
            <span className="text-[11px] leading-tight text-muted">{c.titulo}</span>
          </a>
        ))}
      </div>

      {CAJAS.map((c) => {
        const looks = resumen.looks
          .filter((l) => l.caja === c.clave)
          .slice()
          .sort((a, b) => orden(a) - orden(b));
        return (
          <section key={c.clave} id={c.clave} className="flex flex-col gap-3 scroll-mt-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-semibold text-ink">
                {c.titulo} <span className="font-normal text-muted">{looks.length}</span>
              </h2>
              <p className="max-w-[70ch] text-xs text-muted">{c.sub}</p>
            </div>
            {looks.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {looks.map((l) => (
                  <Tarjeta
                    key={`${l.parId}-${l.variante}-${l.indice}`}
                    look={l}
                    prendas={prendas}
                    etiqueta={etiquetas[l.variante] ?? l.variante}
                    gender={gender}
                    onCalificado={onCalificado}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-line bg-surface px-3 py-2 text-xs italic text-muted">
                ninguno.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
