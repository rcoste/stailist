"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEFECTOS_MOTOR, type MarcadorMotor } from "@/lib/comparador/motor";
import { paresNecesarios, type ResultadoPareado } from "@/lib/comparador/juez-pareado";
import { formatoUsd } from "@/lib/proveedores/precios";
import {
  cambiarEstadoMotor,
  reintentarFallidos,
  retomarGeneracion,
} from "../../motor-actions";

// El reveal: recién aquí se sabe qué variante era cada columna. El veredicto
// se lee CONTRA LA REGLA pre-registrada, que se muestra arriba del marcador —
// leerla después de ver los números es leer otra cosa.

const etiquetaDefecto = (clave: string) =>
  DEFECTOS_MOTOR.find((d) => d.clave === clave)?.label ?? clave;

export function MarcadorMotorView({
  corridaId,
  tamano,
  regla,
  estado,
  nota,
  promptVersion,
  poolVersion,
  resultado,
  notas,
  comentarios,
  preferencias,
  pareado,
  cambiaModelo,
  etiquetas,
  sinGenerar,
  marcasPendientes,
  cruceporCalificar = 0,
}: {
  corridaId: string;
  tamano: string;
  regla: string | null;
  estado: string;
  nota: string | null;
  promptVersion: string;
  poolVersion: string;
  resultado: MarcadorMotor;
  notas: { n: number; etiqueta: string; nota: string }[];
  /**
   * La preferencia look por look anotada DESPUÉS del voto. Va aparte del
   * marcador y dicho con todas sus letras: nació con el resultado global ya
   * alcanzable, así que es evidencia más débil que el voto ciego.
   */
  preferencias: { filas: { clave: string; etiqueta: string; gana: number }[]; empates: number };
  /** El marcador de la RÚBRICA sobre los mismos briefs. null si nadie juzgó. */
  pareado: ResultadoPareado | null;
  cambiaModelo: boolean;
  etiquetas: Record<string, string>;
  comentarios: {
    n: number;
    etiqueta: string;
    variante: string;
    look: number;
    marca: string | null;
    texto: string;
  }[];
  sinGenerar: number;
  /** Pares ya votados a los que les falta el diagnóstico por look. */
  marcasPendientes: number;
  /** Hallazgos del juez sin calificar (pantalla /cruce). */
  cruceporCalificar?: number;
}) {
  const router = useRouter();
  const [notaCierre, setNotaCierre] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [errorCierre, setErrorCierre] = useState<string | null>(null);
  const esVistazo = tamano === "vistazo";
  const [a, b] = resultado.variantes;

  const cerrar = async () => {
    setCerrando(true);
    setErrorCierre(null);
    const r = await cambiarEstadoMotor(corridaId, "cerrada", notaCierre.trim() || undefined);
    setCerrando(false);
    if (!r.ok) {
      setErrorCierre(r.error ?? "no se pudo cerrar");
      return;
    }
    router.refresh();
  };

  const [retomando, setRetomando] = useState(false);
  const retomar = async () => {
    setRetomando(true);
    setErrorCierre(null);
    const r = await retomarGeneracion(corridaId);
    setRetomando(false);
    if (!r.ok) {
      setErrorCierre(r.error ?? "no se pudo retomar");
      return;
    }
    router.refresh();
  };

  const [reintentando, setReintentando] = useState(false);
  const conErrores = resultado.variantes.some((v) => v.errores > 0);
  const reintentar = async () => {
    setReintentando(true);
    setErrorCierre(null);
    const r = await reintentarFallidos(corridaId);
    setReintentando(false);
    if (!r.ok) {
      setErrorCierre(r.error ?? "no se pudo reabrir");
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-ink">
            {esVistazo ? "Lo que dejó el vistazo" : "El veredicto"}
          </h1>
          <Link href="/admin/comparador" className="text-sm font-semibold text-accent">
            Volver
          </Link>
        </div>
        <p className="text-sm text-muted">
          Prompt {promptVersion} · briefs {poolVersion} · {resultado.votados} pares votados
          {resultado.empates ? ` · ${resultado.empates} empates` : ""}
          {sinGenerar > 0 ? ` · ${sinGenerar} pares sin generar` : ""}
        </p>
      </header>

      {/* LO ACCIONABLE VA ARRIBA. Estas tarjetas vivían al final, debajo del
          marcador y las notas: Roberto entró a completar sus marcas, vio el
          resultado, concluyó "ya está" y nunca llegó a ellas. El marcador es
          lectura; esto es trabajo pendiente. */}
      {marcasPendientes > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-ink">
            {marcasPendientes} {marcasPendientes === 1 ? "par votado" : "pares votados"} sin
            marcas por look
          </p>
          <p className="text-xs text-muted">
            Se votaron antes de que existiera el 👍/👎 por look. El voto queda
            intacto (eso es lo que sella el resultado); esto completa el
            diagnóstico, y sigue ciego.
          </p>
          <Link
            href={`/admin/comparador/motor/${corridaId}/marcas`}
            className="rounded-xl border border-line py-3 text-center text-sm font-semibold text-ink active:bg-tile"
          >
            Marcar los looks que faltan
          </Link>
        </div>
      ) : null}

      {/* EL CRUCE VA PRIMERO Y EN NEGRO, y los dos enlaces ya no se ven igual.
          Antes eran dos botones idénticos ("Lo que vieron los jueces" / "Tu
          voto contra el juez"): Roberto votó la ronda entera, entró al primero
          —que es LECTURA, sin dónde opinar ni salida— y se quedó sin poder
          calificar. El de arriba es lo que hay que HACER ahora; el de abajo es
          consulta. Sin voto el cruce no se ofrece: se abriría vacío, y sería
          una invitación a leer los hallazgos con el voto abierto. */}
      {resultado.votados > 0 ? (
        <Link
          href={`/admin/comparador/motor/${corridaId}/cruce`}
          className="flex flex-col items-center gap-0.5 rounded-xl bg-ink py-3 text-center text-sm font-semibold text-bg active:opacity-80"
        >
          Tu voto contra el juez
          {cruceporCalificar > 0 ? (
            <span className="text-xs font-normal opacity-80">
              te faltan {cruceporCalificar} hallazgos por calificar
            </span>
          ) : (
            <span className="text-xs font-normal opacity-80">ya los calificaste todos</span>
          )}
        </Link>
      ) : null}

      {/* La ronda de los jueces, antes de que el voto humano entre. Va aquí y
          no escondido en el detalle: es el paso que ahorra el trabajo manual. */}
      <Link
        href={`/admin/comparador/motor/${corridaId}/jueces`}
        className="rounded-xl border border-line py-3 text-center text-sm font-semibold text-ink active:bg-tile"
      >
        Lo que vieron los jueces
      </Link>

      {esVistazo && sinGenerar > 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-ink">
            Faltan {sinGenerar} {sinGenerar === 1 ? "par" : "pares"} por generar
          </p>
          <p className="text-xs text-muted">
            Un vistazo no declara ganador, así que ver este marcador no
            corrompe nada: se puede retomar y terminar los briefs que faltan.
            (En un veredicto no se permite — ahí seguir después de ver el
            marcador sí contaminaría los votos restantes.)
          </p>
          <button
            disabled={retomando}
            onClick={retomar}
            className="rounded-xl bg-ink py-3 text-sm font-semibold text-bg active:opacity-80 disabled:opacity-50"
          >
            {retomando ? "Retomando…" : `Generar los ${sinGenerar} que faltan`}
          </button>
        </div>
      ) : null}

      {esVistazo ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-ink">El vistazo no declara ganador.</p>
          <p className="text-sm text-muted">
            Sirve para dos cosas: convertir defectos en reglas, o decidir si
            esta pregunta merece un veredicto de 20-40 pares.
          </p>
        </div>
      ) : regla ? (
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            La regla, escrita antes de votar
          </p>
          <p className="text-sm leading-relaxed text-ink">{regla}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {resultado.variantes.map((v) => (
          <div key={v.clave} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
            <p className="text-sm font-semibold text-ink">{v.etiqueta}</p>
            {!esVistazo ? (
              <p className="text-3xl font-semibold text-ink">{v.victorias}</p>
            ) : null}
            <div className="flex flex-col gap-1 text-xs text-muted">
              <span>costo por par: {v.costoPromedio == null ? "—" : formatoUsd(v.costoPromedio)}</span>
              <span>tiempo por par: {v.msPromedio == null ? "—" : `${Math.round(v.msPromedio / 1000)}s`}</span>
              {/* Cuántos looks te entregó de verdad. El prompt pide "2 o 3", así
                  que dar 2 es legal — pero es menos, y hasta hoy no se veía en
                  ninguna parte: Roberto lo encontró abriendo una pestaña vacía. */}
              {v.ladosConLooks > 0 ? (
                <span>
                  looks por par: {(v.looksTotales / v.ladosConLooks).toFixed(2)}
                  {v.looksTotales / v.ladosConLooks < 2.99 ? " (el máximo es 3)" : ""}
                </span>
              ) : null}
              {v.errores ? <span className="text-error">{v.errores} lados fallaron</span> : null}
            </div>
            {/* SIEMPRE con denominador. Un "0 👎" suelto se lee como "nada
                salió mal" cuando puede querer decir "nadie los miró": en el
                primer veredicto hubo 20 marcas sobre 119 looks. */}
            {v.looksTotales > 0 ? (
              <p className="text-xs text-muted">
                looks: {v.looksArriba} 👍 · {v.looksAbajo} 👎 ·{" "}
                <span
                  className={
                    v.looksArriba + v.looksAbajo < v.looksTotales / 2
                      ? "text-error"
                      : undefined
                  }
                >
                  {v.looksArriba + v.looksAbajo} de {v.looksTotales} revisados
                </span>
              </p>
            ) : null}
            {Object.keys(v.defectos).length ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Defectos</p>
                {Object.entries(v.defectos)
                  .sort(([, x], [, y]) => y - x)
                  .map(([clave, cuenta]) => (
                    <p key={clave} className="text-xs text-muted">
                      {etiquetaDefecto(clave)} × {cuenta}
                    </p>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-muted">sin defectos marcados</p>
            )}
          </div>
        ))}
      </div>

      {!esVistazo && a && b ? (
        <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-ink">¿Puede ser azar?</p>
          <p className="text-sm text-muted">
            {resultado.p == null
              ? "Sin votos suficientes para decir nada."
              : `${a.etiqueta} ${a.victorias} — ${b.victorias} ${b.etiqueta} (empates fuera): p ≈ ${resultado.p.toFixed(3)}. ${
                  resultado.p < 0.05
                    ? "Difícil que sea azar."
                    : "Perfectamente puede ser azar — contra la regla, eso NO es ganar."
                }`}
          </p>
          {resultado.consistencia.espejos > 0 ? (
            <p className="text-sm text-muted">
              Consistencia (pares espejo, mismo par con el orden volteado):{" "}
              {resultado.consistencia.coinciden} de {resultado.consistencia.espejos}{" "}
              votados igual.
              {resultado.consistencia.coinciden < resultado.consistencia.espejos
                ? " Cada espejo que cambió de voto le resta confianza al total."
                : ""}{" "}
              Léela como cota superior: los espejos se votan en la misma sesión
              y la memoria de los looks puede inflarla.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Aviso de cobertura: sin él, un marcador con pocas marcas invita a
          leer la ausencia como si fuera juicio. */}
      {resultado.variantes.some(
        (v) => v.looksTotales > 0 && v.looksArriba + v.looksAbajo < v.looksTotales / 2
      ) ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-xs text-muted">
          <span className="font-semibold text-ink">Cobertura parcial:</span> se
          marcó menos de la mitad de los looks. Los que no tienen 👍/👎{" "}
          <span className="font-semibold text-ink">no se revisaron</span> — no
          quiere decir que estuvieran mal. El voto de cada par sí es completo;
          lo incompleto es el diagnóstico look por look.
        </p>
      ) : null}

      {/* LA SEGUNDA LECTURA, y separada a propósito. Se anotó al completar las
          marcas, o sea con el resultado de arriba ya alcanzable: sigue siendo
          ciega por par (las columnas nunca dicen qué variante son) pero no es
          ciega al marcador. Mezclarla con el veredicto le lavaría esa
          diferencia; leerla aparte contesta algo que el veredicto no contestó,
          porque los primeros pares se votaron mirando solo el primer look. */}
      {pareado && pareado.comparables > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-ink">
            La rúbrica, par a par
          </h2>
          <p className="text-xs text-muted">
            El mismo juez sobre los MISMOS briefs. Comparar dentro del brief
            cancela la varianza del día — que es la que domina: dos corridas del
            eval con el mismo código llegaron a diferir 12 puntos.
          </p>
          {cambiaModelo ? (
            <p className="rounded-xl border border-line bg-surface p-3 text-xs text-warning">
              Estas variantes cambian de MODELO. La rúbrica no corona modelos —
              un juez Claude prefiere looks de Claude. Esto dice DÓNDE difieren,
              no cuál usar: eso lo decide el voto ciego.
            </p>
          ) : null}
          <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-4 text-sm">
            {Object.entries(pareado.gana).map(([clave, n]) => (
              <div key={clave} className="flex justify-between">
                <span className="text-muted">{etiquetas[clave] ?? clave}</span>
                <span className="font-semibold text-ink">gana {n}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span className="text-muted">empates</span>
              <span className="text-ink">{pareado.empates}</span>
            </div>
            {pareado.diferencia ? (
              <div className="mt-1 border-t border-line pt-2">
                <div className="flex justify-between">
                  <span className="text-muted">diferencia media</span>
                  <span className="font-semibold text-ink">
                    {pareado.diferencia.media >= 0 ? "+" : ""}
                    {pareado.diferencia.media.toFixed(3)} pts
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">t</span>
                  <span className="font-semibold text-ink">
                    {pareado.diferencia.t ?? "—"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {pareado.diferencia.t != null && Math.abs(pareado.diferencia.t) > 2
                    ? "La diferencia sobrevive al ruido."
                    : `Dentro del ruido. Para detectar +0.2 pts harían falta ~${paresNecesarios(
                        pareado.diferencia.se * Math.sqrt(pareado.comparables)
                      )} pares.`}
                </p>
              </div>
            ) : null}
          </div>

          {/* DÓNDE está la diferencia: sin esto el número es un veredicto sin
              diagnóstico, y lo que sirve para iterar es saber qué dimensión se
              movió. */}
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[380px] text-xs">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="p-2 font-medium">dimensión</th>
                  {Object.keys(pareado.gana).map((c) => (
                    <th key={c} className="p-2 font-medium">
                      {etiquetas[c] ?? c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {["ocasion", "clima", "armado", "estilo", "color", "wow"].map((d) => (
                  <tr key={d} className="border-b border-line last:border-0">
                    <td className="p-2 text-muted">{d}</td>
                    {Object.keys(pareado.gana).map((c) => (
                      <td key={c} className="p-2 font-semibold text-ink">
                        {pareado.porDimension[c]?.[d]?.toFixed(2) ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {preferencias.filas.some((f) => f.gana > 0) || preferencias.empates ? (
        <section className="flex flex-col gap-2 rounded-xl border border-dashed border-line p-4">
          <h2 className="text-sm font-semibold text-ink">
            Preferencia look por look (no cuenta para el veredicto)
          </h2>
          <p className="text-xs leading-relaxed text-muted">
            Anotada al completar las marcas, con el resultado de arriba ya
            visible. Es evidencia más débil que el voto —por eso vive aquí y no
            allá— pero contesta algo que el voto no: si tu preferencia sobre los
            looks 2 y 3 apuntaba al mismo lado que el primero.
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-ink">
            {preferencias.filas.map((f) => (
              <span key={f.clave}>
                <span className="font-semibold">{f.gana}</span> {f.etiqueta}
              </span>
            ))}
            {preferencias.empates ? (
              <span className="text-muted">{preferencias.empates} empates</span>
            ) : null}
          </div>
        </section>
      ) : null}

      {comentarios.length ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Qué le viste a cada look
          </p>
          <p className="text-xs text-muted">
            Ya revelado a su variante. Lo que se repita aquí es candidato a
            regla comprobable del motor.
          </p>
          {comentarios.map((c, i) => (
            <p key={i} className="text-xs leading-relaxed text-muted">
              <span className="font-semibold text-ink">
                {c.marca === "arriba" ? "👍 " : c.marca === "abajo" ? "👎 " : ""}
                {c.variante}, look {c.look} (par {c.n}, {c.etiqueta}):
              </span>{" "}
              {c.texto}
            </p>
          ))}
        </div>
      ) : null}

      {notas.length ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Por qué votaste lo que votaste
          </p>
          <p className="text-xs text-muted">
            Esto es la cosecha real de la corrida: cada razón que se repita es
            candidata a regla comprobable del motor.
          </p>
          {notas.map((x) => (
            <p key={`${x.n}`} className="text-xs leading-relaxed text-muted">
              <span className="font-semibold text-ink">
                par {x.n} ({x.etiqueta}):
              </span>{" "}
              {x.nota}
            </p>
          ))}
        </div>
      ) : null}

      {nota ? (
        <p className="text-xs text-muted">Nota de la corrida: {nota}</p>
      ) : null}

      {conErrores && estado !== "cerrada" ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-ink">Lados que fallaron</p>
          <p className="text-xs text-muted">
            Un fallo del proveedor (sobrecarga, límite de ritmo) no es un
            resultado del motor. Reintentar borra SOLO las filas con error y
            vuelve a la pantalla de generación — lo ya generado no se re-paga.
          </p>
          <button
            disabled={reintentando}
            onClick={reintentar}
            className="rounded-xl border border-line py-3 text-sm font-semibold text-ink active:bg-tile disabled:opacity-50"
          >
            {reintentando ? "Reabriendo…" : "Reintentar los lados fallidos"}
          </button>
        </div>
      ) : null}

      {estado !== "cerrada" ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold text-ink">Cerrar la corrida</p>
          <input
            value={notaCierre}
            onChange={(e) => setNotaCierre(e.target.value)}
            placeholder={
              esVistazo
                ? "qué se encontró y qué sigue (regla nueva / subir a veredicto)"
                : "la decisión, aplicando la regla de arriba"
            }
            className="rounded-xl border border-line bg-bg p-3 text-sm text-ink placeholder:text-muted"
          />
          {errorCierre ? <p className="text-sm text-error">{errorCierre}</p> : null}
          <button
            disabled={cerrando}
            onClick={cerrar}
            className="rounded-xl bg-ink py-3 text-sm font-semibold text-bg active:opacity-80 disabled:opacity-50"
          >
            {cerrando ? "Cerrando…" : "Cerrar"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
