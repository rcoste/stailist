import { VENTANAS, maduracion, type CeldaMaduracion, type PersonaRetencion } from "@/lib/admin/retencion";
import { Panel, Sub, Tabla, Td, Th, Vacio } from "../_ui";

// LA TABLA DE MADURACIÓN (2026-10-16): una fila por semana en que empezaron,
// una columna por ventana de días. Cada celda cuenta sólo a quien ya vivió
// esa ventana completa (la regla vive en lib/admin/retencion.ts, maduracion).
// Es la forma de decir "después del día 3 no vuelven" sin meter a gente que
// todavía no llega a su día 3.

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** "2026-10-05" → "5 oct". */
const fecha = (dia: string) => `${Number(dia.slice(8, 10))} ${MESES[Number(dia.slice(5, 7)) - 1]}`;

/** "2 de 15", el % debajo, y cuántas del grupo aún no viven esa ventana. */
function Celda({ c }: { c: CeldaMaduracion }) {
  if (c.de === 0) return <span className="text-faint" title="nadie de este grupo ha vivido esos días completos">—</span>;
  return (
    <>
      {c.volvieron} de {c.de}
      <Sub>
        {Math.round((c.volvieron / c.de) * 100)}%{c.faltan > 0 ? ` · faltan ${c.faltan}` : ""}
      </Sub>
    </>
  );
}

export function TablaMaduracion({ personas, hoy }: { personas: PersonaRetencion[]; hoy: string }) {
  const { grupos, total } = maduracion(personas, hoy);
  return (
    <Panel
      titulo="Volvieron, por semana en que empezaron"
      extra="cada celda cuenta sólo a quien ya vivió esos días completos"
      sinPadding
      className="mb-4"
    >
      {personas.length === 0 ? (
        <Vacio>Nadie con estos filtros.</Vacio>
      ) : (
        <Tabla>
          <thead>
            <tr>
              <Th izq>semana del</Th>
              <Th>personas</Th>
              {VENTANAS.map((v) => (
                <Th key={v.label}>{v.label}</Th>
              ))}
              <Th>1ª semana</Th>
            </tr>
          </thead>
          <tbody>
            {[...grupos, total].map((g) => (
              <tr key={g.semana} className={g.semana === "total" ? "font-bold" : ""}>
                <Td izq className="whitespace-nowrap">
                  {g.semana === "total" ? "Total" : fecha(g.semana)}
                </Td>
                <Td className="whitespace-nowrap">{g.n}</Td>
                {g.celdas.map((c, i) => (
                  <Td key={i} className="whitespace-nowrap">
                    <Celda c={c} />
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </Panel>
  );
}
