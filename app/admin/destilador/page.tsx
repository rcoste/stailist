import Link from "next/link";
import { resumenPorEstilo, referenciasDeEstilo } from "@/lib/destilador";
import { DestiladorClient } from "./destilador-client";

// Curaduría de las fotos con las que se destila cada estilo (lib/engine/recetario.ts).
//
// El paso que reemplaza: antes el recetario se revisaba leyendo el texto
// destilado ("¿es cierto que el smart casual lleva la camisa abierta?"), y eso
// exige saber de moda para contestar. Aquí la pregunta es la que cualquiera
// puede contestar mirando: ¿esta foto es buen ejemplo del estilo o no?
export const dynamic = "force-dynamic";

export default async function AdminDestilador({
  searchParams,
}: {
  searchParams: Promise<{ estilo?: string }>;
}) {
  const { estilo } = await searchParams;
  const resumen = await resumenPorEstilo("hombre");
  // Por defecto se abre donde falta trabajo, no en el primero por orden
  // alfabético: quien entra viene a terminar, no a repasar.
  const activo =
    estilo ??
    resumen.find((r) => r.juzgadas < r.total)?.estilo ??
    resumen[0]?.estilo;
  const referencias = activo ? await referenciasDeEstilo("hombre", activo) : [];

  if (!resumen.length) {
    return (
      <p className="text-sm text-muted">
        No hay referencias cargadas. Súbelas con{" "}
        <code>node scripts/subir-referencias.mjs</code>.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Una fila con scroll, no wrap: en el celular cada fila extra empuja los
          botones de decisión abajo del fold. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {resumen.map((r) => (
          <Link
            key={r.estilo}
            href={`/admin/destilador?estilo=${r.estilo}`}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
              r.estilo === activo
                ? "bg-ink text-bg"
                : "border border-line text-muted"
            }`}
          >
            {r.estilo}{" "}
            <span className="opacity-60">
              {r.juzgadas}/{r.total}
            </span>
          </Link>
        ))}
      </div>

      <DestiladorClient
        key={activo}
        referencias={referencias}
        estilo={activo ?? ""}
      />
    </div>
  );
}
