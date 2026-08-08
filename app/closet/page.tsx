import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AddSheet } from "@/components/add-sheet";
import { BackfillImagesButton } from "@/components/backfill-images-button";
import { ClosetNav } from "@/components/closet-nav";
import { ClosetGrid, type ClosetItem } from "@/components/closet-grid";
import { AfinarPrendasCard } from "@/components/afinar-prendas-card";
import { preguntasPendientes, cuantasFaltan, type PrendaAfinable } from "@/lib/afinar-prendas";
import { ClosetLlenalo } from "@/components/closet-llenalo";
import { HintChain, type HintCandidato } from "@/components/hint";
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
        "id, source, certeza, created_at, photo_path, render_status, render_path, attrs, archetypes(name, category, image_path)"
      )
      .eq("user_id", profile.id)
      .is("deleted_at", null),
    loadLovedCounts(supabase, profile.id),
  ]);

  // QUÉ PRENDAS VALE LA PENA PREGUNTAR. Los usos salen de los looks reales: una
  // prenda que nunca entró a un outfit puede estar mal descrita sin
  // consecuencia, y preguntarla sería cobrar sin dar. Se lee aparte (no con un
  // join) porque item_ids es un array de texto y el conteo se hace en memoria
  // sobre unos cientos de filas — más simple que pelear con el operador.
  const { data: outfitsUsados } = await supabase
    .from("outfits")
    .select("item_ids")
    .eq("user_id", profile.id)
    .is("deleted_at", null);
  const usos = new Map<string, number>();
  for (const o of outfitsUsados ?? []) {
    for (const id of (o.item_ids as string[] | null) ?? []) {
      usos.set(id, (usos.get(id) ?? 0) + 1);
    }
  }
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

  // LAS PRENDAS AFINABLES VAN DESPUÉS DE FIRMAR, y no antes, porque la pregunta
  // necesita la IMAGEN. Roberto, viendo la card: "si me enseñaras una foto de
  // los jeans sería más fácil" — tiene tres pantalones oscuros y el nombre
  // "Jeans negros" no le decía cuál de todos. Una pregunta sobre una prenda que
  // no puedes identificar no se puede contestar bien; se contesta al azar, que
  // es peor que no preguntar (el motor se queda con un dato falso pero marcado
  // como confirmado).
  const afinables: PrendaAfinable[] = (rows ?? []).map((r) => {
    const a = (r.attrs ?? {}) as { nombre?: string; categoria?: string; corte?: string };
    const arch = r.archetypes as { name?: string; category?: string } | null;
    return {
      id: r.id as string,
      nombre: arch?.name ?? a.nombre ?? "Prenda",
      // La categoría se resuelve igual que en el motor: la del arquetipo cuenta
      // cuando la prenda no la trae (2 de cada 3 del catálogo no la copian).
      categoria: a.categoria ?? arch?.category ?? null,
      certeza: (r.certeza as string | null) ?? null,
      corte: a.corte ?? null,
      confirmados: Array.isArray((r.attrs as { confirmados?: unknown })?.confirmados)
        ? ((r.attrs as { confirmados: string[] }).confirmados)
        : [],
      usos: usos.get(r.id as string) ?? 0,
      imagen: itemImageUrlSync(r as ItemImageRow, (p) => signed.get(p)),
    };
  });
  const preguntas = preguntasPendientes(afinables);
  const faltan = cuantasFaltan(afinables);

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
      corte?: string;
      confirmados?: string[];
      conjunto?: string;
    };
    return {
      id: r.id as string,
      // LO QUE LA PRENDA DECLARA GANA sobre lo que hereda del catálogo — el
      // mismo orden que ya usaba el motor (categoriaDeItem), que aquí estaba al
      // revés. Con la ficha abierta a todas las prendas eso dejaba de ser un
      // detalle: renombrabas un básico, se guardaba, y en pantalla seguía el
      // nombre del arquetipo. Hoy el cambio es invisible (los 670 nombres
      // propios son idénticos al del arquetipo); en cuanto alguien edite, no.
      nombre: attrs.nombre ?? arch?.name ?? "Prenda",
      imagen: itemImageUrlSync(r as ItemImageRow, (p) => signed.get(p)),
      swatch: attrs.color_hex ?? "#E5E1DD",
      category: attrs.categoria ?? arch?.category ?? attrs.tipo ?? "accesorio",
      formalidad: attrs.formalidad ?? "casual",
      temporada: attrs.temporada ?? "todo-el-año",
      material: attrs.material ?? "",
      patron: attrs.patron ?? "",
      colorSecundario: attrs.color_secundario ?? "",
      source: (r.source as string) ?? "archetype",
      renderStatus: (r.render_status as string) ?? "none",
      corte: attrs.corte ?? "",
      // El lazo del traje: mismo id en el saco y en su pantalón.
      conjunto: attrs.conjunto ?? "",
      // Para poder decir en la ficha si el corte es dato o suposición nuestra.
      corteConfirmado: Array.isArray(attrs.confirmados)
        ? attrs.confirmados.includes("corte")
        : false,
      // Para poder ver el clóset por lo recién añadido. El orden por defecto
      // sigue siendo "tus queridas primero"; esto es la otra vista.
      creadoEn: (r.created_at as string) ?? "",
    };
  });

  // ¿Ya sumó ropa propia (foto)? Si no, el clóset son puros básicos asumidos →
  // aclaramos que es un punto de arranque. Si ya personalizó, no lo regañamos.
  const hasOwnPhotos = (rows ?? []).some((r) => r.source === "photo");

  // Progressive: orientación (las pestañas) primero; luego la función de agregar
  // ropa real, solo si aún no ha subido fotos (a quien ya lo hizo no lo regañamos).
  // Se muestra el primero que encuentre su target (ver HintChain), no el
  // primero a secas: así un tip sin target no entierra al que va detrás.
  const seenH = profile.hints_seen ?? {};
  const candidatos: HintCandidato[] = [];
  // Va PRIMERO cuando aplica, por delante de la orientación: explica un cambio
  // que acaba de pasar en la pantalla, y ese momento se pierde si se posterga
  // una visita. La orientación de las pestañas puede esperar.
  if (hasOwnPhotos && !seenH["closet-boton-agregar"]) {
    candidatos.push({
      id: "closet-boton-agregar",
      children: (
        <>
          ya subiste lo tuyo, así que quité el bloque de arriba —{" "}
          <strong>desde aquí</strong> le sumas más ropa cuando quieras
        </>
      ),
    });
  }
  if (!seenH["closet-tabs"]) {
    candidatos.push({
      id: "closet-tabs",
      children: (
        <>
          aquí también viven tus <strong>esenciales</strong> (el clóset ideal para tu
          vida) y tu <strong>wishlist</strong> — toca para verlas
        </>
      ),
    });
  }
  // Aquí había un segundo tip, "closet-agregar", que señalaba el botón
  // "agregar" para anunciar las tres formas de sumar ropa. Se retiró junto con
  // ClosetLlenalo: ese bloque PONE las tres formas en la pantalla, así que el
  // tip explicaba lo que ya se ve.

  // El bloque de "llénalo" solo si el clóset es puro catálogo Y las fotos no
  // están bloqueadas: a una menor sin permiso no se le ofrecen dos caminos que
  // no puede tomar (su aviso propio ya está arriba y le deja el catálogo).
  const mostrarLlenalo = !hasOwnPhotos && !fotosBloqueadas(profile);

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
              {/* Con el bloque de "llénalo" a la vista, "básicos para arrancar"
                  sobra: ese bloque ya dice —con más fuerza— que el clóset es
                  prestado. Sin el bloque (fotos bloqueadas) la etiqueta sigue
                  siendo el único lugar que lo aclara. */}
              {hasOwnPhotos || mostrarLlenalo
                ? `${items.length} ${items.length === 1 ? "prenda" : "prendas"}`
                : `${items.length} básicos para arrancar`}
            </p>
          </div>
          {/* Uno de los dos, nunca los dos: con el bloque de tres opciones
              arriba de la reja, este botón abría una hoja con lo que ya estaba
              desplegado abajo — y siendo el elemento más fuerte de la pantalla,
              dejaba la jerarquía al revés. Cuando el bloque se retira (primera
              foto propia), el botón vuelve y es la puerta permanente; el tip
              "closet-boton-agregar" avisa del relevo. "más → añadir prendas"
              está en los dos estados, así que nunca hay un momento sin salida. */}
          {mostrarLlenalo ? null : <AddSheet userId={profile.id} />}
        </div>

        <ClosetNav />

        {/* Hints contextuales (una por visita): orientación de pestañas, luego
            la función de sumar tu ropa real. */}
        <HintChain candidatos={candidatos} />

        {/* Mientras el clóset sea puro catálogo, las tres formas de sumar ropa
            van desplegadas aquí en vez de escondidas tras "agregar". */}
        {mostrarLlenalo ? <ClosetLlenalo userId={profile.id} /> : null}

        {preguntas.length > 0 ? (
          <AfinarPrendasCard preguntas={preguntas} faltan={faltan} />
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
