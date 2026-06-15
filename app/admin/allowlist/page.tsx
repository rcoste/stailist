import { createClient } from "@/lib/supabase/server";
import { addToAllowlist, removeFromAllowlist } from "./actions";

export default async function AdminAllowlist() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("allowlist")
    .select("email")
    .order("email");
  const emails = (data ?? []).map((r) => r.email as string);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-h2 font-semibold text-ink">Allowlist</h1>
        <p className="text-sm text-muted">
          {emails.length} correos pueden registrarse en la beta.
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
          className="min-h-11 rounded-full bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
        >
          Agregar
        </button>
      </form>

      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {emails.map((email) => (
          <div
            key={email}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <span className="truncate text-sm text-ink">{email}</span>
            <form action={removeFromAllowlist}>
              <input type="hidden" name="email" value={email} />
              <button
                type="submit"
                className="shrink-0 rounded-full px-3 py-1 text-xs font-medium text-error transition-colors duration-200 hover:bg-error/10"
              >
                Quitar
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
