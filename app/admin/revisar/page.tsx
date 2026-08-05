import { requireAdmin } from "@/lib/auth";
import { porRevisar } from "@/lib/revisar-closet";
import { RevisarClient } from "./revisar-client";

// Confirmar prenda por prenda que el clóset existe de verdad.
//
// En admin y no en el perfil porque nace de un caso concreto —tres prendas que
// Roberto no tiene apareciendo en más de un tercio de los looks— y no está
// decidido si es producto. El dato dice que probablemente sí lo sea: 308
// prendas de 958 vienen de fotos con varias prendas, repartidas en 12 usuarios,
// y Tatiana tiene 72. Si al limpiarlas resulta que hay muchas de más, esto se
// convierte en una pantalla del clóset normal.
export const dynamic = "force-dynamic";

export default async function AdminRevisar() {
  const perfil = await requireAdmin();
  const prendas = await porRevisar(perfil.id);
  return <RevisarClient prendas={prendas} />;
}
