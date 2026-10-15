import { requireAdmin } from "@/lib/auth";
import { cargarErrores } from "@/lib/admin/errores-datos";
import { agrupar, porRevisar, type EstadoEfectivo, type Grupo } from "@/lib/admin/errores";
import { diaEnZona, horaEnZona } from "@/lib/admin/adquisicion";
import { marcarError } from "./actions";
import { Chip, Cifra, Encabezado, Fila, Filtros, Panel, Quien, Vacio } from "../_ui";

export const dynamic = "force-dynamic";

// LO QUE LE SALIÓ MAL A ALGUIEN (2026-10-14, boceto aprobado). Pedido de
// Roberto tras el viaje que Vercel cortó a los 60 s sin que nadie se enterara.
// Junta las tres fuentes (lib/admin/errores-datos.ts) y las agrupa por qué
// falló, con un estado por grupo. Arriba lo que vio una persona; plegados, los
// frenos de cuota y el ruido técnico, que no son fallas pero se miran.
export default async function ErroresPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  await requireAdmin();
  const { dias: diasQ } = await searchParams;
  const dias = [7, 30].includes(Number(diasQ)) ? Number(diasQ) : 7;
  const { ocurrencias, estados, correos } = await cargarErrores(dias);
  const grupos = agrupar(ocurrencias, estados);
  const errores = grupos.filter((g) => g.clase === "error");
  const frenos = grupos.filter((g) => g.clase === "freno");
  const tecnicos = grupos.filter((g) => g.clase === "tecnico");
  const vecesError = errores.reduce((t, g) => t + g.veces, 0);
  const personasError = new Set(
    ocurrencias.filter((o) => errores.some((g) => g.clave === o.clave)).map((o) => o.userId).filter(Boolean)
  ).size;
  const sinRevisar = porRevisar(grupos);

  return (
    <>
      <Encabezado titulo="Errores" sub="Lo que le salió mal a alguien: quién, en qué pantalla y por qué." />
      <Filtros
        grupos={[
          {
            titulo: "ver",
            opciones: [7, 30].map((d) => ({ href: `/admin/errores?dias=${d}`, label: `últimos ${d} días`, activo: dias === d })),
          },
        ]}
      />
      <Fila cols={3}>
        <Cifra label="Le salió un error a alguien" valor={vecesError} unidad={`veces · ${personasError} ${personasError === 1 ? "persona" : "personas"}`} />
        <Cifra label="Sin revisar" valor={sinRevisar} unidad={sinRevisar === 1 ? "tipo de error" : "tipos de error"} tono={sinRevisar > 0 ? "error" : "ink"} />
        <Cifra label="Frenos de cuota" valor={frenos.reduce((t, g) => t + g.veces, 0)} unidad={'"por hoy ya no"'} />
      </Fila>

      <Panel titulo="Le salió un error" extra="agrupado por qué falló" sinPadding className="mb-4">
        {errores.length === 0 ? (
          <Vacio>Nadie vio un error en estos días.</Vacio>
        ) : (
          errores.map((g) => <GrupoError key={g.clave} g={g} correos={correos} />)
        )}
        <Plegado titulo="frenos de cuota" que='la app le dijo "por hoy ya no" a alguien. No son fallas, pero si pasa mucho el tope está bajo.' grupos={frenos} correos={correos} />
        <Plegado titulo="avisos técnicos" que="algo tronó por dentro sin que la persona lo viera: una llamada a la IA que se reintentó, una conexión que se cayó de su lado." grupos={tecnicos} correos={correos} />
      </Panel>
    </>
  );
}

const CHIP: Record<EstadoEfectivo, { tono: "error" | "success" | "ink" | "muted"; texto: string }> = {
  volvio: { tono: "error", texto: "volvió a pasar" },
  sin_revisar: { tono: "error", texto: "sin revisar" },
  visto: { tono: "ink", texto: "visto" },
  arreglado: { tono: "success", texto: "arreglado" },
};

