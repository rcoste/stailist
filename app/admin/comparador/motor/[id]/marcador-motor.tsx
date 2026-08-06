"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEFECTOS_MOTOR, type MarcadorMotor } from "@/lib/comparador/motor";
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
  resultado,
  notas,
  comentarios,
  sinGenerar,
  marcasPendientes,
}: {
  corridaId: string;
  tamano: string;
  regla: string | null;
  estado: string;
  nota: string | null;
  promptVersion: string;
  resultado: MarcadorMotor;
  notas: { n: number; etiqueta: string; nota: string }[];
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
          Prompt {promptVersion} · {resultado.votados} pares votados
          {resultado.empates ? ` · ${resultado.empates} empates` : ""}
          {sinGenerar > 0 ? ` · ${sinGenerar} pares sin generar` : ""}
        </p>
      </header>

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
              {v.errores ? <span className="text-error">{v.errores} lados fallaron</span> : null}
            </div>
            {v.looksArriba + v.looksAbajo > 0 ? (
              <p className="text-xs text-muted">
                looks marcados: {v.looksArriba} 👍 · {v.looksAbajo} 👎
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
