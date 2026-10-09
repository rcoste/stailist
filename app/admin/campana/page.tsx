import { redirect } from "next/navigation";

// Campaña y Adquisición se unieron en Campañas (replanteo del admin,
// 2026-10-09). La ruta vieja sigue llevando al lugar correcto.
export default function CampanaVieja() {
  redirect("/admin/campanas");
}