function cuando(at: string): string {
  const hoy = diaEnZona(new Date());
  const dia = diaEnZona(new Date(at));
  const fecha = dia === hoy ? "hoy" : new Date(dia + "T12:00:00Z").toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${fecha} ${horaEnZona(at)}`;
}

function GrupoError({ g, correos, compacto = false }: { g: Grupo; correos: Map<string, string>; compacto?: boolean }) {
  const chip = CHIP[g.estado];
  return (
    <div className="border-t border-line2 px-5 py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {compacto ? null : <Chip tono={chip.tono}>{chip.texto}</Chip>}
        <span className="text-sm font-semibold text-ink">{g.titulo}</span>
        <span className="ml-auto whitespace-nowrap text-[13px] text-muted">
          {g.veces} {g.veces === 1 ? "vez" : "veces"} · {g.personas} {g.personas === 1 ? "persona" : "personas"} · {cuando(g.ultima)}
        </span>
      </div>
      {g.nota ? <p className="mt-1 text-[13px] text-ink2">{g.nota}</p> : null}
      {compacto ? null : (
        <>
          <ul className="mt-2 flex flex-col gap-1 rounded-md bg-tile px-3 py-2">
            {g.ocurrencias.map((o, i) => (
              <li key={i} className="flex flex-col gap-0.5 py-0.5">
                <div className="flex flex-wrap items-baseline gap-x-3 text-[13px]">
                  <span className="w-24 shrink-0 text-xs tabular-nums text-faint">{cuando(o.at)}</span>
                  {o.userId ? <Quien correo={correos.get(o.userId) ?? o.userId.slice(0, 8)} href={`/admin/usuarios/${o.userId}`} /> : <span className="text-faint">sin cuenta</span>}
                  {o.pantalla ? <span className="text-muted">· {o.pantalla}</span> : null}
                  {o.mensaje ? <span className="text-ink2">· vio “{o.mensaje}”</span> : null}
                </div>
                {o.tecnico ? <span className="break-all pl-27 text-xs text-muted max-sm:pl-0">{o.tecnico}</span> : null}
              </li>
            ))}
            {g.veces > g.ocurrencias.length ? <li className="text-xs text-faint">y {g.veces - g.ocurrencias.length} más</li> : null}
          </ul>
          <form action={marcarError} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="clave" value={g.clave} />
            <input
              name="nota"
              placeholder="qué se hizo (opcional)"
              maxLength={300}
              className="h-8 min-w-0 flex-1 rounded-sm border border-line bg-surface px-2.5 text-[13px] text-ink placeholder:text-faint sm:max-w-xs"
            />
            {g.estado !== "visto" ? <Boton estado="visto">ya lo vi</Boton> : null}
            {g.estado !== "arreglado" ? <Boton estado="arreglado">arreglado</Boton> : null}
            {g.estado !== "sin_revisar" ? <Boton estado="sin_revisar">reabrir</Boton> : null}
          </form>
        </>
      )}
    </div>
  );
}

function Boton({ estado, children }: { estado: string; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      name="estado"
      value={estado}
      className="h-8 rounded-sm border border-line bg-surface px-3 text-[13px] font-medium text-ink2 transition-colors hover:border-ink hover:text-ink"
    >
      {children}
    </button>
  );
}

function Plegado({ titulo, que, grupos, correos }: { titulo: string; que: string; grupos: Grupo[]; correos: Map<string, string> }) {
  if (grupos.length === 0) return null;
  const veces = grupos.reduce((t, g) => t + g.veces, 0);
  return (
    <details className="border-t border-line2">
      <summary className="cursor-pointer px-5 py-3 text-[13px] text-muted hover:text-ink">
        <b className="font-semibold text-ink">
          {veces} {titulo}
        </b>{" "}
        · {que}
      </summary>
      {grupos.map((g) => (
        <GrupoError key={g.clave} g={g} correos={correos} compacto />
      ))}
    </details>
  );
}
