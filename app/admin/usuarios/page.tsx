import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ONBOARDING_COMPLETE } from "@/lib/onboarding";

type Row = {
  id: string;
  email: string;
  gender: string | null;
  onboarding_step: number;
  palette_season: string | null;
  is_admin: boolean;
  created_at: string;
};

export default async function AdminUsuarios() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, gender, onboarding_step, palette_season, is_admin, created_at")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-h2 font-semibold text-ink">Usuarios</h1>
        <p className="text-sm text-muted">{rows.length} perfiles.</p>
      </div>

      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {rows.map((r) => {
          const done = r.onboarding_step >= ONBOARDING_COMPLETE;
          return (
            <Link
              key={r.id}
              href={`/admin/usuarios/${r.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-200 hover:bg-bg"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-ink">
                  {r.email}
                  {r.is_admin ? (
                    <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-ink">
                      admin
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-muted">
                  {r.gender ?? "sin género"} · paleta {r.palette_season ?? "—"}
                </span>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  done
                    ? "bg-success/15 text-success"
                    : "bg-bg text-muted"
                }`}
              >
                {done ? "completo" : `paso ${r.onboarding_step}`}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
