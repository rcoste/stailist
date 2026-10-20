import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { MERCADOS, type Mercado } from "@/lib/vitrina-uniqlo";
import { pct, type ResumenMedicion } from "@/lib/evales/vitrina-medicion";
import { cargarCandidatos, cargarCorrida, listarCorridas, type CandidatoUI, type HuecoUI } from "@/lib/evales/vitrina-medicion-datos";
import { Chip, Cifra, Control, Encabezado, Fila, Filtros, Panel, Pestanas, Vacio } from "../_ui";
import { VotoCandidato } from "./voto-candidato";

// LA MEDICIÓN DE LA VITRINA DE UNIQLO (2026-10-21). Una pregunta: ¿las dos
// prendas que la vitrina enseña bajo cada hueco de la maleta son la pieza que
// pide el hueco? Arriba los tres números; abajo UN hueco a la vez —la pieza
// pedida a la izquierda, los 20 candidatos del mercado a la derecha— con las
// dos elegidas marcadas, el veredicto del juez y el voto de Roberto. El
// material lo produce scripts/vitrina-medicion.ts; aquí sólo se lee y se vota.

export const dynamic = "force-dynamic";

const ES_MERCADO = (m: string | undefined): m is Mercado => m === "us" || m === "jp" || m === "kr";

const MOTIVO: Record<string, string> = {
  genero: "otra sección",
  "ropa-interior": "ropa interior",
  "nombre-no-coincide": "el nombre no dice la prenda",
  manga: "otra manga",
  estampado: "liso/estampado al revés",
  cuello: "otro cuello",
  funcion: "no es impermeable",
  temporada: "de verano para frío",
  material: "no es de piel",
  "sin-precio": "sin precio",
  "sin-color": "fuera del color",
  "sin-foto": "sin foto del color",
  rating: "menor calificación",
};

export default async function VitrinaMedicionPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; h?: string; m?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const corridas = await listarCorridas();
  const corrida = corridas.find((x) => x.id === sp.c) ?? corridas[0];

  if (!corrida) {
    return (
      <>
        <Encabezado titulo="Medición de la vitrina" sub="Todavía no hay corridas." />
        <Panel>
          <Vacio>
            Corre <code className="text-ink">npx tsx scripts/vitrina-medicion.ts</code> para traer los huecos reales y los 20 candidatos de Uniqlo por mercado.
          </Vacio>
        </Panel>
      </>
    );
  }

  const datos = await cargarCorrida(corrida.id);
  if (!datos) {
    return (
      <>
        <Encabezado titulo="Medición de la vitrina" sub="La corrida no tiene huecos." />
      </>
    );
  }
  const { huecos, resumen, resumenPorMercado, costoJuezUsd } = datos;
  const mercado: Mercado = ES_MERCADO(sp.m) ? sp.m : "us";
  const hN = Math.min(Math.max(1, Number(sp.h) || 1), huecos.length);
  const hueco = huecos.find((h) => h.n === hN) ?? huecos[0];
  const candidatos = await cargarCandidatos(hueco.id, mercado);
  const url = (h: number, m: Mercado = mercado) => `/admin/vitrina-medicion?c=${corrida.id}&h=${h}&m=${m}`;
  const fecha = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" }).format(new Date(corrida.creada));

  return (
    <>
      <Encabezado
        titulo="Medición de la vitrina"
        sub={`Corrida del ${fecha} · ${corrida.nHuecos} huecos · ${corrida.nCandidatos} candidatos · juez ${corrida.modeloJuez} (${corrida.versionJuez}) · $${costoJuezUsd.toFixed(2)}`}
      >
        {corridas.length > 1
          ? corridas.slice(0, 5).map((c) => (
              <Control key={c.id} href={`/admin/vitrina-medicion?c=${c.id}`} activo={c.id === corrida.id}>
                {new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "America/Mexico_City" }).format(new Date(c.creada))}
              </Control>
            ))
          : null}
      </Encabezado>

      <Cifras r={resumen} />

      <Pestanas
        activa={`/admin/vitrina-medicion?c=${corrida.id}&h=${hueco.n}&m=${mercado}`}
        pestanas={(["us", "jp", "kr"] as Mercado[]).map((m) => ({
          href: url(hueco.n, m),
          label: MERCADOS[m].nombre.replace("Uniqlo ", ""),
          nota: notaMercado(resumenPorMercado[m]),
        }))}
      />

      <Filtros
        grupos={[
          {
            titulo: "hueco",
            opciones: huecos.map((h) => ({
              href: url(h.n),
              label: `${h.n}${h.conAcierto ? "·✓" : h.votados > 0 && h.votados === h.candidatos ? "·×" : ""}`,
              activo: h.n === hueco.n,
            })),
          },
        ]}
      />

      <Fila cols="2-3">
        <Pieza hueco={hueco} anterior={hueco.n > 1 ? url(hueco.n - 1) : null} siguiente={hueco.n < huecos.length ? url(hueco.n + 1) : null} />
        <Panel
          titulo={`Lo que devolvió ${MERCADOS[mercado].nombre}`}
          extra={hueco.termino ? <>q = <span className="text-ink">{hueco.termino}</span> · {candidatos.length} candidatos</> : "sin término de búsqueda"}
        >
          {candidatos.length === 0 ? (
            <Vacio>{hueco.termino ? "La API no devolvió nada para esta consulta." : "La vitrina no sabe buscar este tipo de prenda: no enseña nada."}</Vacio>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {candidatos.map((k) => (
                <Candidato key={k.id} k={k} />
              ))}
            </ul>
          )}
        </Panel>
      </Fila>
    </>
  );
}

