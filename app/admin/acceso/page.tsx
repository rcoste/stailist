import { createClient } from "@/lib/supabase/server";
import {
  addToAllowlist,
  removeFromAllowlist,
  resendInvite,
} from "./actions";

// El embudo de acceso a la beta, completo en una pantalla: arriba quién pidió
// entrar desde la landing (waitlist), abajo quién ya está invitado (allowlist).
// Antes eran dos pestañas del nav — pero son dos momentos del MISMO flujo
// (pidieron entrar → invitadas → activas) y la acción que las une es una sola:
// "Invitar" mete el correo a la allowlist y dispara el correo de invitación.
export const dynamic = "force-dynamic";

// Fecha corta y humana para el estado de invitación ("invitado el 22 jul").
function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
}

export default async function AdminAcceso() {
  const supabase = await createClient();
  // Tres cruces: waitlist × allowlist (¿ya está invitado?) y allowlist ×
  // profiles (¿ya entró de verdad?). El admin puede leer profiles por RLS
  // (política "admin reads profiles", migración 0015).
  const [{ data: waitRows }, { data: allowData }, { data: profileData }] =
    await Promise.all([
      supabase
        .from("waitlist")
        .select("email, source, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("allowlist").select("email, invite_sent_at").order("email"),
      supabase.from("profiles").select("email"),
    ]);

  const allowRows = (allowData ?? []) as {
    email: string;
    invite_sent_at: string | null;
  }[];
  const invitados = new Set(allowRows.map((r) => r.email.toLowerCase()));
  const activos = new Set(
    (profileData ?? [])
      .map((p) => (p.email as string | null)?.toLowerCase())
      .filter(Boolean) as string[]
  );

  const espera = (waitRows ?? []).map((r) => ({
    email: r.email as string,
    source: (r.source as string | null) ?? null,
    fecha: new Date(r.created_at as string).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    invitado: invitados.has((r.email as string).toLowerCase()),
  }));
  const pendientes = espera.filter((r) => !r.invitado).length;
  const totalActivos = allowRows.filter((r) =>
    activos.has(r.email.toLowerCase())
  ).length;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-h2 font-semibold text-ink">Acceso a la beta</h1>
        <p className="text-sm text-muted">
          {espera.length} pidieron entrar desde la landing ·{" "}
          {pendientes > 0 ? (
            <span className="font-medium text-ink">{pendientes} sin invitar</span>
          ) : (
            "todos invitados"
          )}{" "}
          · {allowRows.length} en la allowlist · {totalActivos} ya activos.
        </p>
      </div>

      {/* ── Pidieron entrar (waitlist) ─────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Pidieron entrar
        </h2>
        {espera.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-6 text-center text-sm text-muted">
            Nadie se ha anotado todavía.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {espera.map((r) => (
              <div
                key={r.email}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm text-ink">{r.email}</span>
                  <span className="text-xs text-muted">
                    {r.fecha}
                    {r.source ? ` · ${r.source}` : ""}
                  </span>
                </div>
                {r.invitado ? (
                  <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                    ya invitado
                  </span>
                ) : (
                  <form action={addToAllowlist}>
                    <input type="hidden" name="email" value={r.email} />
                    <button
                      type="submit"
                      className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
                    >
                      Invitar
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Invitadas (allowlist) ──────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Invitadas
          </h2>
          <p className="text-xs text-muted">
            Agregar manda la invitación por correo automáticamente.
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
          {allowRows.map((row) => {
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
      </section>
    </div>
  );
}
