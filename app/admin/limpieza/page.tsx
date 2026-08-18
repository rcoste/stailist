import { redirect } from "next/navigation";

// /admin/limpieza es la sección; el trabajo vive en sus dos pestañas. Se entra
// por "¿Existe?" porque es la pregunta previa: no tiene caso deduplicar una
// prenda que a lo mejor ni existe.
export default function AdminLimpieza() {
  redirect("/admin/limpieza/revisar");
}