function notaMercado(r: ResumenMedicion) {
  const p = pct(r.elegidas.aprobadas, r.elegidas.votadas);
  return p === null ? `${r.elegidas.total} elegidas` : `${p}% ok`;
}

function Cifras({ r }: { r: ResumenMedicion }) {
  const aprob = pct(r.elegidas.aprobadas, r.elegidas.votadas);
  const acuerdo = pct(r.acuerdo.coinciden, r.acuerdo.comparables);
  return (
    <Fila cols={4}>
      <Cifra
        label="Elecciones de la vitrina que aprobaste"
        valor={aprob === null ? "—" : `${aprob}%`}
        unidad={`${r.elegidas.aprobadas} de ${r.elegidas.votadas} calificadas`}
        sub={`${r.elegidas.total} elegidas en total (hasta 2 por hueco y mercado)`}
        barra={{ n: r.elegidas.aprobadas, de: r.elegidas.votadas }}
        tono={aprob === null ? "ink" : aprob >= 70 ? "success" : "error"}
      />
      <Cifra
        label="Acuerdo juez ↔ tú"
        valor={acuerdo === null ? "—" : `${acuerdo}%`}
        unidad={`${r.acuerdo.coinciden} de ${r.acuerdo.comparables}`}
        sub="candidatos con los dos veredictos"
        tono={acuerdo === null ? "ink" : acuerdo >= 85 ? "success" : "ink"}
      />
      <Cifra
        label="Techo: huecos con algún candidato correcto"
        valor={`${r.techo.roberto}`}
        unidad={`de ${r.techo.huecos} huecos`}
        sub={`según el juez: ${r.techo.juez} · ${r.techo.huecosSinVoto} huecos sin tu voto`}
        barra={{ n: r.techo.roberto, de: r.techo.huecos }}
      />
      <Cifra
        label="Calificados por ti"
        valor={`${r.calificados.votados}`}
        unidad={`de ${r.calificados.total}`}
        barra={{ n: r.calificados.votados, de: r.calificados.total }}
      />
    </Fila>
  );
}

function Pieza({ hueco, anterior, siguiente }: { hueco: HuecoUI; anterior: string | null; siguiente: string | null }) {
  const nav = (href: string | null, label: string) =>
    href ? (
      <Link href={href} className="text-[13px] font-medium text-ink2 hover:text-ink">
        {label}
      </Link>
    ) : (
      <span className="text-[13px] text-faint">{label}</span>
    );
  return (
    <Panel
      hero
      titulo={`Hueco ${hueco.n} · viaje ${hueco.viajeN}`}
      extra={
        <span className="flex gap-3">
          {nav(anterior, "← anterior")}
          {nav(siguiente, "siguiente →")}
        </span>
      }
    >
      <p className="text-h2 font-bold tracking-[-0.02em] text-ink">{hueco.nombre}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Chip tono="ink">{hueco.segmento}</Chip>
        <Chip>{hueco.tipo}</Chip>
        <Chip>{hueco.colorFamilia}</Chip>
        {hueco.temporada ? <Chip>{hueco.temporada}</Chip> : null}
        {hueco.formalidad ? <Chip>{hueco.formalidad}</Chip> : null}
      </div>
      {hueco.visual ? <p className="mt-3 text-sm text-ink2">{hueco.visual}</p> : null}
      {hueco.porque ? <p className="mt-2 text-[13px] text-muted">{hueco.porque}</p> : null}
      <p className="mt-3 text-xs text-faint">
        {hueco.votados} de {hueco.candidatos} candidatos calificados{hueco.conAcierto ? " · ya hay uno correcto" : ""}
      </p>
    </Panel>
  );
}

function Candidato({ k }: { k: CandidatoUI }) {
  return (
    <li className={`flex flex-col gap-2 rounded-lg border p-2 ${k.elegida ? "border-2 border-ink" : "border-line"}`}>
      <a href={k.url ?? "#"} target="_blank" rel="noopener noreferrer" className="relative block aspect-[4/5] w-full overflow-hidden rounded-md bg-tile">
        {k.foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={k.foto} alt={k.nombre} className="h-full w-full object-cover" loading="lazy" />
        ) : null}
        <span className="absolute left-1.5 top-1.5 rounded-sm bg-surface/90 px-1.5 text-[11px] font-semibold tabular-nums text-ink">{k.orden + 1}</span>
      </a>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13px] font-bold text-ink" title={k.nombre}>
          {k.nombre}
        </span>
        <span className="text-xs text-muted">
          {k.precioTexto ?? "sin precio"} · {k.color?.toLowerCase() ?? "sin color"}
          {k.rating ? ` · ★${k.rating.toFixed(1)}` : ""}
        </span>
        <span className="flex flex-wrap gap-1 pt-1">
          {k.elegida ? <Chip tono="ink">la enseña</Chip> : <Chip>{MOTIVO[k.motivo ?? ""] ?? k.motivo}</Chip>}
          {k.genero ? <Chip>{k.genero.toLowerCase()}</Chip> : null}
        </span>
      </div>
      <div className="min-h-9 text-xs">
        {k.juez === null ? (
          <span className="text-faint">{k.juezError ? `juez falló: ${k.juezError.slice(0, 60)}` : "juez pendiente"}</span>
        ) : (
          <span className={k.juez ? "text-success" : "text-error"}>
            <span className="font-semibold">juez: {k.juez ? "sí" : "no"}</span>
            {k.juezLinea ? <span className="text-muted"> · {k.juezLinea}</span> : null}
          </span>
        )}
      </div>
      <VotoCandidato id={k.id} voto={k.roberto} />
    </li>
  );
}
