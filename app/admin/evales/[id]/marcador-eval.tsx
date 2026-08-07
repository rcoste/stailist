"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatoUsd } from "@/lib/proveedores/precios";
import { formalidadLegible } from "@/lib/formalidad";
import type {
  AcuerdoCalibracion,
  EvalBriefFila,
  EvalCorrida,
  MarcadorEval,
  PromediosDim,
} from "@/lib/evales/evales";
import type { PrendaEvalUI } from "@/lib/evales/servidor";
import { guardarMarcasEval, cerrarEval } from "../actions";

// El marcador de un eval + la calibración.
//
// Se lee de arriba abajo en el orden en que importa: el nivel del motor, luego
// qué encontraron los jueces, y hasta abajo la calibración — el único bloque
// que pide trabajo humano y el que decide si los números de arriba valen algo.

const DIMS = [
  { k: "ocasion", label: "ocasión" },
  { k: "clima", label: "clima" },
  { k: "armado", label: "armado" },
  { k: "estilo", label: "estilo" },
  { k: "color", label: "color" },
  { k: "wow", label: "wow" },
] as const;

export function MarcadorEvalView({
  corrida,
  filas,
  prendas,
  m,
  acuerdo,
  gender,
}: {
  corrida: EvalCorrida;
  filas: EvalBriefFila[];
  prendas: Record<string, PrendaEvalUI>;
  m: MarcadorEval;
  acuerdo: AcuerdoCalibracion;
  gender: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href="/admin/evales" className="text-xs font-semibold text-accent">
          ← Evales
        </Link>
        <h1 className="text-xl font-semibold text-ink">
          Eval de {corrida.promptVersion}
        </h1>
        <p className="text-xs text-muted">
          {corrida.modeloGenerador} · pool {corrida.poolVersion} · rúbricas{" "}
          {corrida.rubricaVersion}/{corrida.rubricaVisionVersion} · {m.looks} looks
          {corrida.conEstilo ? "" : " · sin estilo declarado en el perfil"}
        </p>
      </header>

      {/* El nivel: las dos rúbricas lado a lado. Se muestran SEPARADAS y no
          promediadas juntas a propósito — una lee nombres y la otra ve fotos;
          cuando difieren, esa diferencia es el dato. */}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-ink">El nivel</h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="p-2 font-medium">dimensión</th>
                <th className="p-2 font-medium">texto</th>
                <th className="p-2 font-medium">visión</th>
              </tr>
            </thead>
            <tbody>
              {DIMS.map((d) => (
                <tr key={d.k} className="border-b border-line last:border-0">
                  <td className="p-2 text-muted">{d.label}</td>
                  <td className="p-2 font-semibold text-ink">
                    {fmt(m.texto[d.k as keyof PromediosDim])}
                  </td>
                  <td className="p-2 font-semibold text-ink">
                    {fmt(m.vision[d.k as keyof PromediosDim])}
                  </td>
                </tr>
              ))}
              <tr className="bg-bg">
                <td className="p-2 font-semibold text-ink">aprobado</td>
                <td className="p-2 font-semibold text-ink">
                  {pct(m.aprobadoTexto.si, m.aprobadoTexto.de)}
                </td>
                <td className="p-2 font-semibold text-ink">
                  {pct(m.aprobadoVision.si, m.aprobadoVision.de)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {!corrida.conEstilo || !corrida.conColor ? (
          <p className="text-xs text-muted">
            {[!corrida.conEstilo && "estilo", !corrida.conColor && "color"]
              .filter(Boolean)
              .join(" y ")}{" "}
            va vacío: el perfil de este clóset no traía ese dato al abrir la
            corrida, así que el juez lo deja neutro y promediarlo fingiría una
            medición.
          </p>
        ) : null}
      </section>

      {/* Las reglas de código y el juez de producción: los dos números que
          tienen que BAJAR con cada versión. */}
      <section className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3">
          <span className="text-xs text-muted">looks con violación de regla</span>
          <span className="text-lg font-semibold text-ink">
            {pct(m.violaciones.looksConViolacion, m.looks)}
          </span>
          <span className="text-xs text-muted">
            {m.violaciones.total} en total
          </span>
          {Object.entries(m.violaciones.porRegla)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([regla, n]) => (
              <span key={regla} className="text-xs text-muted">
                {regla}: {n}
              </span>
            ))}
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3">
          <span className="text-xs text-muted">el juez de producción reparó</span>
          <span className="text-lg font-semibold text-ink">
            {pct(m.reparacion.reparados, m.reparacion.candidatos)}
          </span>
          <span className="text-xs text-muted">
            {m.reparacion.rechazados} rechazados de {m.reparacion.candidatos}
          </span>
          {/* Este número es el que dice cuándo se pueden quitar las rueditas:
              un juez que ya no repara nada es peso muerto en producción. */}
          <span className="text-xs text-muted">
            cuando esto tienda a 0, el juez de producción sobra
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted">costo de la corrida</span>
          <span className="font-semibold text-ink">{formatoUsd(m.costoTotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">por generación</span>
          <span className="font-semibold text-ink">
            {m.costoGenPromedio == null ? "—" : formatoUsd(m.costoGenPromedio)} ·{" "}
            {m.msGenPromedio == null ? "—" : `${Math.round(m.msGenPromedio / 1000)}s`}
          </span>
        </div>
        {m.errores > 0 ? (
          <p className="text-xs text-error">
            {m.errores} briefs tronaron — eso también es un resultado.
          </p>
        ) : null}
      </section>

      {/* LA CALIBRACIÓN. Es el bloque que impide que todo lo de arriba se
          convierta en un número que se optimiza a sí mismo. */}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-ink">Calibración</h2>
        <p className="text-xs text-muted">
          Un juez contra el que se optimiza deja de medir. Esto lo vigila:
          marcas una muestra chica a mano y se compara contra lo que dijeron los
          jueces. Si el acuerdo cae, primero se afinan las rúbricas — los
          números de arriba no valen más que esto.
        </p>

        {acuerdo.marcados > 0 ? (
          <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">acuerdo del juez de texto</span>
              <span className="font-semibold text-ink">
                {pct(acuerdo.texto.aciertos, acuerdo.texto.de)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">acuerdo del juez visual</span>
              <span className="font-semibold text-ink">
                {pct(acuerdo.vision.aciertos, acuerdo.vision.de)}
              </span>
            </div>
            <div className="mt-1 border-t border-line pt-1 text-xs text-muted">
              de tus {acuerdo.abajos.total} 👎: código caza{" "}
              {acuerdo.abajos.cazaCodigo}, texto {acuerdo.abajos.cazaTexto},
              visión {acuerdo.abajos.cazaVision} · sobre {acuerdo.marcados} looks
              marcados
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted">
            Todavía no marcas ninguno. Con 20-30 basta para saber si las
            rúbricas siguen viendo como tú.
          </p>
        )}

        <button
          onClick={() => setAbierto((a) => !a)}
          className="rounded-xl border border-line py-3 text-sm font-semibold text-ink active:bg-tile"
        >
          {abierto ? "Cerrar" : "Calibrar a mano"}
        </button>
      </section>

      {abierto ? (
        <Calibrador filas={filas} prendas={prendas} gender={gender} />
      ) : null}

      <CerrarEval corridaId={corrida.id} estado={corrida.estado} nota={corrida.nota} />
    </div>
  );
}

function fmt(n: number | null): string {
  return n == null ? "—" : n.toFixed(2);
}

/**
 * EL CALIBRADOR: un look a la vez, con el teclado, y los jueces TAPADOS.
 *
 * POR QUÉ ASÍ (Roberto: "métele cabeza"):
 * - UN look en pantalla, grande. La versión anterior era una lista de 30 con
 *   miniaturas de 80px; calificar ropa mirando estampillas no es calificar.
 * - CON EL TECLADO. Son 30 juicios seguidos: ← 👎 · → 👍 · ↑ saltar · ⌫ deshacer.
 *   Cada tap ahorrado se multiplica por 30.
 * - LOS JUECES NO SE VEN HASTA EL FINAL. Antes se revelaban look por look, y
 *   eso contamina exactamente lo que se está midiendo: el acuerdo vale como
 *   evidencia sólo si la marca se emitió a ciegas. Es el mismo principio que el
 *   voto ciego del comparador.
 * - NADA DE router.refresh() POR MARCA. Se guarda en segundo plano y la
 *   pantalla avanza sola; recargar entre look y look hacía la tarea lenta justo
 *   en el punto donde la fatiga decide si se termina o no.
 *
 * EL REVELADO no es una calificación: es la cosecha. Lo que importa no es el
 * porcentaje sino DÓNDE difieren el humano y cada juez — de ahí salen las
 * reglas y los ajustes de rúbrica.
 */
function Calibrador({
  filas,
  prendas,
  gender,
}: {
  filas: EvalBriefFila[];
  prendas: Record<string, PrendaEvalUI>;
  gender: string | null;
}) {
  const router = useRouter();

  // La muestra se congela al montar: si se recalculara con cada marca, el look
  // que acabas de calificar saltaría de posición y perderías el hilo.
  const [casos] = useState(() =>
    filas
      .flatMap((f) =>
        (f.looks ?? []).map((look, i) => ({
          fila: f,
          look,
          i,
          nota: f.notas?.[i] ?? null,
          marcaPrevia: f.marcas?.[String(i)] ?? null,
        }))
      )
      .filter((c) => c.nota)
      .sort((a, b) => {
        // Sin marcar primero; dentro de esos, los que los jueces vieron
        // distinto — ahí es donde una marca humana informa más.
        if (!!a.marcaPrevia !== !!b.marcaPrevia) return a.marcaPrevia ? 1 : -1;
        const dis = (c: typeof a) =>
          c.nota!.texto && c.nota!.vision && c.nota!.texto.aprobado !== c.nota!.vision.aprobado
            ? 0
            : 1;
        return dis(a) - dis(b);
      })
      .slice(0, 30)
  );

  const [idx, setIdx] = useState(0);
  const [marcas, setMarcas] = useState<Record<number, "arriba" | "abajo">>({});
  const [porques, setPorques] = useState<Record<number, string>>({});
  const [revelado, setRevelado] = useState(false);
  // El 👎 abre el porqué en vez de avanzar: es el dato más valioso de toda la
  // calibración. Roberto: "si pongo no, que me puedas dar un input box de por
  // qué no". Un 👎 sin motivo dice que algo falló; con motivo dice QUÉ, y eso
  // es lo que se puede convertir en regla.
  const [pidiendoPorque, setPidiendoPorque] = useState(false);
  const [borrador, setBorrador] = useState("");
  // El render ("así te queda"), bajo demanda y por look. Roberto: "sin el
  // render no estoy seguro". Cuesta ~$0.13 y ~16s, así que jamás automático.
  const [renders, setRenders] = useState<Record<number, string>>({});
  const [rindiendo, setRindiendo] = useState(false);
  const [errorRender, setErrorRender] = useState<string | null>(null);

  const avanzar = useCallback(() => {
    setPidiendoPorque(false);
    setBorrador("");
    setErrorRender(null);
    setIdx((i) => i + 1);
  }, []);

  const marcar = useCallback(
    (m: "arriba" | "abajo") => {
      const c = casos[idx];
      if (!c) return;
      setMarcas((prev) => ({ ...prev, [idx]: m }));
      // En segundo plano, sin bloquear: quien califica no espera a la red.
      void guardarMarcasEval(c.fila.id, { [c.i]: m });
      // El 👍 avanza solo. El 👎 se detiene a preguntar por qué — ahí está la
      // regla que este ejercicio existe para encontrar.
      if (m === "abajo") setPidiendoPorque(true);
      else avanzar();
    },
    [casos, idx, avanzar]
  );

  /** Guarda el porqué (si lo hay) y sigue. */
  const guardarPorque = useCallback(() => {
    const c = casos[idx];
    const t = borrador.trim();
    if (c && t) {
      setPorques((prev) => ({ ...prev, [idx]: t }));
      void guardarMarcasEval(c.fila.id, { [c.i]: "abajo" }, { [c.i]: t });
    }
    avanzar();
  }, [casos, idx, borrador, avanzar]);

  /** El render, bajo demanda. */
  const pedirRender = useCallback(async () => {
    const c = casos[idx];
    if (!c || rindiendo) return;
    setRindiendo(true);
    setErrorRender(null);
    try {
      const r = await fetch("/api/admin/evales/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId: c.fila.id, indice: c.i }),
      });
      const j = (await r.json()) as { image?: string; error?: string; detalle?: string };
      if (j.image) setRenders((prev) => ({ ...prev, [idx]: j.image! }));
      else {
        // Traducido: "closet_ajeno" y "sin_avatar" son los dos que de verdad
        // aparecen, y ninguno es un fallo — son condiciones con una acción
        // clara detrás. El resto se muestra crudo CON su detalle: un render que
        // falla sin decir por qué no se puede diagnosticar.
        const COPY: Record<string, string> = {
          closet_ajeno:
            "esta corrida es de otro clóset — el render usa el avatar de su dueño, así que solo él puede pedirlo",
          sin_avatar: "no hay avatar todavía: créalo en Perfil y vuelve",
        };
        setErrorRender(
          COPY[j.error ?? ""] ?? (j.detalle ? `${j.error}: ${j.detalle}` : (j.error ?? "falló"))
        );
      }
    } catch {
      setErrorRender("no llegó la petición");
    }
    setRindiendo(false);
  }, [casos, idx, rindiendo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (revelado) return;
      // Con el porqué abierto el teclado es para ESCRIBIR: capturar las flechas
      // ahí impediría mover el cursor dentro del texto.
      if (pidiendoPorque) {
        // ⌘/Ctrl+Enter cierra y sigue, como en cualquier caja de comentario.
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          guardarPorque();
        }
        return;
      }
      if (e.key === "ArrowLeft") { e.preventDefault(); marcar("abajo"); }
      else if (e.key === "ArrowRight") { e.preventDefault(); marcar("arriba"); }
      else if (e.key === "ArrowUp") { e.preventDefault(); avanzar(); }
      else if (e.key === "Backspace") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
      else if (e.key.toLowerCase() === "r") { e.preventDefault(); void pedirRender(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [marcar, revelado, pidiendoPorque, guardarPorque, avanzar, pedirRender]);

  const hechas = Object.keys(marcas).length;
  const c = casos[idx];

  // ── El revelado: al terminar la muestra, o cuando se pide ──
  if (revelado || (!c && hechas > 0)) {
    const juzgados = casos
      .map((x, i) => ({ ...x, mia: marcas[i], porque: porques[i] ?? null }))
      .filter((x) => x.mia);
    // Los 👎 CON motivo son la cosecha de verdad: cada uno es una regla
    // candidata escrita en las palabras de quien la vio.
    const conMotivo = juzgados.filter((x) => x.porque);
    const acuerdo = (quien: "texto" | "vision") => {
      const con = juzgados.filter((x) => x.nota?.[quien]);
      const ok = con.filter((x) => x.nota![quien]!.aprobado === (x.mia === "arriba"));
      return con.length ? Math.round((ok.length / con.length) * 100) : null;
    };
    const discrepan = juzgados.filter(
      (x) =>
        (x.nota?.texto && x.nota.texto.aprobado !== (x.mia === "arriba")) ||
        (x.nota?.vision && x.nota.vision.aprobado !== (x.mia === "arriba"))
    );

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-ink">
            Calibraste {juzgados.length} looks
          </p>
          <div className="flex gap-6">
            {(["texto", "vision"] as const).map((q) => (
              <div key={q} className="flex flex-col">
                <span className="text-2xl font-semibold text-ink">
                  {acuerdo(q) == null ? "—" : `${acuerdo(q)}%`}
                </span>
                <span className="text-xs text-muted">
                  acuerdo del juez {q === "texto" ? "de texto" : "visual"}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">
            Si esto baja con el tiempo, la rúbrica se afinó de más contra sí
            misma y hay que revisarla antes de confiar en sus números.
          </p>
        </div>

        {conMotivo.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-ink">
              Tus motivos ({conMotivo.length}) — candidatos a regla
            </h3>
            <p className="text-xs text-muted">
              Cada uno es una regla en potencia. Las que se puedan comprobar con
              los datos de la prenda (color, tipo, material) van a
              reglas-ejecucion.ts; las de criterio, al prompt.
            </p>
            {conMotivo.map((x, k) => (
              <div key={k} className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3">
                <p className="text-xs text-muted">
                  {x.fila.brief.etiqueta} · {x.look.nombre}
                </p>
                <p className="text-sm text-ink">{x.porque}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink">
            Donde no coincidimos ({discrepan.length}) — la cosecha
          </h3>
          <p className="text-xs text-muted">
            Aquí es donde salen las reglas nuevas: o el juez ve algo que tú no, o
            tú ves algo que a la rúbrica le falta decir.
          </p>
          {discrepan.map((x, k) => (
            <div key={k} className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3">
              <p className="text-xs text-muted">{x.fila.brief.etiqueta}</p>
              <p className="text-sm font-semibold text-ink">
                {x.look.nombre} — tú {x.mia === "arriba" ? "👍" : "👎"}
              </p>
              {x.nota?.texto && x.nota.texto.aprobado !== (x.mia === "arriba") ? (
                <p className="text-xs text-muted">
                  <b>texto {x.nota.texto.aprobado ? "👍" : "👎"}:</b> {x.nota.texto.porQue}
                </p>
              ) : null}
              {x.nota?.vision && x.nota.vision.aprobado !== (x.mia === "arriba") ? (
                <p className="text-xs text-muted">
                  <b>visión {x.nota.vision.aprobado ? "👍" : "👎"}:</b> {x.nota.vision.porQue}
                </p>
              ) : null}
            </div>
          ))}
          {discrepan.length === 0 ? (
            <p className="text-sm text-muted">
              Coincidieron en todo. Con esta muestra, las rúbricas ven como tú.
            </p>
          ) : null}
        </div>

        <button
          onClick={() => router.refresh()}
          className="rounded-xl border border-line py-3 text-sm font-semibold text-ink active:bg-tile"
        >
          Actualizar el marcador
        </button>
      </div>
    );
  }

  if (!c) {
    return (
      <p className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">
        No hay looks calificados que marcar.
      </p>
    );
  }

  const f = c.fila.brief;
  const formal = formalidadLegible(f.formality, gender);

  return (
    <div className="flex flex-col gap-3">
      {/* Progreso: cuántos van de la muestra. Sin esto, 30 juicios seguidos se
          sienten infinitos. */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-tile">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${(idx / casos.length) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-xs text-muted">
          {idx + 1} de {casos.length}
        </span>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <p className="text-xs text-muted">
          {f.plan?.trim() || f.etiqueta}
          {formal ? ` · ${formal}` : ""}
          {f.weather ? ` · ${f.weather.temp_c}°C ${f.weather.condition}` : ""}
        </p>
        <p className="text-base font-semibold text-ink">{c.look.nombre}</p>

        {/* Prendas GRANDES: se está juzgando ropa, no leyendo una lista. */}
        {/* Cada prenda CON SU NOMBRE debajo. Roberto: "si hay un pantalón o
            camisa, no sé si es de lino o qué, y eso influye". Y el material va
            porque el juez de texto también lo recibe: calibrar con menos
            información de la que tiene el juez mediría dos cosas distintas. */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {c.look.item_ids.map((id) => {
            const p = prendas[id];
            return (
              <div key={id} className="flex flex-col gap-1">
                {p?.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imagen}
                    alt={p.nombre}
                    className="aspect-square w-full rounded-lg border border-line object-cover"
                  />
                ) : (
                  <div
                    className="aspect-square w-full rounded-lg border border-line"
                    style={{ background: p?.swatch ?? "#E5E1DD" }}
                  />
                )}
                <p className="text-xs leading-tight text-ink">
                  {p?.nombre ?? "Prenda"}
                  {p?.material ? (
                    <span className="text-muted"> · {p.material}</span>
                  ) : null}
                </p>
              </div>
            );
          })}
        </div>

        {/* El render, DESPUÉS de la cuadrícula y solo si se pide: la
            cuadrícula mide la composición (lo que el motor decide) y el render
            lo interpreta un modelo de imagen que alucina. Pero hay looks donde
            el juicio no se puede emitir sin verlo puesto. */}
        {renders[idx] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={renders[idx]}
            alt="así te queda"
            className="w-full rounded-lg border border-line object-cover"
          />
        ) : (
          <button
            onClick={pedirRender}
            disabled={rindiendo}
            className="rounded-xl border border-line py-2.5 text-sm font-semibold text-ink active:bg-tile disabled:opacity-50"
          >
            {rindiendo ? "rindiendo… (~15s)" : "ver cómo queda puesto · R"}
          </button>
        )}
        {errorRender ? <p className="text-xs text-error">{errorRender}</p> : null}

        <p className="text-sm text-muted">{c.look.explicacion}</p>
        {c.look.tip ? (
          <p className="text-sm text-muted">
            <b className="text-ink">el toque:</b> {c.look.tip}
          </p>
        ) : null}
      </div>

      {pidiendoPorque ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <label className="text-sm font-semibold text-ink">¿por qué no?</label>
          <p className="-mt-1 text-xs text-muted">
            Lo concreto es lo que se vuelve regla: qué prenda, qué color, contra
            qué. &quot;Para funeral debe ser traje negro, no marino&quot; sirve;
            &quot;no me gusta&quot; no.
          </p>
          <textarea
            autoFocus
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            rows={3}
            placeholder="ej: para funeral debe ser negro — el marino se lee como oficina"
            className="rounded-xl border border-line bg-bg p-3 text-sm text-ink placeholder:text-muted"
          />
          <div className="flex gap-2">
            <button
              onClick={guardarPorque}
              className="flex-1 rounded-xl bg-ink py-3 text-sm font-semibold text-bg active:opacity-80"
            >
              guardar y seguir
            </button>
            <button
              onClick={avanzar}
              className="rounded-xl border border-line px-4 py-3 text-sm font-semibold text-muted active:bg-tile"
            >
              sin motivo
            </button>
          </div>
          <p className="text-xs text-muted">⌘↵ para guardar y seguir</p>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => marcar("abajo")}
            className="flex-1 rounded-xl border border-line py-4 text-base font-semibold text-ink active:bg-tile"
          >
            👎 no
          </button>
          <button
            onClick={() => marcar("arriba")}
            className="flex-1 rounded-xl bg-ink py-4 text-base font-semibold text-bg active:opacity-80"
          >
            👍 me lo pondría
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          ← 👎 · → 👍 · ↑ saltar · ⌫ atrás · R render
        </p>
        {hechas > 0 ? (
          <button
            onClick={() => setRevelado(true)}
            className="text-xs font-semibold text-accent"
          >
            ver el resultado ({hechas})
          </button>
        ) : null}
      </div>
    </div>
  );
}


function CerrarEval({
  corridaId,
  estado,
  nota,
}: {
  corridaId: string;
  estado: string;
  nota: string | null;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(nota ?? "");
  const [cerrando, setCerrando] = useState(false);
  if (estado === "cerrada") {
    return nota ? (
      <p className="rounded-xl border border-line bg-surface p-3 text-xs text-muted">
        {nota}
      </p>
    ) : null;
  }
  return (
    <details className="rounded-xl border border-line bg-surface p-4">
      <summary className="cursor-pointer text-sm font-semibold text-muted">
        Cerrar la corrida
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <p className="text-xs text-muted">
          Deja escrito qué aprendiste: qué regla salió de aquí, qué se cambió del
          prompt. Dentro de tres meses el número solo no dice nada.
        </p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder="ej: el estilo cae en frío — el motor se va a lo funcional y olvida la marca"
          className="rounded-xl border border-line bg-bg p-3 text-sm text-ink placeholder:text-muted"
        />
        <button
          disabled={cerrando}
          onClick={async () => {
            setCerrando(true);
            await cerrarEval(corridaId, texto);
            router.refresh();
          }}
          className="rounded-xl border border-line py-3 text-sm font-semibold text-ink active:bg-tile disabled:opacity-50"
        >
          {cerrando ? "Cerrando…" : "Cerrar"}
        </button>
      </div>
    </details>
  );
}
