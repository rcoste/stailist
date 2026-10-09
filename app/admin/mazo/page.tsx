import { requireAdmin } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { SQL_MAZO, resumirMazo, type FilaMazo } from "@/lib/admin/mazo";

// EL MAZO DE SWIPES: ¿las cartas atrevidas del arranque espantan a alguien?
// Vivía en Adquisición; con el replanteo del admin (2026-10-09) pasó al Taller
// porque es una pregunta de construir el onboarding, no de leer la campaña.
// Si hay abandono o escape temprano en hombres, se cambia sólo la primera
// vuelta (una carta clásica por Streetwear o Hipster). Si no, el orden se
// queda: rechazar una carta también mide. Medido el 2026-09-16: 7 de 7 hombres
// terminaron, 1 usó el escape.

export const dynamic = "force-dynamic";

const th = "px-3 py-2.5 font-medium";
const td = "px-3 py-2.5";

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${Math.round((n / d) * 100)}%`;
}

export default async function Mazo() {
  await requireAdmin();
  const mazo = resumirMazo((await withDb(async (c) => (await c.query(SQL_MAZO)).rows)) as FilaMazo[]);
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">El mazo de swipes</h1>
        <p className="max-w-3xl text-sm text-muted">
          Cuántas terminan las cartas, cuántas usan el escape y qué carta gusta. Llegó = ya dio su
          edad, que se pide justo antes.
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        {mazo.map((g) => (
          <div key={g.genero} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
            <p className="text-sm text-ink">
              <b className="capitalize">{g.genero === "hombre" ? "hombres" : "mujeres"}</b> · terminaron{" "}
              <span className="tabular">{pct(g.terminaron, g.llegaron)}</span> · escape{" "}
              <span className="tabular">{pct(g.escape, g.conVotos)}</span> · likes{" "}
              <span className="tabular">{g.pctLikes === null ? "—" : `${g.pctLikes}%`}</span>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th className={`${th} text-left`}>#</th>
                    <th className={`${th} text-left`}>Carta</th>
                    <th className={`${th} text-center`}>Likes</th>
                  </tr>
                </thead>
                <tbody>
                  {g.cartas.map((c) => (
                    <tr key={c.id} className="border-b border-line last:border-0">
                      <td className={`${td} text-left tabular text-muted`}>{c.posicion}</td>
                      <td className={`${td} text-left text-ink`}>{c.nombre}</td>
                      <td className={`${td} text-center tabular text-ink`}>{c.votos ? `${c.likes} de ${c.votos}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
