import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "./admin-nav";

// Todo /admin pasa por aquí: solo entra is_admin (gate de app). La base además
// solo deja a admins LEER datos de otras usuarias (RLS) — cinturón y tirantes.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <span className="text-sm font-semibold text-ink">
            stailist <span className="text-muted">· admin</span>
          </span>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
