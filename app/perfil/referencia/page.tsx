import Link from "next/link";
import { requireOnboarded } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { returnLabel, safeReturn } from "@/lib/return-to";
import { StyleReferenceCard, type StyleRef } from "@/components/style-reference-card";

// "Afina tu estilo" con ruta propia. Antes esta feature vivía enterrada en un tab
// de Perfil (y en un beat del onboarding que sacaba de contexto). Ahora es un
// destino de primera clase: el checklist de Home linkea aquí. Reusa la misma
// StyleReferenceCard (subir 1-3 fotos → veredicto honesto → guardar).
export const maxDuration = 60;

export default async function PerfilReferenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ return?: string }>;
}) {
  const profile = await requireOnboarded();
  // `?return=/hoy` cuando se llega desde el checklist de Home (ver lib/return-to).
  const { return: ret } = await searchParams;
  const returnTo = safeReturn(ret);

  // Firma las fotos de referencia (bucket privado) para las miniaturas — mismo
  // patrón que app/perfil/page.tsx.
  const sr = profile.style_reference;
  let styleReference: StyleRef | null = null;
  if (sr) {
    const paths = Array.isArray(sr.image_paths)
      ? sr.image_paths
      : sr.image_path
        ? [sr.image_path]
        : [];
    const supabase = await createClient();
    const { data } = paths.length
      ? await supabase.storage.from("prendas").createSignedUrls(paths, 3600)
      : { data: [] };
    styleReference = {
      summary: sr.summary,
      tags: sr.tags ?? [],
      fit: sr.fit ?? null,
      images: (data ?? []).map((s) => s.signedUrl).filter((u): u is string => !!u),
      // Sin esto, "sumar foto" desde ESTA página mandaba keep:[] y las fotos que
      // ya tenías se quedaban fuera de la referencia guardada. En /perfil sí
      // viajaban; aquí no, y es justo la página a la que apunta el checklist.
      paths,
    };
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-bg px-4 py-4">
      <Link href={returnTo} className="text-sm font-medium text-muted hover:text-ink">
        ← {returnLabel(returnTo)}
      </Link>
      <div className="mb-5 mt-2 flex flex-col gap-1.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          tu estilo de referencia
        </p>
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">
          afina tu <em className="font-display font-normal italic">estilo</em>
        </h1>
      </div>

      {/* Mismos props que en Perfil: esta página y aquella card son la MISMA
          cosa, y cuando divergen se ven bugs de una sola pantalla (el texto
          libre salía vacío aunque estuviera guardado). */}
      <StyleReferenceCard
        initial={styleReference}
        styleWords={profile.style_words}
        tieneCapsula={!!profile.capsule_target}
        gender={profile.gender}
        conEtiqueta={false}
      />
    </div>
  );
}
