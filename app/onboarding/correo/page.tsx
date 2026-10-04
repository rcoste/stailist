import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { marcarPaso } from "@/lib/embudo-marcas";
import { COOKIE_ORIGEN } from "@/lib/origen";
import { OnboardingProgress } from "@/components/onboarding-progress";
import { requireStep } from "@/lib/auth";
import { esBorrador } from "@/lib/borrador";
import { createClient } from "@/lib/supabase/server";
import { COLUMNA } from "../ancho";
import { CorreoForm } from "./correo-form";

// EL CORREO, JUSTO ANTES DEL PRIMER LOOK (ver lib/borrador.ts).
//
// POR QUÉ AQUÍ. La persona ya eligió su estilo, sus colores y sus básicos: lleva
// varios minutos invertidos y la recompensa está a veinte segundos. Y es el
// último punto donde nada ha costado dinero: armar el look es lo caro, y eso
// sólo pasa con el correo ya verificado.
//
// NO ES UN "STEP" de ONBOARDING_ROUTES (misma razón que acentos y la intro del
// clóset: meter uno correría la numeración). Vive entre el paso 3 y su
// pantalla: /onboarding/objetivo manda aquí a quien todavía no tiene correo.
//
// FUERA DE LA ZONA MEDIDA a propósito (lib/publicidad.ts, ZONA_MEDIDA): aquí hay
// un campo de correo, y el aviso de privacidad promete que las etiquetas de
// anuncios nunca ven uno. Por eso no se pidió en la pantalla del objetivo, que
// sí está medida.
export default async function CorreoPage() {
  await requireStep(3);
  const supabase = await createClient();
  if (!(await esBorrador(supabase))) redirect("/onboarding/objetivo");
  // "Llegó a la pantalla del correo", para el embudo del panel. Una vez por
  // borrador aunque recargue (lib/embudo-marcas.ts).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await marcarPaso("correo_visto", user.id, (await cookies()).get(COOKIE_ORIGEN)?.value);

  return (
    <section className={`flex flex-1 flex-col gap-6 pt-4 ${COLUMNA}`}>
      <OnboardingProgress step={4} />

      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">ya casi</p>
        <h1 className="text-[32px] font-bold leading-[1.02] tracking-[-0.025em] text-ink">
          ¿a dónde te lo{" "}
          <em className="font-display font-normal italic tracking-normal">guardo</em>?
        </h1>
        <p className="text-[15px] leading-snug text-muted">
          Tu estilo, tus colores y tu clóset ya están listos. Déjame tu correo para guardarlos y te armo tu primer
          look.
        </p>
      </div>

      <CorreoForm />

      <p className="text-center text-[13px] text-muted">
        ¿ya tenías cuenta?{" "}
        <a href="/login" className="font-semibold text-ink underline underline-offset-2">
          entra aquí
        </a>
      </p>
    </section>
  );
}
