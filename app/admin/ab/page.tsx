import Image from "next/image";
import datos from "@/lib/engine/barrido/ab-pares.json";
import { createClient } from "@/lib/supabase/server";
import {
  ITEM_IMAGE_SELECT,
  itemImageUrlSync,
  itemPrivatePaths,
  type ItemImageRow,
} from "@/lib/item-image";
import { Veredicto } from "./veredicto";
import type { Eleccion } from "./actions";

// A/B CIEGO del recetario: dos versiones del motor, mismo caso, mismo clóset.
//
// LA PREGUNTA
// El recetario (v28+) reconstruyó el motor sobre 616 fotos destiladas, y ningún
// usuario real lo ha visto: los 155 outfits con votos son todos de v27 para
// atrás — 13 👍, 3 👎, 12 puestos. O sea que la única señal humana que existe en
// este proyecto es del motor VIEJO. Antes de seguir apilando encima hay que
// saber si el nuevo suma o resta.
//
// POR QUÉ EL JUEZ ES ROBERTO Y NO OTRA IA
// La revisora automática marcó tenis voluminosos donde había sandalias de cuero.
// Roberto la calificó par por par: 21 acertó / 4 exageró. Acierta el 84%, que
// alcanza para rastrear tendencias y no para decidir entre dos versiones.
//
// POR QUÉ A CIEGAS
// Ni la pantalla ni el JSON que la alimenta saben qué lado es cuál: la clave
// vive en docs_para_claude/ y no entra al bundle. Si viajara junta, bastaría
// abrir las herramientas del navegador para romper el ciego. Y el lado se sortea
// por par — sin eso, tres pares bastan para deducir el patrón y a partir de ahí
// el juicio ya no es sobre los looks.
export const dynamic = "force-dynamic";

type Lado = {
  titulo: string;
  explicacion?: string;
  itemIds?: string[];
  /** El look puesto sobre su avatar. Ausente si el render falló o no se generó. */
  tryon?: string;
  prendas: { nombre: string; foto: string | null }[];
};
type Par = {
  n: number;
  ctx: {
    perfil: string;
    closet: string;
    clima?: string;
    temp: number;
    ocasion: string;
    momento?: string;
    paleta: string;
  };
  izq: Lado;
  der: Lado;
};

const pares = datos.pares as Par[];

const PERFIL: Record<string, string> = {
  "preppy-puro": "le gusta el preppy",
  minimalista: "le gusta lo minimalista",
  street: "le gusta el street",
  deportivo: "le gusta lo deportivo",
  "clasico-arreglado": "le gusta lo clásico arreglado",
  caotico: "le gusta de todo un poco",
};
const CLOSET: Record<string, string> = {
  basicos: "clóset básico (18 prendas)",
  completo: "clóset completo (45 prendas)",
  hostil: "clóset pobre a propósito",
};

