"use client";

import Link from "next/link";
import { useState } from "react";
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
        {!corrida.conEstilo ? (
          <p className="text-xs text-muted">
            La dimensión de estilo va vacía: el perfil de este clóset no tenía
            estilo declarado al abrir la corrida, así que el juez la deja neutra
            y promediarla fingiría una medición.
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
 * La muestra que se marca a mano. Prioriza los looks SIN marca y los que los
 * jueces vieron distinto entre sí: donde texto y visión discrepan es donde una
 * marca humana informa más.
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
  const [guardando, setGuardando] = useState<string | null>(null);

  const casos = filas
    .flatMap((f) =>
      (f.looks ?? []).map((look, i) => ({
        fila: f,
        look,
        i,
        nota: f.notas?.[i] ?? null,
        marca: f.marcas?.[String(i)] ?? null,
      }))
    )
    .filter((c) => c.nota)
    // Sin marcar primero, y dentro de esos los que los jueces vieron distinto.
    .sort((a, b) => {
      if (!!a.marca !== !!b.marca) return a.marca ? 1 : -1;
      const dis = (c: typeof a) =>
        c.nota!.texto && c.nota!.vision && c.nota!.texto.aprobado !== c.nota!.vision.aprobado
          ? 0
          : 1;
      return dis(a) - dis(b);
    })
    .slice(0, 30);

  const marcar = async (
    fila: EvalBriefFila,
    i: number,
    marca: "arriba" | "abajo"
  ) => {
    setGuardando(`${fila.id}|${i}`);
    await guardarMarcasEval(fila.id, { [i]: marca });
    setGuardando(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      {casos.map((c) => {
        const clave = `${c.fila.id}|${c.i}`;
        const f = c.fila.brief;
        const formal = formalidadLegible(f.formality, gender);
        return (
          <div key={clave} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
            <p className="text-xs text-muted">
              {f.plan?.trim() || f.etiqueta}
              {formal ? ` · ${formal}` : ""}
              {f.weather ? ` · ${f.weather.temp_c}°C ${f.weather.condition}` : ""}
            </p>
            <p className="text-sm font-semibold text-ink">{c.look.nombre}</p>
            <div className="flex flex-wrap gap-2">
              {c.look.item_ids.map((id) => {
                const p = prendas[id];
                return p?.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={id}
                    src={p.imagen}
                    alt={p.nombre}
                    className="h-20 w-20 rounded-lg border border-line object-cover"
                  />
                ) : (
                  <div
                    key={id}
                    className="flex h-20 w-20 items-center justify-center rounded-lg border border-line p-1 text-center text-[10px] text-muted"
                    style={{ background: p?.swatch ?? "#E5E1DD" }}
                  >
                    {p?.nombre ?? "Prenda"}
                  </div>
                );
              })}
            </div>

            {/* Los jueces se ven DESPUÉS de la marca: verlos antes contaminaría
                justo lo que se está midiendo. */}
            {c.marca ? (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted">
                  Lo que dijeron los jueces
                </summary>
                <div className="mt-1 flex flex-col gap-1 text-muted">
                  {c.nota?.texto ? (
                    <p>
                      <b>texto</b> {c.nota.texto.aprobado ? "👍" : "👎"}:{" "}
                      {c.nota.texto.porQue}
                    </p>
                  ) : null}
                  {c.nota?.vision ? (
                    <p>
                      <b>visión</b> {c.nota.vision.aprobado ? "👍" : "👎"}:{" "}
                      {c.nota.vision.porQue}
                    </p>
                  ) : null}
                  {(c.nota?.violaciones ?? []).map((v, k) => (
                    <p key={k}>
                      <b>código</b> {v.regla}: {v.detalle}
                    </p>
                  ))}
                </div>
              </details>
            ) : null}

            <div className="flex gap-2">
              {(["arriba", "abajo"] as const).map((m) => (
                <button
                  key={m}
                  disabled={guardando === clave}
                  onClick={() => marcar(c.fila, c.i, m)}
                  className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                    c.marca === m
                      ? "border-accent bg-accent text-on-accent"
                      : "border-line text-ink active:bg-tile"
                  }`}
                >
                  {m === "arriba" ? "👍 me lo pondría" : "👎 no"}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {casos.length === 0 ? (
        <p className="text-sm text-muted">No hay looks calificados que marcar.</p>
      ) : null}
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
