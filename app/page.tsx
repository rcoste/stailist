import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { routeForStep } from "@/lib/onboarding";
import { Landing } from "@/components/landing/landing";
import { datosEstructurados, preguntasEstructuradas, serializarParaScript } from "@/lib/ficha-publica";

// Lo que Google lee de la landing — y lo que Google Ads usa para calificar si la
// página corresponde al anuncio. El título del layout ("stailist") no decía qué
// es la app; éste sí, en la voz de la casa y sin prometer tiempos que no se
// sostienen (ver el comentario de la promesa en app/layout.tsx).
export const metadata: Metadata = {
  title: "stailist · tu stylist personal con IA",
  description:
    "Te armo outfits con la ropa que ya tienes, para tu día, tu clima y tus colores. Sube fotos de tu ropa y ve los looks puestos en ti. Sin tarjeta.",
  alternates: { canonical: "/" },
};

// "/" tiene doble cara:
//  - Deslogueada → la landing pública (marketing + el correo que lleva al login).
//  - Logueada → el router del journey: sin género → a elegirlo; onboarding
//    incompleto → tu paso pendiente; completo → Hoy. Así el código del correo y
//    el ícono de la PWA siempre aciertan.
export default async function RootPage({
  searchParams,
}: {
  // `g`: la versión de la landing con la que abre. La usan los anuncios
  // segmentados (stailist.co/?g=hombre): sin esto, un hombre que llega de un
  // anuncio para hombres veía a una modelo mujer, porque el default es mujer.
  searchParams: Promise<{ g?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const { g } = await searchParams;
    return (
      <>
        {/* Qué es stailist, sin ambigüedad, para buscadores y asistentes de IA
            (lib/ficha-publica.ts). Invisible para la persona. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializarParaScript([datosEstructurados(), preguntasEstructuradas()]),
          }}
        />
        <Landing generoInicial={g === "hombre" || g === "mujer" ? g : null} />
      </>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("gender, onboarding_step")
    .eq("id", user.id)
    .single();

  // Sesión sin profile (caso borde): que login lo resuelva.
  if (!profile) redirect("/login");
  if (!profile.gender) redirect("/onboarding/genero");
  redirect(routeForStep(profile.onboarding_step));
}
