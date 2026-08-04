import Image from "next/image";
import datos from "@/lib/engine/barrido/inspo-revision.json";

// Qué fotos vio el motor y qué armó con ellas.
//
// PARA QUÉ
// Roberto, después de juzgar el A/B a ciegas: "quiero entender qué imágenes
// tomaste para la inspo de cada uno de los outfits". Ver la foto al lado del
// look es lo único que dice si el motor la usó, la ignoró, o la usó mal — el
// veredicto ciego dice cuál look es mejor, no por qué.
//
// EL FALLO QUE ESTA VISTA DESTAPA
// El selector filtra por familia, clima, paleta y silueta. NO por ocasión, que
// es exactamente lo que Roberto pidió ("que vayan acorde a la ocasión"). La
// biblioteca de 616 fotos no tiene ese campo: se etiquetó por estilo, clima,
// paleta y silueta, y nadie anotó si el look es de oficina, de diario o de
// noche. Así que para un evento de noche se le enseñaron looks casuales.
export const dynamic = "force-dynamic";

type Look = { look?: string; prendas?: string[]; explicacion?: string };
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

// Las ocasiones donde una foto casual NO sirve de referencia. Es la lista corta
// a propósito: en diario casi cualquier look de calle vale.
const EXIGENTES = new Set(["oficina", "evento"]);

function Columna({ titulo, looks }: { titulo: string; looks: Look[] }) {
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-lg border border-line bg-bg p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{titulo}</p>
      {looks.map((l, i) => (
        <div key={i} className="flex flex-col gap-0.5 border-t border-line pt-2 first:border-0 first:pt-0">
          <p className="text-sm font-medium text-ink">{l.look}</p>
          <p className="text-xs text-muted">{l.prendas?.join(" + ")}</p>
        </div>
      ))}
    </div>
  );
}

export default function AdminInspo() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
        <h1 className="text-lg font-semibold text-ink">
          Qué fotos vio el motor, y qué armó con ellas
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          Arriba, las 3 fotos de la biblioteca que se le enseñaron. Abajo, lo que
          armó viéndolas y lo que armó sin verlas. Todo lo demás fue idéntico.
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
            className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
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
                <figure key={f.url} className="flex w-36 flex-col gap-1">
                  <div className="overflow-hidden rounded-lg border border-line bg-bg">
                    <Image
                      src={f.url}
                      alt={f.carpeta}
                      width={144}
                      height={192}
                      className="h-auto w-full object-cover"
                      unoptimized
                    />
                  </div>
                  <figcaption className="text-[10px] text-muted">{f.carpeta}</figcaption>
                </figure>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Columna titulo="viendo las fotos" looks={c.conFotos} />
              <Columna titulo="sin verlas" looks={c.sinFotos} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
