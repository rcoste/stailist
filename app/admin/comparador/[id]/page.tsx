import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { marcador } from "@/lib/comparador/tipos";
import { cargarCorrida } from "@/lib/comparador/servidor";
import { CalificarClient } from "./calificar-client";
import { Marcador } from "./marcador";

export const dynamic = "force-dynamic";

export default async function CorridaComparador({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const corrida = await cargarCorrida(id);

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

  const pendientes = corrida.fotos.filter((f) =>
    f.lecturas.some((l) => l.veredicto === null && !l.error)
  );

  // El marcador SÓLO cuando ya no queda nada por calificar. Verlo a media
  // revisión rompería el ciego: dos fotos bastan para deducir qué columna es
  // cuál si ya se ve quién va ganando.
  if (!pendientes.length) {
    return <Marcador corridaId={id} modo={corrida.modo} resultados={marcador(corrida.fotos)} />;
  }

  return (
    <CalificarClient
      corridaId={id}
      modo={corrida.modo}
      fotos={pendientes}
      yaHechas={corrida.fotos.length - pendientes.length}
      total={corrida.fotos.length}
    />
  );
}
