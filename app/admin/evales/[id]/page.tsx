import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cargarEvalCorrida } from "@/lib/evales/servidor";
import {
  acuerdoDeCalibracion,
  briefsPendientes,
  estimadoEval,
  marcadorEval,
} from "@/lib/evales/evales";
import { CorrerClient } from "./correr-client";
import { MarcadorEvalView } from "./marcador-eval";

export const dynamic = "force-dynamic";

// Una corrida de eval en sus dos momentos: correr los pasos pendientes, y el
// marcador. La fase se decide por los DATOS (qué brief falta por generar o por
// calificar), no por el estado guardado — recargar a media corrida siempre cae
// donde ibas, igual que en el comparador.
export default async function EvalCorridaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfilAdmin = await requireAdmin();
  const { id } = await params;
  const cargada = await cargarEvalCorrida(id);

  if (!cargada) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">No encontré esa corrida.</p>
        <Link href="/admin/evales" className="text-sm font-semibold text-accent">
          Volver
        </Link>
      </div>
    );
  }

  const { corrida, filas, prendas } = cargada;
  const pendientes = briefsPendientes(filas);

  if (pendientes.length > 0 && corrida.estado === "corriendo") {
    return (
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <Link href="/admin/evales" className="text-xs font-semibold text-accent">
            ← Evales
          </Link>
          <h1 className="text-xl font-semibold text-ink">Corriendo el eval</h1>
          <p className="text-sm text-muted">
            {corrida.promptVersion} · {corrida.modeloGenerador} · {filas.length}{" "}
            días del pool {corrida.poolVersion}
          </p>
        </header>
        <CorrerClient
          // Remonta el cliente cuando cambia lo pendiente (tras router.refresh):
          // sin esto el estado local viejo recorta mal la lista nueva.
          key={`correr-${pendientes.length}`}
          corridaId={id}
          pendientes={pendientes.map((p) => ({
            id: p.id,
            n: p.n,
            etiqueta: p.brief.etiqueta,
          }))}
          hechos={filas.length - pendientes.length}
          total={filas.length}
          estimado={estimadoEval(pendientes.length)}
        />
      </div>
    );
  }

  // El género del dueño, para leer la formalidad con su ancla concreta ("traje
  // y corbata" contra "vestido largo") al calibrar.
  const supabase = await createClient();
  const { data: perfil } = await supabase
    .from("profiles")
    .select("gender")
    .eq("id", perfilAdmin.id)
    .maybeSingle();

  return (
    <MarcadorEvalView
      corrida={corrida}
      filas={filas}
      prendas={prendas}
      m={marcadorEval(filas, corrida.conEstilo, corrida.conColor)}
      acuerdo={acuerdoDeCalibracion(filas)}
      gender={(perfil?.gender as string | null) ?? null}
    />
  );
}
