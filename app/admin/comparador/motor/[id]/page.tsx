import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { cargarCorridaMotor } from "@/lib/comparador/motor-servidor";
import { marcadorMotor, estimadoMotor } from "@/lib/comparador/motor";
import { GenerarClient } from "./generar-client";
import { VotarClient, type ParParaVotar } from "./votar-client";
import { MarcadorMotorView } from "./marcador-motor";

export const dynamic = "force-dynamic";

// La corrida de motor en sus tres momentos: generar (por bloques, abortable),
// votar a ciegas, y el marcador con el reveal. La fase se decide por los DATOS
// (qué falta por generar, qué falta por votar), no por el estado guardado:
// así recargar a media corrida siempre cae donde ibas.
export default async function CorridaMotor({
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
  const reales = corrida.pares.filter((p) => !p.repiteDe);

  // Qué lados faltan por generar (los espejos no generan: heredan).
  const trabajos = reales.flatMap((p) =>
    claves
      .filter((c) => !p.lados.some((l) => l.variante === c))
      .map((variante) => ({ parId: p.id, variante, n: p.n }))
  );
  const totalLados = reales.length * 2;

  if (trabajos.length > 0 && corrida.estado === "corriendo") {
    return (
      <GenerarClient
        // Remonta el cliente cuando cambia lo pendiente (tras router.refresh):
        // sin esto, el estado local viejo (avance) recorta mal la lista nueva.
        key={`gen-${trabajos.length}`}
        corridaId={id}
        tamano={corrida.tamano}
        trabajos={trabajos}
        hechos={totalLados - trabajos.length}
        total={totalLados}
        estimado={estimadoMotor(claves, Math.ceil(trabajos.length / 2))}
      />
    );
  }

  // Votables: lados completos y con looks en ambos, sin voto todavía. Un par
  // donde una variante tronó no se puede comparar — queda como error en el
  // marcador, que también es un resultado.
  const votables = corrida.pares.filter(
    (p) =>
      p.voto === null &&
      claves.every((c) =>
        p.lados.some((l) => l.variante === c && (l.looks?.length ?? 0) > 0)
      )
  );

  if (votables.length > 0 && corrida.estado !== "cerrada") {
    const paraVotar: ParParaVotar[] = votables.map((p) => {
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
        // El evento en las palabras del brief. "evento" a secas no se puede
        // calificar: sin saber si es boda o cena con amigos, "no va para la
        // ocasión" es una marca que no se puede emitir.
        plan: p.brief.plan ?? null,
        formalidad: p.brief.formality ?? null,
        izq: lado(izqClave),
        der: lado(derClave),
        // Las claves van para que el try-on (que responde por variante) se
        // mapee a izquierda/derecha con el MISMO orden del ciego.
        claveIzq: izqClave,
        claveDer: derClave,
      };
    });

    return (
      <VotarClient
        corridaId={id}
        pares={paraVotar}
        yaHechos={corrida.pares.length - votables.length}
        total={corrida.pares.length}
        tamano={corrida.tamano}
      />
    );
  }

  // El marcador, SOLO cuando ya no queda nada por votar (verlo a media
  // revisión rompería el ciego) — o cuando la corrida se cerró.
  const notas = corrida.pares
    .filter((p) => p.nota)
    .map((p) => ({ n: p.n, etiqueta: p.brief.etiqueta, nota: p.nota! }));

  // Los comentarios por look, ya revelados a su variante: es la cosecha que
  // se lee para escribir reglas, y sin verla junta no sirve de nada.
  const etiquetaDe = new Map(corrida.variantes.map((v) => [v.clave, v.etiqueta]));
  const comentarios = corrida.pares.flatMap((p) =>
    Object.entries(p.comentariosLook ?? {}).flatMap(([clave, porIndice]) =>
      Object.entries(porIndice).map(([idx, texto]) => ({
        n: p.n,
        etiqueta: p.brief.etiqueta,
        variante: etiquetaDe.get(clave) ?? clave,
        look: Number(idx) + 1,
        marca: p.marcasLook?.[clave]?.[idx] ?? null,
        texto,
      }))
    )
  );

  return (
    <MarcadorMotorView
      corridaId={id}
      tamano={corrida.tamano}
      regla={corrida.regla}
      estado={corrida.estado}
      nota={corrida.nota}
      promptVersion={corrida.promptVersion}
      poolVersion={corrida.poolVersion}
      resultado={marcadorMotor(corrida.variantes, corrida.pares)}
      notas={notas}
      comentarios={comentarios}
      sinGenerar={Math.ceil(trabajos.length / 2)}
      marcasPendientes={
        corrida.pares.filter(
          (p) =>
            p.voto !== null &&
            !p.marcasLook &&
            claves.every((c) =>
              p.lados.some((l) => l.variante === c && (l.looks?.length ?? 0) > 0)
            )
        ).length
      }
    />
  );
}
