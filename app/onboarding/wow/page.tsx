import { getProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { routeForStep } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";
import { ASSESSMENT_QUESTIONS } from "@/lib/capsule";
import {
  ITEM_IMAGE_SELECT,
  itemImageUrlSync,
  itemPrivatePaths,
  type ItemImageRow,
} from "@/lib/item-image";
import { WowClient, type WowOutfit } from "./wow-client";
import { registrarEvento } from "@/lib/telemetria";

// El momento wow: 2-3 outfits generados con tu clóset, tus gustos y tu paleta.
// Acepta step 4 (recién terminó checklist) Y step 5 (la generación lo cerró
// mientras seguía en esta pantalla votando) — un reload no debe expulsarla
// a /hoy a media votación, pero pasos anteriores sí redirigen.
// NUNCA se regenera encima de outfits que ya existen: cada generación cuesta
// dinero, y recargar la página —o volver de hacerse el avatar— no debe disparar
// otra. La condición es "¿ya tiene looks?", no "¿terminó una generación?" (ver
// el bloque de abajo: son cosas distintas y confundirlas costó dos corridas).
export default async function WowPage({
  searchParams,
}: {
  // `look`: al volver del wizard de avatar, retomamos ESTE outfit (no el
  // selector). Cierra el bug de "construí mi avatar y me mandó a re-elegir".
  searchParams: Promise<{ look?: string }>;
}) {
  const { look: resumeLookId } = await searchParams;
  const profile = await getProfile();
  if (profile.onboarding_step < 4) {
    redirect(routeForStep(profile.onboarding_step));
  }

  const supabase = await createClient();

  // Nº real de prendas del clóset — alimenta las frases del "generando"
  // ("revisando tus N prendas…"). head:true → solo cuenta, no trae filas.
  // En paralelo con los outfits guardados (son independientes; sin waterfall).
  const countPromise = supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .is("deleted_at", null);

  // ¿YA TIENE OUTFITS? — ésa es la pregunta, y antes se hacía otra.
  //
  // La guarda estaba condicionada a `onboarding_step >= 5`, que se escribe al
  // FINAL del todo en /api/generate: después de generar, juzgar y registrar. Los
  // outfits, en cambio, se guardan MIENTRAS se transmiten. Entre una cosa y otra
  // hay una ventana en la que la persona ya tiene sus looks pero la base sigue
  // diciendo "paso 4" — y entonces esta página los ignora y regenera, cobrando
  // otra vez.
  //
  // No es teórico. Roberto, 2026-08-09: a las 15:17 se le generaron 2 outfits y
  // la corrida murió antes de la cola (cero eventos de critic_review y de
  // generation_timing, y el paso 5 sin escribir). Se fue a hacerse el avatar, y
  // al volver el wow le generó 3 más desde cero — dos generaciones pagadas para
  // una sola persona en su primer día.
  //
  // Preguntar por los outfits en vez de por el paso lo hace robusto a CUALQUIER
  // forma de morir a mitad: el juez que truena, el timeout de Vercel, la pestaña
  // que se cierra. Si hay looks guardados, se enseñan; no se regenera nunca
  // encima de trabajo que ya se pagó.
  let initialOutfits: WowOutfit[] | null = null;
  {
    const { data: saved } = await supabase
      .from("outfits")
      .select("id, item_ids, title, explanation, tryon_path")
      .eq("user_id", profile.id)
      .is("deleted_at", null)
      // Los de viaje no son su primer look: tienen su propia pantalla y
      // aparecerían aquí como si el wow los hubiera hecho.
      .is("trip_id", null)
      .order("created_at", { ascending: false })
      .limit(3);
    if (saved && saved.length > 0) {
      const itemIds = [...new Set(saved.flatMap((o) => o.item_ids as string[]))];
      // ITEM_IMAGE_SELECT y no solo "attrs": attrs.image_path SOLO existe en las
      // prendas del catálogo. Una foto propia guarda su imagen en
      // render_path/photo_path (bucket privado), así que leyendo attrs a secas
      // salían SIN imagen.
      const { data: items } = await supabase
        .from("items")
        .select(`id, ${ITEM_IMAGE_SELECT}`)
        .in("id", itemIds);

      const privadas = Array.from(
        new Set((items ?? []).flatMap((i) => itemPrivatePaths(i as ItemImageRow)))
      );
      const firmadas = new Map<string, string>();
      if (privadas.length > 0) {
        const { data: urls } = await supabase.storage
          .from("prendas")
          .createSignedUrls(privadas, 3600);
        urls?.forEach((u) => {
          if (u.path && u.signedUrl) firmadas.set(u.path, u.signedUrl);
        });
      }

      const attrsById = new Map(
        (items ?? []).map((i) => {
          const attrs = i.attrs as { nombre?: string; color_hex?: string };
          return [
            i.id,
            {
              nombre: attrs?.nombre,
              color_hex: attrs?.color_hex,
              imagen: itemImageUrlSync(i as ItemImageRow, (p) => firmadas.get(p)),
            },
          ];
        })
      );
      // Y SE CIERRA EL PASO, si la corrida que los hizo no llegó a cerrarlo.
      //
      // Sin esto, no regenerar convierte un bug de cobrar dos veces en uno peor:
      // quedarse atrapado. ONBOARDING_COMPLETE es 5, así que con el paso en 4 la
      // persona pulsa "entrar a la app", /hoy la rebota al wow, y otra vez —
      // para siempre. Lo que rompía ese bucle era precisamente la regeneración
      // que acabamos de quitar (a Roberto lo destrabó a las 16:36, cobrando).
      //
      // El `.eq("onboarding_step", 4)` lo hace idempotente: si ya está en 5, no
      // escribe nada y dos pestañas abiertas no se pisan.
      if (profile.onboarding_step === 4) {
        await supabase
          .from("profiles")
          .update({ onboarding_step: 5, updated_at: new Date().toISOString() })
          .eq("id", profile.id)
          .eq("onboarding_step", 4);
        // El embudo no puede quedarse ciego: sin este evento, quien llegó a su
        // primer look por esta puerta se vería como quien nunca llegó.
        await registrarEvento(supabase, {
          user_id: profile.id,
          type: "onboarding_step",
          data: { step: 5, via: "wow_reanudado" },
        });
      }

      initialOutfits = await Promise.all(
        saved.reverse().map(async (o) => {
          let tryon: string | null = null;
          if (o.tryon_path) {
            const { data: signed } = await supabase.storage
              .from("prendas")
              .createSignedUrl(o.tryon_path as string, 3600);
            tryon = signed?.signedUrl ?? null;
          }
          return {
            id: o.id,
            nombre: o.title ?? "Tu look",
            explicacion: o.explanation,
            tryon,
            prendas: (o.item_ids as string[]).map((id) => ({
              nombre: attrsById.get(id)?.nombre ?? "Prenda",
              swatch: attrsById.get(id)?.color_hex ?? "#E5E1DD",
              imagen: attrsById.get(id)?.imagen ?? null,
            })),
          };
        })
      );
    }
  }

  // El puente con el quiz de estilo de vida: allá describió la FORMA de su
  // semana ("oficina creativa o casual"), aquí se le pide el REGISTRO de su
  // ropa. Sin decirlo, la segunda pregunta se siente repetida.
  const life = (profile.lifestyle ?? {}) as Record<string, string>;
  const qTrabajo = ASSESSMENT_QUESTIONS.find((x) => x.id === "trabajo");
  const desdeElQuiz =
    (life.trabajo ?? "")
      .split(",")
      .map((v) => qTrabajo?.options.find((o) => o.value === v)?.label.toLowerCase())
      .filter(Boolean)
      .join(" / ") || null;

  return (
    <section className="flex flex-1 flex-col pt-4">
      {/* El chrome (barra de progreso + encabezados) lo controla el cliente por
          estado: en "choosing" muestra "Tus primeros looks", y al elegir uno
          conmuta a "hoy · nombre" (modo Hoy) — sin doble encabezado. */}
      <WowClient
        initialOutfits={initialOutfits}
        userId={profile.id}
        defaultObjective={profile.last_objective}
        gender={(profile.gender as "hombre" | "mujer" | null) ?? null}
        workDressCode={(profile.work_dress_code as string | null) ?? null}
        desdeElQuiz={desdeElQuiz}
        hasAvatar={!!profile.avatar_path}
        closetCount={(await countPromise).count ?? 0}
        resumeLookId={resumeLookId ?? null}
      />
    </section>
  );
}
