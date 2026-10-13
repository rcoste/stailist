import { requireAdmin } from "@/lib/auth";
import { AdminNavMovil, AdminSidebar } from "./admin-nav";

// Todo /admin pasa por aquí: solo entra is_admin (gate de app). La base además
// solo deja a admins LEER datos de otras usuarias (RLS) — cinturón y tirantes.
//
// El cascarón (2026-10-13): barra lateral fija en escritorio, barra de arriba
// en celular, y el contenido ancho. El admin es una herramienta de datos, no
// una pantalla de la app: no cabe en la columna de 430 del producto.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <AdminSidebar />
      <div className="min-w-0">
        <AdminNavMovil />
        <main className="mx-auto w-full max-w-[1180px] px-4 py-5 lg:px-10 lg:py-7">{children}</main>
      </div>
    </div>
  );
}
