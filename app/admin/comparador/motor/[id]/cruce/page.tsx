import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { cargarCorridaMotor } from "@/lib/comparador/motor-servidor";
import { cruzarCorrida } from "@/lib/comparador/cruce";
import { CruceClient } from "./cruce-client";

export const dynamic = "force-dynamic";

// TU VOTO CONTRA EL JUEZ.
//
// La tercera pantalla de una corrida, y la que faltaba. Las otras dos contestan
// preguntas distintas y ninguna contesta ésta:
//   · el marcador → ¿cuál motor ganó? (contra la regla pre-registrada)
//   · /jueces     → ¿qué vieron los tres jueces? (antes de votar, sin conocer
//                   el voto)
//   · /cruce      → ¿el juez ve lo que veo yo? (después de votar, con los dos
//                   lados a la vista)
//
// Los votos y los hallazgos vivían en la misma tabla, uno al lado del otro, y
// ninguna pantalla los ponía juntos: el primer cruce se hizo con un script
// suelto y llegó como un archivo por chat. Roberto: "no nada más el HTML, sino
// poder poner yo ahí comentarios para que sea más fácil que lo proceses".
//
// VA DESPUÉS DEL VOTO, NUNCA ANTES. `cruzarCorrida` se salta los pares sin
// votar y la acción de calificar los rechaza: leer los hallazgos del juez con
// el voto todavía abierto es exactamente lo que el ciego existe para evitar.
export default async function CruceDeCorrida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const corrida = await cargarCorridaMotor(id);

  if (!corrida) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">No encontré esa corrida.</p>
        <Link href="/admin/comparador" className="text-sm font-semibold text-accent">
          Volver
        </Link>
      </div>
    );
  }

  const resumen = cruzarCorrida(corrida);
  const etiquetas = Object.fromEntries(
    corrida.variantes.map((v) => [v.clave, v.etiqueta])
  );
  const sinJuez = resumen.looks.every((l) => l.juez.hallazgos.length === 0);
  const votados = corrida.pares.filter((p) => !p.repiteDe && p.voto).length;
  const reales = corrida.pares.filter((p) => !p.repiteDe).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={`/admin/comparador/motor/${id}`} className="text-xs text-muted">
          ← volver a la corrida
        </Link>
        <h1 className="text-h2 font-semibold text-ink">Tu voto contra el juez</h1>
        <p className="text-sm text-muted">
          {corrida.variantes.map((v) => v.etiqueta).join(" contra ")} · prompt{" "}
          {corrida.promptVersion} · {votados} de {reales} pares votados
        </p>
      </div>

      {votados === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-sm text-ink">Esta corrida todavía no se vota.</p>
          <p className="mt-1 text-xs text-muted">
            El cruce se abre después del voto — leer los hallazgos del juez con el
            voto abierto es justo lo que el ciego evita.{" "}
            <Link href={`/admin/comparador/motor/${id}`} className="font-semibold text-accent">
              Ir a votar
            </Link>
          </p>
        </div>
      ) : sinJuez ? (
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-sm text-ink">Esta corrida no ha pasado por los jueces.</p>
          <p className="mt-1 text-xs text-muted">
            Córrelos con{" "}
            <code className="rounded bg-bg px-1">
              npx tsx scripts/comparador-juzgar.ts {id}
            </code>
          </p>
        </div>
      ) : (
        <CruceClient
          resumen={resumen}
          prendas={corrida.prendas}
          etiquetas={etiquetas}
          gender={corrida.closetGender}
        />
      )}
    </div>
  );
}
