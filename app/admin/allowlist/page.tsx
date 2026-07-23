import { createClient } from "@/lib/supabase/server";
import {
  addToAllowlist,
  removeFromAllowlist,
  resendInvite,
} from "./actions";

// Fecha corta y humana para el estado de invitación ("invitado el 22 jul").
function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
}

export default async function AdminAllowlist() {
  const supabase = await createClient();
  // Cruzamos la allowlist con los perfiles reales: un correo con perfil YA
  // entró a la app. Sirve para no reinvitar por error a quien ya la usa
  // (ocultamos su botón de invitar). El admin puede leer profiles por RLS
  // (política "admin reads profiles", migración 0015).
  const [{ data: allowData }, { data: profileData }] = await Promise.all([
    supabase.from("allowlist").select("email, invite_sent_at").order("email"),
    supabase.from("profiles").select("email"),
  ]);
  const rows = (allowData ?? []) as {
    email: string;
    invite_sent_at: string | null;
  }[];
  const activos = new Set(
    (profileData ?? [])
      .map((p) => (p.email as string | null)?.toLowerCase())
      .filter(Boolean) as string[]
  );

  const totalActivos = rows.filter((r) => activos.has(r.email.toLowerCase()))
    .length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-h2 font-semibold text-ink">Allowlist</h1>
        <p className="text-sm text-muted">
          {rows.length} correos invitados · {totalActivos} ya activos. Agregar
          manda la invitación por correo automáticamente.
        </p>
      </div>

      <form action={addToAllowlist} className="flex gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="correo@ejemplo.com"
          className="min-h-11 flex-1 rounded-full border border-line bg-surface px-4 text-sm text-ink outline-none focus-visible:border-accent"
        />
        <button
          type="submit"
          className="min-h-11 shrink-0 rounded-full bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
        >
          Agregar e invitar
        </button>
      </form>

      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {rows.map((row) => {
          const activo = activos.has(row.email.toLowerCase());
          return (
            <div
              key={row.email}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm text-ink">{row.email}</span>
                <span
                  className={`text-xs ${activo ? "text-success" : "text-muted"}`}
                >
                  {activo
                    ? "Ya activo"
                    : row.invite_sent_at
                      ? `Invitado el ${fmtFecha(row.invite_sent_at)}`
                      : "Sin invitación enviada"}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {/* A quien ya usa la app no le ofrecemos reinvitar: un
                    "¡Estás dentro!" a alguien que lleva semanas dentro se ve
                    raro. Solo queda "Quitar". */}
                {!activo && (
                  <form action={resendInvite}>
                    <input type="hidden" name="email" value={row.email} />
                    <button
                      type="submit"
                      className="rounded-full px-3 py-1 text-xs font-medium text-ink transition-colors duration-200 hover:bg-ink/5"
                    >
                      {row.invite_sent_at ? "Reenviar" : "Invitar"}
                    </button>
                  </form>
                )}
                <form action={removeFromAllowlist}>
                  <input type="hidden" name="email" value={row.email} />
                  <button
                    type="submit"
                    className="rounded-full px-3 py-1 text-xs font-medium text-error transition-colors duration-200 hover:bg-error/10"
                  >
                    Quitar
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
