// LAS DOS GRÁFICAS DEL ADMIN (2026-10-11), sin librería: una barra de avance
// hacia una meta y barras por día. Hasta aquí el admin no tenía ni una gráfica,
// y "¿vamos mejor que la semana pasada?" no se podía contestar de un vistazo.
// Los anchos y altos son porcentajes del dato, no medidas de diseño; los
// colores son tokens (ink, success, tile).

/** Una barra de "n de meta". Pasa de la meta sin romperse (se llena y ya). */
export function Avance({
  titulo,
  n,
  de,
  nota,
  tono = "ink",
}: {
  titulo: string;
  n: number;
  de: number;
  nota?: string;
  tono?: "ink" | "success";
}) {
  const pct = de > 0 ? Math.min(100, Math.round((n / de) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink">{titulo}</span>
        <span className="tabular-nums text-sm font-semibold text-ink">
          {n} <span className="font-normal text-muted">de {de}</span>
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-tile">
        <div className={`h-full rounded-full ${tono === "success" ? "bg-success" : "bg-ink"}`} style={{ width: `${pct}%` }} />
      </div>
      {nota ? <span className="text-xs text-muted">{nota}</span> : null}
    </div>
  );
}

/** Barras por día, dos series lado a lado. El número va encima de cada barra que no es cero. */
export function BarrasPorDia({
  dias,
  series,
}: {
  dias: { etiqueta: string; valores: number[] }[];
  series: { nombre: string; tono: "ink" | "success" }[];
}) {
  const max = Math.max(1, ...dias.flatMap((d) => d.valores));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-1" style={{ height: "7rem" }}>
        {dias.map((d) => (
          <div key={d.etiqueta} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px">
            {d.valores.map((v, i) => (
              <div key={i} className="flex h-full w-full flex-col items-center justify-end">
                {v > 0 ? <span className="text-[10px] tabular-nums text-muted">{v}</span> : null}
                <div
                  className={`w-full rounded-t-sm ${series[i].tono === "success" ? "bg-success" : "bg-ink"}`}
                  style={{ height: v > 0 ? `${Math.max(4, Math.round((v / max) * 100))}%` : "0" }}
                  title={`${d.etiqueta}: ${v} ${series[i].nombre}`}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {dias.map((d) => (
          <span key={d.etiqueta} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted">
            {d.etiqueta}
          </span>
        ))}
      </div>
      <div className="flex gap-4 text-xs text-muted">
        {series.map((s) => (
          <span key={s.nombre} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-sm ${s.tono === "success" ? "bg-success" : "bg-ink"}`} />
            {s.nombre}
          </span>
        ))}
      </div>
    </div>
  );
}
