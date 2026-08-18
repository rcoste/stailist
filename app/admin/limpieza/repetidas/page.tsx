import { requireAdmin } from "@/lib/auth";
import { duplicadosDe, cualConservar } from "@/lib/duplicados";
import { DuplicadosClient } from "./duplicados-client";
import { LimpiezaTabs } from "../limpieza-tabs";

// Revisión de prendas repetidas, sobre el clóset de quien entra.
//
// Es de admin y no del perfil normal a propósito: la limpieza de datos no es
// una función del producto, es una herramienta para arreglar lo que el pipeline
// de análisis dejó mal. Si resulta que le pasa a todos los usuarios, entonces
// sí hay que decidir si se vuelve producto o si se arregla el pipeline.
export const dynamic = "force-dynamic";

export default async function AdminDuplicados() {
  const perfil = await requireAdmin();
  const grupos = await duplicadosDe(perfil.id);

  // Cuál se conserva se calcula aquí y viaja al cliente: la pantalla lo enseña
  // ANTES de que decida, para que no haya sorpresa sobre qué fila sobrevive.
  const conservarPorGrupo = Object.fromEntries(
    grupos.map((g) => [g.clave, cualConservar(g.filas)])
  );

  return (
    <div className="flex flex-col gap-4">
      <LimpiezaTabs />
      <DuplicadosClient grupos={grupos} conservarPorGrupo={conservarPorGrupo} />
    </div>
  );
}
