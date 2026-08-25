import Link from "next/link";
import {
  resumenPorEstilo,
  referenciasDeEstilo,
  discrepancias,
} from "@/lib/destilador";
import { VALIDADOS } from "@/lib/destilador-tipos";
import { DestiladorClient } from "./destilador-client";
import { RevisionClient } from "./revision-client";

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
  const [resumen, pendientesRevision] = await Promise.all([
    resumenPorEstilo("hombre"),
    discrepancias("hombre"),
  ]);

  // La revisión gana sobre la curaduría normal: es trabajo de corrección sobre
  // material ya juzgado, y dejarlo para después significa destilar con el
  // recorte sesgado.
  if (estilo === "revision") {
    return (
      // Sin párrafo de contexto: son tres botones que hay que leer y en el
      // celular cada línea de más los empuja fuera de la pantalla. El porqué ya
      // va en la tarjeta de cada foto, que es donde se necesita.
      <RevisionClient items={pendientesRevision} />
    );
  }
  // Por defecto abre donde HAY trabajo. Si ya no queda nada pendiente en ningún
  // estilo, no se abre ninguno: el panel de arriba dice el estado y el swipe
  // vacío solo confundiría.
  const conPendientes = resumen.find((r) => r.juzgadas < r.total)?.estilo;
  const activo = estilo ?? conPendientes ?? null;
  const referencias = activo ? await referenciasDeEstilo("hombre", activo) : [];

  if (!resumen.length) {
    return (
      <p className="text-sm text-muted">
        No hay referencias cargadas. Súbelas con{" "}
        <code>node scripts/subir-referencias.mjs</code>.
      </p>
    );
  }

  const faltan = resumen.reduce((n, r) => n + (r.total - r.juzgadas), 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Estado de un vistazo. Sin esto había que acordarse de qué estilo estaba
          cerrado y cuál no, y eso no es un estado del sistema — es memoria. */}
      <div className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
        {resumen.map((r) => {
          const pendientes = r.total - r.juzgadas;
          const validado = VALIDADOS.has(r.estilo);
          return (
            // El activo se resalta: sin esto, el panel decía cuántas faltan en
            // cada estilo pero no en cuál estabas parado, y el contador de abajo
            // ("1 de 34") no dice de qué.
            <div
              key={r.estilo}
              className={`flex items-center justify-between gap-3 px-3 py-2 ${
                r.estilo === activo ? "bg-accent-soft" : ""
              }`}
            >
              {/* El conteo se esconde en el celular: es dato de apoyo y cada
                  línea extra empuja los botones de decisión fuera de la
                  pantalla, que es el problema que este panel vino a resolver. */}
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-sm font-medium text-ink">
                  {r.estilo === activo && <span className="mr-1">▸</span>}
                  {r.estilo}
                </span>
                <span className="hidden text-xs text-muted sm:inline">
                  {r.sirven} sirven de {r.juzgadas}
                </span>
              </div>
              {pendientes > 0 ? (
                <Link
                  href={`/admin/destilador?estilo=${r.estilo}`}
                  className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-bg"
                >
                  faltan {pendientes}
                </Link>
              ) : (
                <span className="shrink-0 text-xs font-medium text-muted">
                  {validado ? "✓ listo y aprobado" : "✓ curado"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {faltan === 0 && pendientesRevision.length === 0 && (
        <p className="rounded-lg border border-line bg-surface p-3 text-sm text-muted">
          No queda nada por curar. Avísame y destilo lo que falte.
        </p>
      )}

      {pendientesRevision.length > 0 && (
        <Link
          href="/admin/destilador?estilo=revision"
          className="self-start rounded-full bg-ink px-3 py-1.5 text-sm font-medium text-bg"
        >
          revisar {pendientesRevision.length} discrepancias
        </Link>
      )}

      {/* El swipe solo si hay algo que juzgar. Los chips de estilo se quitaron:
          duplicaban el panel de arriba, que ya dice el estado y lleva al que
          falta. Dos formas de navegar a lo mismo era parte de la confusión. */}
      {activo && referencias.length > 0 && (
        <DestiladorClient
          key={activo}
          referencias={referencias}
          estilo={activo}
        />
      )}
    </div>
  );
}
