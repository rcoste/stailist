import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { VIEW_AS_COOKIE } from "@/lib/auth";

// Barra fija del modo "ver como": recuerda al admin que está viendo la app
// con los datos de otra persona (solo lectura) y le da la salida. Vive en el
// root layout; sin cookie no cuesta nada (return null antes de tocar la DB).
export async function ViewAsBanner() {
  const viewAs = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  if (!viewAs) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Solo un admin real ve el banner (una cookie huérfana en una sesión normal
  // no muestra nada — y el proxy igual estaría bloqueando sus POSTs, así que
  // el link de salir del banner es también su remedio si eso pasara).
  const { data: me } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!me?.is_admin) return null;

  const { data: target } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", viewAs)
    .single();

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-ink px-4 py-2 text-bg">
      <span className="truncate text-xs">
        👁 viendo como <strong>{target?.email ?? "usuario"}</strong> · solo lectura
      </span>
      <a
        href="/admin/ver-como/salir"
        className="shrink-0 rounded-sm border border-bg/40 px-3 py-1 text-xs font-medium transition-colors duration-200 hover:bg-bg/10"
      >
        salir
      </a>
    </div>
  );
}
