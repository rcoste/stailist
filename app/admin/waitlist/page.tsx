import { createClient } from "@/lib/supabase/server";
import { addToAllowlist } from "../allowlist/actions";

// Quién pidió entrar a la beta desde la landing (tabla waitlist). El admin ve la
// lista, de dónde vino cada quien y si ya está invitado (cruce con la allowlist),
// e invita con un clic — reusa addToAllowlist (mete el correo a la allowlist).
export default async function AdminWaitlist() {
  const supabase = await createClient();
  const [{ data: waitRows }, { data: allowRows }] = await Promise.all([
    supabase.from("waitlist").select("email, source, created_at").order("created_at", { ascending: false }),
    supabase.from("allowlist").select("email"),
  ]);

  const invitados = new Set((allowRows ?? []).map((r) => (r.email as string).toLowerCase()));
  const rows = (waitRows ?? []).map((r) => ({
    email: r.email as string,
    source: (r.source as string | null) ?? null,
    fecha: new Date(r.created_at as string).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    invitado: invitados.has((r.email as string).toLowerCase()),
  }));
  const pendientes = rows.filter((r) => !r.invitado).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-h2 font-semibold text-ink">Waitlist</h1>
        <p className="text-sm text-muted">
          {rows.length} pidieron entrar desde la landing ·{" "}
          {pendientes > 0 ? (
            <span className="font-medium text-ink">{pendientes} sin invitar</span>
          ) : (
            "todos invitados"
          )}
          .
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-6 text-center text-sm text-muted">
          Nadie se ha anotado todavía.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {rows.map((r) => (
            <div key={r.email} className="flex items-center justify-between gap-3 px-4 py-3">
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
    </div>
  );
}
