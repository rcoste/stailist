import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import { fechaLegible, yaVencio } from "@/lib/borrado-programado";
import { recuperarCuenta, seguirConElBorrado } from "./actions";

// LA PANTALLA DE UNA CUENTA CON BORRADO PROGRAMADO (lib/borrado-programado.ts).
//
// Es a donde lleva cualquier pantalla de la app mientras la cuenta está en sus
// 30 días. No usa getProfile a propósito: getProfile manda aquí, y usarlo sería
// un bucle. Se decide con dos botones y ninguno es automático: entrar no
// recupera la cuenta sola — alguien puede entrar justo para confirmar que se va.
export default async function CuentaProgramadaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("borrado_programado_para")
    .eq("id", user.id)
    .maybeSingle();
  if (!data?.borrado_programado_para) redirect("/");
  const para = new Date(data.borrado_programado_para as string);
  const fecha = fechaLegible(para);
  // Pasado el plazo ya no se recupera (recuperarCuenta aplica la misma regla
  // del lado del servidor): la limpieza diaria puede estar a media tarea.
  const vencida = yaVencio(para);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center gap-8 bg-bg px-4 pb-16">
      <header className="flex flex-col items-center gap-6">
        <Logo className="h-10" />
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-display font-semibold text-ink">
            {vencida ? "tu cuenta ya se está borrando" : `tu cuenta se borra el ${fecha}`}
          </h1>
          <p className="text-base text-muted">
            {vencida
              ? `el plazo terminó el ${fecha} y ya no se puede recuperar.`
              : "pediste borrarla. hasta ese día todo sigue aquí — tu clóset, tus looks, tus fotos — y lo puedes recuperar tal cual."}
          </p>
        </div>
      </header>

      {error ? (
        <p className="text-center text-sm text-error">
          no pude recuperar tu cuenta — inténtalo de nuevo o escríbenos a hola@stailist.co.
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {vencida ? null : (
          <form action={recuperarCuenta}>
            <button
              type="submit"
              className="flex min-h-12 w-full items-center justify-center rounded-sm bg-accent text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
            >
              recuperar mi cuenta
            </button>
          </form>
        )}
        <form action={seguirConElBorrado}>
          <button
            type="submit"
            className="min-h-12 w-full rounded-sm border border-line bg-surface text-sm font-medium text-ink transition-colors duration-200 hover:border-ink"
          >
            {vencida ? "salir" : "seguir con el borrado"}
          </button>
        </form>
      </div>
    </div>
  );
}