function Columna({
  lado,
  etiqueta,
  urlDe,
}: {
  lado: Lado;
  etiqueta: string;
  urlDe: (id: string) => string | null;
}) {
  // Los ids ganan sobre las fotos del JSON: en el modo del clóset propio las
  // imágenes son privadas y se firman al vuelo (ver la cabecera del archivo).
  const piezas = lado.itemIds?.length
    ? lado.itemIds.map((id, i) => ({
        nombre: lado.prendas[i]?.nombre ?? id,
        foto: urlDe(id),
      }))
    : lado.prendas;

  return (
    <div className="flex flex-1 flex-col gap-2 rounded-lg border border-line bg-bg p-3">
      <div className="flex items-baseline gap-2">
        <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold text-bg">
          {etiqueta}
        </span>
        <span className="text-sm font-medium text-ink">{lado.titulo}</span>
      </div>
      {/* El look PUESTO va primero: es lo que deja ver la proporción y si el
          conjunto se lee como outfit, que es la mitad que las fotos sueltas no
          muestran. Ojo con lo que prueba: el generador de imágenes no recibe la
          receta ni el tip, así que si abre un botón o dobla una manga es
          decisión suya, no del motor. */}
      {lado.tryon ? (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <Image
            src={lado.tryon}
            alt={`${lado.titulo} puesto`}
            width={320}
            height={427}
            className="h-auto w-full object-cover"
            unoptimized
          />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {piezas.map((p, i) => (
          <figure key={`${p.nombre}-${i}`} className="flex w-20 flex-col gap-1">
            <div className="aspect-square overflow-hidden rounded-lg border border-line bg-surface">
              {p.foto ? (
                <Image
                  src={p.foto}
                  alt={p.nombre}
                  width={80}
                  height={80}
                  className="h-full w-full object-contain"
                  unoptimized
                />
              ) : (
                <span className="flex h-full items-center justify-center text-[10px] text-muted">
                  sin foto
                </span>
              )}
            </div>
            <figcaption className="text-[10px] leading-tight text-muted">
              {p.nombre}
            </figcaption>
          </figure>
        ))}
      </div>
      {lado.explicacion ? (
        <p className="text-xs leading-relaxed text-muted">“{lado.explicacion}”</p>
      ) : null}
    </div>
  );
}

export default async function AdminAb() {
  const supabase = await createClient();

  // Las prendas que salen en los pares. Se cargan y se firman TODAS de una vez:
  // una petición a Storage por prenda se notaría al abrir la pantalla.
  const ids = [
    ...new Set(pares.flatMap((p) => [...(p.izq.itemIds ?? []), ...(p.der.itemIds ?? [])])),
  ];
  const urlDe = new Map<string, string>();
  if (ids.length) {
    const { data: items } = await supabase
      .from("items")
      .select(`id, ${ITEM_IMAGE_SELECT}`)
      .in("id", ids);
    const filas = (items ?? []) as unknown as (ItemImageRow & { id: string })[];
    const toSign = [...new Set(filas.flatMap(itemPrivatePaths))];
    const firmadas = new Map<string, string>();
    if (toSign.length) {
      const { data } = await supabase.storage
        .from("prendas")
        .createSignedUrls(toSign, 3600);
      for (const d of data ?? []) {
        if (d.path && d.signedUrl) firmadas.set(d.path, d.signedUrl);
      }
    }
    for (const f of filas) {
      const u = itemImageUrlSync(f, (p) => firmadas.get(p));
      if (u) urlDe.set(f.id, u);
    }
  }

  const { data: notas } = await supabase
    .from("ab_veredictos")
    .select("par_n, eleccion, comentario");
  const notaDe = new Map(
    (notas ?? []).map((n) => [
      n.par_n as number,
      n as { eleccion: Eleccion | null; comentario: string | null },
    ])
  );
  const juzgados = (notas ?? []).filter((n) => n.eleccion).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <h1 className="text-lg font-semibold text-ink">A/B a ciegas: ¿qué versión arma mejor?</h1>
        <p className="text-sm leading-relaxed text-muted">
          Cada fila es <span className="text-ink">la misma persona, el mismo clóset y el mismo día</span>,
          resuelto por dos versiones del motor. Una lleva las recetas de estilo
          destiladas de las 616 fotos; la otra no. Todo lo demás es idéntico.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          <span className="text-ink">No te digo cuál es cuál</span>, y el lado se
          sorteó en cada fila — así que no hay patrón que aprenderse. Solo dime
          cuál look te parece mejor. Si de verdad no se distinguen, “iguales”
          también es respuesta útil: si salen muchos empates, el cambio no se nota.
        </p>
        <p className="text-xs text-muted">
          {pares.length} pares · {juzgados} juzgados. De esto depende si seguimos
          por este camino o volvemos al motor de julio.
        </p>
      </div>

      {pares.map((p) => (
        <section
          key={p.n}
          className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-xs font-bold tabular-nums text-muted">#{p.n}</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                PERFIL[p.ctx.perfil] ?? p.ctx.perfil,
                CLOSET[p.ctx.closet] ?? p.ctx.closet,
                `${p.ctx.temp}°C`,
                ...(p.ctx.momento === "noche" ? ["de noche"] : []),
                `para: ${p.ctx.ocasion}`,
                `colorimetría ${p.ctx.paleta}`,
              ].map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-bg px-2.5 py-1 text-[11px] font-medium text-muted"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Columna lado={p.izq} etiqueta="A" urlDe={(id) => urlDe.get(id) ?? null} />
            <Columna lado={p.der} etiqueta="B" urlDe={(id) => urlDe.get(id) ?? null} />
          </div>

          <Veredicto
            parN={p.n}
            eleccion={notaDe.get(p.n)?.eleccion ?? null}
            comentario={notaDe.get(p.n)?.comentario ?? ""}
          />
        </section>
      ))}
    </div>
  );
}
