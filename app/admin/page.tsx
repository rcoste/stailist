import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parecidoEnPalabras } from "@/lib/senal-oro";
import { OBJETIVOS, esFilaDeCampana } from "@/lib/admin/objetivos";
import { costoPorPrimerLookTotal, diasParaLaLectura, nombreDelDia, veredicto, type Llegada } from "@/lib/admin/hoy";
import { cargarHoy, type Espejo } from "@/lib/admin/hoy-datos";
import { ZONA, diaEnZona } from "@/lib/admin/adquisicion";
import { BarrasPorDia } from "./_compartido/graficas";
import { AlFinal, Ampliable, Chip, Cifra, Encabezado, Fila, Lista, Panel, Quien, Renglon, Vacio } from "./_ui";

// HOY: ¿cómo va? La primera pantalla del admin. El porqué de cada número vive
// en lib/admin/hoy.ts; aquí sólo se acomoda, con el kit de app/admin/_ui.
// Postgres directo y sin RLS: se vuelve a exigir admin aunque el layout ya lo haga.

export const dynamic = "force-dynamic";

const mxn = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("es-MX")}`);

export default async function Hoy() {
  await requireAdmin();
  const d = await cargarHoy();
  // Las fotos del espejo son privadas: se firman con la sesión de admin, igual
  // que en la ficha.
  const fotos = new Map<string, string>();
  const rutas = d.voz.espejos.map((e) => e.fotoPath).filter((p): p is string => !!p);
  if (rutas.length > 0) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("prendas").createSignedUrls(rutas, 3600);
    data?.forEach((f) => f.path && f.signedUrl && fotos.set(f.path, f.signedUrl));
  }
  const seLoPusieron = d.voz.espejos.filter((e) => e.parecido.tipo === "comparte" && e.parecido.esElLook).length;
  const v = veredicto(d.paro);
  const faltan = diasParaLaLectura(d.hoy);
  const costo = costoPorPrimerLookTotal(d.resumen);
  const gastoPlan = d.resumen.filter(esFilaDeCampana).reduce((t, r) => t + (r.costoMxn ?? 0), 0);
  const [hoy, ayer] = d.dias;
  const tonoTitulo = { bien: "text-success", mal: "text-error", neutro: "text-ink" }[v.tono];
  const fecha = new Date(`${d.hoy}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const lectura = new Date(`${OBJETIVOS.anunciosHasta}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", timeZone: "UTC" });

  return (
    <>
      <Encabezado
        titulo="Hoy"
        sub={`${fecha} · ${faltan > 0 ? `la lectura del plan es el ${lectura}, en ${faltan} día${faltan === 1 ? "" : "s"}` : "la lectura del plan ya llegó"}`}
      />

      {d.alarmas.length > 0 ? (
        <Panel titulo={<span className="text-error">Una señal dejó de llegar</span>} className="mb-4 border-error">
          <ul className="flex flex-col gap-1 text-sm text-ink">
            {d.alarmas.map((a) => (
              <li key={a.nombre}>
                <b>{a.nombre}</b>: {a.detalle} <span className="text-muted">Si está roto se pierde {a.cuesta}.</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {/* EL HÉROE: la pregunta de la página contestada en un bloque. */}
      <Panel hero className="mb-4" sinPadding>
        <div className="grid gap-6 px-6 py-5 lg:grid-cols-[1.4fr_1fr_1fr] lg:gap-8">
          <div>
            <span className="text-[11px] uppercase tracking-[0.04em] text-muted">El experimento</span>
            <h2 className={`mb-1.5 mt-0.5 text-h2 font-bold tracking-[-0.025em] ${tonoTitulo}`}>{v.titulo}</h2>
            <p className="text-sm text-ink2">{v.detalle}</p>
          </div>
          <Cifra
            enPanel={false}
            label="Regresos en su primera semana"
            valor={v.regresos.n}
            unidad={`de ${v.regresos.de} que pide la regla`}
            tono={v.tono === "mal" ? "error" : "success"}
            barra={v.regresos}
          />
          <Cifra enPanel={false} label="Primeros looks de anuncios" valor={v.muestra.n} unidad={`de ${v.muestra.de} de la muestra`} barra={v.muestra} />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-line2 px-6 py-3 text-[13px] text-muted">
          <span>
            Costo por primer look <b className="tabular-nums text-ink">{mxn(costo)} MXN</b>
          </span>
          <span>
            IA ayer <b className="tabular-nums text-ink">US${d.ia[1].usd.toFixed(2)}</b>
          </span>
          <span>
            Gasto en anuncios <b className="tabular-nums text-ink">{mxn(gastoPlan)}</b> de {mxn(OBJETIVOS.topeMxn)}
          </span>
          <Link href="/admin/campanas" className="ml-auto font-semibold text-ink hover:underline">
            Por campaña →
          </Link>
        </div>
      </Panel>

      <Fila cols="3-2">
        <Panel titulo="Últimos 14 días" extra="primer look · volvieron">
          <BarrasPorDia
            dias={d.tendencia.map((t) => ({ etiqueta: t.dia.slice(8), valores: [t.primerLook, t.volvieron] }))}
            series={[
              { nombre: "llegaron a su primer look", tono: "ink" },
              { nombre: "volvieron", tono: "success" },
            ]}
          />
        </Panel>
        <Panel titulo="Desde ayer">
          <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-5">
            <span />
            <span className="text-[11px] uppercase tracking-[0.04em] text-faint">hoy</span>
            <span className="text-[11px] uppercase tracking-[0.04em] text-faint">ayer</span>
            <Comparada etiqueta="Empezaron el onboarding" nota={`${hoy.nuevasDeAnuncio} de anuncios`} hoy={hoy.nuevas} ayer={ayer.nuevas} />
            <Comparada etiqueta="Llegaron a su primer look" hoy={hoy.primerLook} ayer={ayer.primerLook} />
            <Comparada etiqueta="Subieron ropa con foto" hoy={hoy.subieronFotos} ayer={ayer.subieronFotos} />
            <Comparada etiqueta="Volvieron" hoy={d.volvieron[0].quienes.length} ayer={d.volvieron[1].quienes.length} tono="success" />
          </div>
          <p className="mt-3 border-t border-line2 pt-3 text-[13px] text-muted">
            Últimos 7 días: <b className="text-ink">{d.voz.meGusta}</b> 👍 · <b className="text-ink">{d.voz.noMeGusta}</b> 👎 ·{" "}
            <b className="text-ink">{d.voz.fitChecks}</b> espejos, <b className="text-ink">{seLoPusieron}</b> con el look sugerido ·{" "}
            <b className="text-ink">{d.voz.reportes.length}</b> reportes
          </p>
        </Panel>
      </Fila>

      <Fila cols="2-3">
        <Panel titulo="Quién volvió" extra={<Link href="/admin/retencion" className="hover:text-ink">Retención →</Link>} sinPadding>
          {d.volvieron.every((x) => x.quienes.length === 0) ? (
            <Vacio>Nadie volvió ni hoy ni ayer.</Vacio>
          ) : (
            <Lista>
              {d.volvieron.flatMap((x) =>
                x.quienes.map((q) => (
                  <Renglon key={`${x.dia}|${q.correo}`}>
                    <span className="w-8 shrink-0 text-xs text-faint">{nombreDelDia(x.dia, d.hoy)}</span>
                    <Quien correo={q.correo} />
                    <Chip tono="success">
                      {q.primeraVez ? "" : "otra vez · "}
                      {q.aLosDias === 1 ? "al día siguiente" : `a los ${q.aLosDias} días`}
                    </Chip>
                    <AlFinal>
                      {q.origen}
                      {q.cuentaParaParo ? " · cuenta" : ""}
                    </AlFinal>
                  </Renglon>
                ))
              )}
            </Lista>
          )}
        </Panel>

        <Panel
          titulo={
            <>
              Quién llegó <span className="font-normal text-muted">· hoy y ayer</span>
            </>
          }
          extra={<Link href="/admin/actividad" className="hover:text-ink">Actividad →</Link>}
          sinPadding
        >
          {d.dias.every((dia) => dia.llegaron.length === 0) ? (
            <Vacio>Nadie empezó el onboarding ni hoy ni ayer.</Vacio>
          ) : (
            d.dias.map((dia) => <Llegadas key={dia.dia} dia={dia.dia} hoy={d.hoy} llegaron={dia.llegaron} />)
          )}
        </Panel>
      </Fila>

      {d.voz.espejos.length > 0 ? (
        <Panel
          titulo={
            <>
              Espejos <span className="font-normal text-muted">· {d.voz.espejos.length}</span>
            </>
          }
          extra="últimos 7 días"
          className="mb-4"
          sinPadding
        >
          <Lista>
            {d.voz.espejos.map((e) => (
              <RenglonEspejo key={`${e.userId}|${e.cuando}`} e={e} foto={e.fotoPath ? (fotos.get(e.fotoPath) ?? null) : null} hoy={d.hoy} />
            ))}
          </Lista>
        </Panel>
      ) : null}

      {d.voz.reportes.length > 0 ? (
        <Panel titulo="Lo que escribieron" extra="últimos 7 días" sinPadding>
          <Lista>
            {d.voz.reportes.map((r) => (
              <Renglon key={r.cuando} className="py-3">
                {/* Un solo hijo en columna: el Renglon es flex-row y sus gap/items
                    no se sobreescriben desde className (orden de Tailwind 4). */}
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-xs text-muted">
                    {r.correo} · {r.tipo}
                  </span>
                  <span className="text-sm text-ink">“{r.texto}”</span>
                </div>
              </Renglon>
            ))}
          </Lista>
        </Panel>
      ) : null}
    </>
  );
}

/**
 * Un espejo: la foto, quién, y si lo que trae puesto ES el look sugerido o su
 * propia ropa. Esa línea existe porque el primer espejo de anuncios se leyó
 * como "se puso un look" y no lo era (lib/senal-oro.ts).
 */
function RenglonEspejo({ e, foto, hoy }: { e: Espejo; foto: string | null; hoy: string }) {
  const p = e.parecido;
  const esElLook = p.tipo === "comparte" && p.esElLook;
  const dia = diaEnZona(new Date(e.cuando));
  const hora = new Date(e.cuando).toLocaleTimeString("es-MX", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" });
  return (
    <Renglon className="items-start py-3">
      <Ampliable
        imagen={foto}
        nombre={e.titulo ?? "Espejo"}
        sub={e.consejo}
        className="relative block h-16 w-12 shrink-0 overflow-hidden rounded-md border border-line bg-tile"
      >
        {foto ? <Image src={foto} alt={e.titulo ?? "Espejo"} fill sizes="48px" className="object-cover" unoptimized /> : null}
      </Ampliable>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <Quien correo={e.correo} pais={e.pais} href={`/admin/usuarios/${e.userId}`} />
          <span className="shrink-0 text-xs text-faint">
            {nombreDelDia(dia, hoy)} {hora}
          </span>
        </div>
        <b className="truncate text-sm text-ink">{e.titulo ?? "Espejo"}</b>
        <span className="text-[13px] text-muted">{parecidoEnPalabras(p)}</span>
      </div>
      <Chip tono={esElLook ? "success" : "muted"}>{esElLook ? "el look sugerido" : "su ropa"}</Chip>
    </Renglon>
  );
}

function Comparada({
  etiqueta,
  nota,
  hoy,
  ayer,
  tono = "ink",
}: {
  etiqueta: string;
  nota?: string;
  hoy: number;
  ayer: number;
  tono?: "ink" | "success";
}) {
  return (
    <>
      <span className="border-t border-line2 py-2 text-sm text-ink2">
        {etiqueta}
        {nota ? <span className="text-[13px] text-faint"> · {nota}</span> : null}
      </span>
      <span className={`border-t border-line2 py-2 text-right text-lg font-bold tabular-nums ${tono === "success" && hoy > 0 ? "text-success" : "text-ink"}`}>
        {hoy}
      </span>
      <span className="min-w-8 border-t border-line2 py-2 text-right text-[13px] tabular-nums text-faint">{ayer}</span>
    </>
  );
}

/** Las llegadas de un día: con nombre quien llegó a su primer look; resumido quien se quedó. */
function Llegadas({ dia, hoy, llegaron }: { dia: string; hoy: string; llegaron: Llegada[] }) {
  const conLook = llegaron.filter((l) => l.primerLook);
  const quedaron = llegaron.filter((l) => !l.primerLook);
  const porPaso = [...new Set(quedaron.map((l) => l.paso))]
    .map((paso) => ({ paso: paso.replace(/^se quedó /, ""), n: quedaron.filter((l) => l.paso === paso).length }))
    .sort((a, b) => b.n - a.n);
  return (
    <div>
      <div className="flex items-baseline gap-2 border-t border-line2 px-5 pb-1 pt-3 text-xs first:border-t-0">
        <b className="text-ink">{nombreDelDia(dia, hoy)}</b>
        <span className="text-muted">
          {conLook.length} con primer look · {quedaron.length} se quedaron
        </span>
      </div>
      {llegaron.length === 0 ? (
        <Vacio>Nadie empezó el onboarding.</Vacio>
      ) : (
        <Lista>
          {conLook.map((l) => (
            <Renglon key={l.id}>
              <Quien correo={l.correo} pais={l.pais} href={`/admin/usuarios/${l.id}`} />
              {l.fotos > 0 ? <Chip tono="ink">{l.fotos} con foto</Chip> : null}
              {l.variante === "fotos" ? <Chip>3 fotos</Chip> : null}
              <AlFinal>{l.origen}</AlFinal>
            </Renglon>
          ))}
          {quedaron.length > 0 ? (
            <li>
              <details>
                <summary className="cursor-pointer border-t border-line2 px-5 py-2.5 text-[13px] text-muted hover:text-ink">
                  <b className="text-ink">{quedaron.length} se quedaron en el onboarding</b> · {porPaso.map((p) => `${p.n} ${p.paso}`).join(" · ")}
                </summary>
                <Lista>
                  {quedaron.map((l) => (
                    <Renglon key={l.id} className="bg-tile/60">
                      <Quien correo={l.correo} pais={l.pais} href={`/admin/usuarios/${l.id}`} />
                      <span className="text-[13px] text-muted">{l.paso}</span>
                      <AlFinal>{l.origen}</AlFinal>
                    </Renglon>
                  ))}
                </Lista>
              </details>
            </li>
          ) : null}
        </Lista>
      )}
    </div>
  );
}
