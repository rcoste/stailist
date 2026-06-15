import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditArchetype, type ArchetypeRow } from "./edit-form";

export default async function AdminEditArchetype({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("archetypes")
    .select("id, slug, name, category, segment, attrs, image_path, sort_order")
    .eq("id", Number(id))
    .single();
  if (!data) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/catalogo" className="text-sm text-muted hover:text-ink">
        ← Catálogo
      </Link>
      <h1 className="text-h2 font-semibold text-ink">{data.name}</h1>
      <EditArchetype archetype={data as ArchetypeRow} />
    </div>
  );
}
