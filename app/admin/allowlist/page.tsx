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
  const { data } = await supabase
    .from("allowlist")
    .select("email, invite_sent_at")
    .order("email");
  const rows = (data ?? []) as { email: string; invite_sent_at: string | null }[];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-h2 font-semibold text-ink">Allowlist</h1>
        <p className="text-sm text-muted">
          {rows.length} correos invitados a la beta. Agregar manda la invitación
          por correo automáticamente.
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
        {rows.map((row) => (
          <div
            key={row.email}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm text-ink">{row.email}</span>
              <span className="text-xs text-muted">
                {row.invite_sent_at
                  ? `Invitado el ${fmtFecha(row.invite_sent_at)}`
                  : "Sin invitación enviada"}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <form action={resendInvite}>
                <input type="hidden" name="email" value={row.email} />
                <button
                  type="submit"
                  className="rounded-full px-3 py-1 text-xs font-medium text-ink transition-colors duration-200 hover:bg-ink/5"
                >
                  {row.invite_sent_at ? "Reenviar" : "Invitar"}
                </button>
              </form>
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
        ))}
      </div>
    </div>
  );
}
