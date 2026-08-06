import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { cargarCorridaMotor } from "@/lib/comparador/motor-servidor";
import { MarcasClient, type ParParaMarcar } from "./marcas-client";

export const dynamic = "force-dynamic";

// Completar las marcas 👍/👎 de los pares que ya se votaron.
//
// Las marcas por look llegaron a mitad de una corrida y la primera mitad quedó
// sin ellas. El voto no se toca (eso es lo que sella el pre-registro); esto
// completa el DIAGNÓSTICO, que nunca fue la unidad del veredicto.
//
// SIGUE CIEGO: las columnas se muestran como "Look A/B" con el MISMO orden
// sembrado del par. Se sabe el marcador global, sí, pero no cuál columna es
// cuál en cada par — y eso es lo que mantiene las marcas honestas.
export default async function CompletarMarcas({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const corrida = await cargarCorridaMotor(id);

  if (!corrida) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">No encontré esa corrida.</p>
        <Link href="/admin/comparador" className="text-sm font-semibold text-accent">
          Volver
        </Link>
      </div>
    );
  }

  const claves = corrida.variantes.map((v) => v.clave);
  const pendientes = corrida.pares.filter(
    (p) =>
      p.voto !== null &&
      !p.marcasLook &&
      claves.every((c) =>
        p.lados.some((l) => l.variante === c && (l.looks?.length ?? 0) > 0)
      )
  );

  if (pendientes.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink">
          Todos los pares votados ya tienen sus marcas por look.
        </p>
        <Link
          href={`/admin/comparador/motor/${id}`}
          className="text-sm font-semibold text-accent"
        >
          Ver el marcador
        </Link>
      </div>
    );
  }

  const paraMarcar: ParParaMarcar[] = pendientes.map((p) => {
    const [izqClave, derClave] = corrida.ordenPorPar[p.id];
    const lado = (clave: string) => {
      const l = p.lados.find((x) => x.variante === clave)!;
      return (l.looks ?? []).map((o) => ({
        nombre: o.nombre,
        explicacion: o.explicacion,
        tip: o.tip ?? null,
        prendas: o.item_ids.map(
          (iid) =>
            corrida.prendas[iid] ?? {
              id: iid,
              nombre: "Prenda",
              swatch: "#E5E1DD",
              imagen: null,
            }
        ),
      }));
    };
    return {
      parId: p.id,
      n: p.n,
      etiqueta: p.brief.etiqueta,
      izq: lado(izqClave),
      der: lado(derClave),
    };
  });

  return <MarcasClient corridaId={id} pares={paraMarcar} />;
}
