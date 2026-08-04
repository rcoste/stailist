import Image from "next/image";
import datos from "@/lib/engine/barrido/inspo-revision.json";
import { createClient } from "@/lib/supabase/server";
import {
  ITEM_IMAGE_SELECT,
  itemImageUrlSync,
  itemPrivatePaths,
  type ItemImageRow,
} from "@/lib/item-image";

// Qué fotos vio el motor, qué armó con ellas y POR QUÉ.
//
// PARA QUÉ
// Roberto, después de juzgar el A/B a ciegas: "quiero ver cuál fue el outfit y
// las prendas que escogió, y la racional de por qué escogió las que escogió —
// me estás dando la mitad de la historia". Tenía razón: la primera versión
// listaba nombres de prendas y ya. Sin ver la prenda y sin leer el porqué, no se
// puede saber si el motor usó la foto, la ignoró o la entendió mal.
//
// EL FALLO QUE ESTA VISTA DESTAPA
// El selector filtra por familia, clima, paleta y silueta. NO por ocasión, que
// es exactamente lo que Roberto pidió ("que vayan acorde a la ocasión"). La
// biblioteca de 616 fotos no tiene ese campo: se etiquetó por estilo, clima,
// paleta y silueta, y nadie anotó si el look es de oficina, de diario o de
// noche. Así que para un evento de noche se le enseñaron looks casuales.
export const dynamic = "force-dynamic";

type Look = {
  look?: string;
  prendas?: string[];
  itemIds?: string[];
  explicacion?: string;
};
type Caso = {
  n: number;
  ocasion: string;
  temp: number;
  momento: string;
  fotos: { url: string; carpeta: string }[];
  conFotos: Look[];
  sinFotos: Look[];
};

const casos = datos.casos as Caso[];

// Las ocasiones donde una foto casual NO sirve de referencia. Lista corta a
// propósito: en diario casi cualquier look de calle vale.
const EXIGENTES = new Set(["oficina", "evento"]);

function Prendas({ l, urlDe }: { l: Look; urlDe: (id: string) => string | null }) {
  const piezas = (l.itemIds ?? []).map((id, i) => ({
    nombre: l.prendas?.[i] ?? id,
    foto: urlDe(id),
  }));
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3 first:border-0 first:pt-0">
      <p className="text-sm font-semibold text-ink">{l.look}</p>
      <div className="flex flex-wrap gap-1.5">
        {piezas.map((p, i) => (
          <figure key={`${p.nombre}-${i}`} className="flex w-[68px] flex-col gap-1">
            <div className="aspect-square overflow-hidden rounded-lg border border-line bg-surface">
              {p.foto ? (
                <Image
                  src={p.foto}
                  alt={p.nombre}
                  width={68}
                  height={68}
                  className="h-full w-full object-contain"
                  unoptimized
                />
              ) : (
                <span className="flex h-full items-center justify-center text-[9px] text-muted">
                  sin foto
                </span>
              )}
            </div>
            <figcaption className="text-[9px] leading-tight text-muted">{p.nombre}</figcaption>
          </figure>
        ))}
      </div>
      {/* El porqué que escribió el motor, tal cual. Es lo que delata si usó la
          foto: cuando la usa, la explicación suele hablar de la referencia. */}
      {l.explicacion ? (
        <p className="text-xs leading-relaxed text-muted">“{l.explicacion}”</p>
      ) : null}
    </div>
  );
}

export default async function AdminInspo() {
  const supabase = await createClient();

  // Todas las prendas de los 24 looks, firmadas de una vez.
  const ids = [
    ...new Set(
      casos.flatMap((c) =>
        [...c.conFotos, ...c.sinFotos].flatMap((l) => l.itemIds ?? [])
      )
    ),
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
      const { data } = await supabase.storage.from("prendas").createSignedUrls(toSign, 3600);
      for (const d of data ?? []) if (d.path && d.signedUrl) firmadas.set(d.path, d.signedUrl);
    }
    for (const f of filas) {
      const u = itemImageUrlSync(f, (p) => firmadas.get(p));
      if (u) urlDe.set(f.id, u);
    }
  }
  const resolver = (id: string) => urlDe.get(id) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <h1 className="text-lg font-semibold text-ink">
          Qué fotos vio el motor, qué armó y por qué
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          Arriba, las 3 fotos de la biblioteca que se le enseñaron. Abajo, los looks
          que armó viéndolas y los que armó sin verlas —con sus prendas y con la
          frase que él mismo escribió para explicarlos—. Todo lo demás fue idéntico.
        </p>
        <p className="text-sm leading-relaxed text-error">
          Ojo con las marcadas: para <span className="font-semibold">oficina</span> y{" "}
          <span className="font-semibold">evento</span> se le enseñaron fotos que no
          son de esa ocasión. El selector filtra por estilo, clima, colores y corte —
          no por ocasión, porque la biblioteca nunca se etiquetó con ese dato.
        </p>
      </div>

      {casos.map((c) => {
        const dudoso = EXIGENTES.has(c.ocasion);
        return (
          <section
            key={c.n}
            className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xs font-bold tabular-nums text-muted">#{c.n}</span>
              <span className="text-base font-semibold text-ink">
                {c.ocasion} · {c.temp}°C{c.momento === "noche" ? " · de noche" : ""}
              </span>
              {dudoso ? (
                <span className="rounded-full bg-error px-2 py-0.5 text-[11px] font-bold text-bg">
                  fotos sin filtrar por ocasión
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {c.fotos.map((f) => (
                <figure key={f.url} className="flex w-32 flex-col gap-1">
                  <div className="overflow-hidden rounded-lg border border-line bg-bg">
                    <Image
                      src={f.url}
                      alt={f.carpeta}
                      width={128}
                      height={171}
                      className="h-auto w-full object-cover"
                      unoptimized
                    />
                  </div>
                  <figcaption className="text-[10px] text-muted">{f.carpeta}</figcaption>
                </figure>
              ))}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="flex flex-1 flex-col gap-3 rounded-lg border border-line bg-bg p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-ink">
                  viendo las fotos
                </p>
                {c.conFotos.map((l, i) => (
                  <Prendas key={i} l={l} urlDe={resolver} />
                ))}
              </div>
              <div className="flex flex-1 flex-col gap-3 rounded-lg border border-line bg-bg p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  sin verlas
                </p>
                {c.sinFotos.map((l, i) => (
                  <Prendas key={i} l={l} urlDe={resolver} />
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
