import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AddSheet } from "@/components/add-sheet";
import { BackfillImagesButton } from "@/components/backfill-images-button";
import { ClosetNav } from "@/components/closet-nav";
import { ClosetGrid, type ClosetItem } from "@/components/closet-grid";
import { Hint } from "@/components/hint";
import { requireOnboarded } from "@/lib/auth";
import { fotosBloqueadas } from "@/lib/edad";
import { createClient } from "@/lib/supabase/server";
import { itemImageUrlSync, type ItemImageRow } from "@/lib/item-image";
import { loadLovedCounts, sortLovedFirst } from "@/lib/loved-items";

export default async function ClosetPage() {
  const profile = await requireOnboarded();

  const supabase = await createClient();
  const [{ data: rows }, loved] = await Promise.all([
    supabase
      .from("items")
      .select(
        "id, source, photo_path, render_status, render_path, attrs, archetypes(name, category, image_path)"
      )
      .eq("user_id", profile.id)
      .is("deleted_at", null),
    loadLovedCounts(supabase, profile.id),
  ]);

  // Las fotos propias y los renders viven en el bucket privado → URL firmada para
  // mostrarlas. Juntamos ambos paths en una sola petición de firmas.
  const photoPaths = Array.from(
    new Set(
      (rows ?? [])
        .flatMap((r) => [r.photo_path as string | null, r.render_path as string | null])
        .filter((p): p is string => !!p)
    )
  );
  const signed = new Map<string, string>();
  if (photoPaths.length > 0) {
    const { data } = await supabase.storage
      .from("prendas")
      .createSignedUrls(photoPaths, 3600);
    data?.forEach((s) => {
      if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl);
    });
  }

  // Resuelve nombre/imagen/categoría: del arquetipo si lo hay, si no de attrs
  // (las fotos propias usan la URL firmada y la categoría que confirmó la usuaria).
  // Orden: tus queridas primero (las de outfits favoritos/usados) — solo visual.
  const items: ClosetItem[] = sortLovedFirst(
    rows ?? [],
    loved
  ).map((r) => {
    const arch = r.archetypes as {
      name?: string;
      category?: string;
      image_path?: string | null;
    } | null;
    const attrs = r.attrs as {
      nombre?: string;
      image_path?: string | null;
      color_hex?: string;
      categoria?: string;
      tipo?: string;
      formalidad?: string;
      temporada?: string;
      material?: string;
      patron?: string;
      color_secundario?: string;
    };
    return {
      id: r.id as string,
      nombre: arch?.name ?? attrs.nombre ?? "Prenda",
      imagen: itemImageUrlSync(r as ItemImageRow, (p) => signed.get(p)),
      swatch: attrs.color_hex ?? "#E5E1DD",
      category: arch?.category ?? attrs.categoria ?? attrs.tipo ?? "accesorio",
      formalidad: attrs.formalidad ?? "casual",
      temporada: attrs.temporada ?? "todo-el-año",
      material: attrs.material ?? "",
      patron: attrs.patron ?? "",
      colorSecundario: attrs.color_secundario ?? "",
      source: (r.source as string) ?? "archetype",
      renderStatus: (r.render_status as string) ?? "none",
    };
  });

  // ¿Ya sumó ropa propia (foto)? Si no, el clóset son puros básicos asumidos →
  // aclaramos que es un punto de arranque. Si ya personalizó, no lo regañamos.
  const hasOwnPhotos = (rows ?? []).some((r) => r.source === "photo");

  // Progressive: orientación (las pestañas) primero; luego la función de agregar
  // ropa real, solo si aún no ha subido fotos (a quien ya lo hizo no lo regañamos).
  const seenH = profile.hints_seen ?? {};
  const closetHint = !seenH["closet-tabs"]
    ? "closet-tabs"
    : !hasOwnPhotos && !seenH["closet-agregar"]
      ? "closet-agregar"
      : null;

  return (
    <AppShell desktop="wide">
      <section className="flex flex-col gap-4 pt-1">
        {fotosBloqueadas(profile) ? (
          <p className="border border-line bg-surface px-4 py-3 text-[13px] leading-snug text-muted">
            Puedes armar tu clóset con las prendas del catálogo. Subir{" "}
            <b className="text-ink">fotos de tu ropa</b> se desbloquea cuando tus
            papás o tutores confirmen el permiso —{" "}
            <Link href="/perfil" className="font-bold text-ink underline">
              reenvíales el link desde tu Perfil
            </Link>
            .
          </p>
        ) : null}
        {/* Header: tu ropa primero — título + conteo a la izquierda, un solo
            botón "Agregar" a la derecha (abre la hoja con las 3 formas). */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[30px] font-bold leading-none tracking-[-0.025em] text-ink">
              clóset
            </h1>
            <p className="mt-1.5 text-[13px] text-muted">
              {hasOwnPhotos
                ? `${items.length} ${items.length === 1 ? "prenda" : "prendas"}`
                : `${items.length} básicos para arrancar`}
            </p>
          </div>
          <AddSheet userId={profile.id} />
        </div>

        <ClosetNav />

        {/* Hints contextuales (una por visita): orientación de pestañas, luego
            la función de sumar tu ropa real. */}
        {closetHint === "closet-tabs" ? (
          <Hint id="closet-tabs">
            aquí también viven tu <strong>cápsula</strong> (el clóset ideal para
            tu vida) y tu <strong>wishlist</strong> — toca para cambiarte
          </Hint>
        ) : null}
        {closetHint === "closet-agregar" ? (
          <Hint id="closet-agregar">
            súmale tu ropa real con una foto — tus looks se vuelven 100% tuyos
          </Hint>
        ) : null}

        <ClosetGrid items={items} />

        {/* Descubrimiento evergreen: la biblioteca no es solo "dar de alta" —
            también es catálogo (guardarropas de stylists). Entrada explícita
            para que se explore, no solo se use desde "agregar". */}
        <Link
          href="/closet/biblioteca"
          className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 transition-colors hover:border-ink"
        >
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-ink">
              Descubre — guardarropas de stylists
            </span>
            <span className="text-[12.5px] text-muted">
              chismea clósets curados y guarda lo que te late
            </span>
          </span>
          <span className="shrink-0 text-muted">→</span>
        </Link>

        {profile.is_admin ? <BackfillImagesButton /> : null}
      </section>
    </AppShell>
  );
}
