import { cookies } from "next/headers";
import { Logo } from "@/components/logo";
import { MarcaMenor } from "@/components/marca-menor";
import { enVerComo } from "@/lib/auth";
import { isMinor, type AgeRange } from "@/lib/edad";
import { COOKIE_ORIGEN } from "@/lib/origen";
import { guardarOrigenEnPerfil } from "@/lib/origen-perfil";
import { createClient } from "@/lib/supabase/server";

// Cascarón del onboarding: sin tabs (todavía no hay a dónde ir), logo arriba,
// columna única móvil-first como el resto de la app.
//
// Y dos cosas de la campaña de anuncios, con lo que sabe el PERFIL y no lo que
// recuerde el navegador:
// - La marca que apaga las etiquetas (components/marca-menor.tsx) cuando la
//   cuenta es de 13-17 años, o cuando quien mira es un admin en "ver como" (su
//   navegador no puede cargar etiquetas ni mandar conversiones por otra cuenta).
// - Copiar el origen del anuncio al perfil si todavía no lo tiene. /onboarding/
//   genero lo hace en la primera visita, pero redirige en cuanto hay género, así
//   que un intento fallido ahí no se reintentaba nunca; aquí se reintenta en la
//   carga completa de cualquier pantalla del onboarding.
//
// Consulta directa y sin redirecciones: getProfile manda a otras pantallas
// según el paso, y un layout que redirige dentro de su propio segmento es un
// bucle esperando a pasar.
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const verComo = await enVerComo();
  let menor = false;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("age_range, origen")
      .eq("id", user.id)
      .maybeSingle();
    menor = isMinor((data?.age_range ?? null) as AgeRange | null);
    if (data && !verComo) {
      await guardarOrigenEnPerfil(supabase, user.id, data.origen, (await cookies()).get(COOKIE_ORIGEN)?.value);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-bg">
      {menor || verComo ? <MarcaMenor /> : null}
      <header className="flex items-center justify-center px-4 pt-4 pb-2">
        <Logo className="h-7" />
      </header>
      <main className="flex flex-1 flex-col px-4 pb-8">{children}</main>
    </div>
  );
}
