import { redirect } from "next/navigation";

// Adquisición se unió a Campañas (replanteo del admin, 2026-10-09): la tabla
// por fuente y campaña, lo que dicen que las trajo y la app instalada viven
// ahí; el mazo de swipes, en el Taller.
export default function AdquisicionVieja() {
  redirect("/admin/campanas");
}
