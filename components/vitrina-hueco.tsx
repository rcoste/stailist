import { createClient } from "@/lib/supabase/server";
import { registrarError } from "@/lib/errores";
import { VitrinaFranja } from "@/components/vitrina-franja";
import {
  claveVitrina,
  consultarUniqlo,
  elegirPrendas,
  terminoDe,
  type Mercado,
  type PrendaVitrina,
  type Segmento,
} from "@/lib/vitrina-uniqlo";

// UN HUECO DE LA MALETA → SU FRANJA DE UNIQLO (componente async de servidor).
//
// Va envuelto en <Suspense fallback={null}> desde la página (D3): la maleta
// pinta sin esperar a Uniqlo y la franja llega cuando llega. Un mercado por
// país de destino (ya deduplicados); la primera franja con prendas gana y se
// muestra una sola (la del primer país del viaje que tenga algo en tu color).
// Fallo o timeout: nada visible, y una fila en /admin/errores (D4).
export async function VitrinaHueco({
  tipo,
  nombre,
  colorFamilia,
  segmento,
  mercados,
  userId,
}: {
  tipo: string;
  /** El nombre de la pieza ("Short de lino negro"): de ahí salen los modificadores de la búsqueda. */
  nombre?: string | null;
  colorFamilia: string;
  segmento: Segmento;
  mercados: Mercado[];
  userId: string;
}) {
  const q = terminoDe(tipo, nombre);
  if (!q || mercados.length === 0) return null;

  const onError = async (mercado: Mercado, mensaje: string) => {
    try {
      const supabase = await createClient();
      await registrarError(supabase, {
        userId,
        origen: "servidor",
        clave: `vitrina-uniqlo:${mercado}`,
        pantalla: "/viaje",
        mensaje: `${q}: ${mensaje}`,
      });
    } catch {
      // el aviso al admin nunca puede tumbar la franja
    }
  };

  const consultas = await Promise.all(mercados.map((m) => consultarUniqlo(m, q, { onError })));
  let prendas: PrendaVitrina[] = [];
  for (let i = 0; i < mercados.length && prendas.length === 0; i++) {
    prendas = elegirPrendas(consultas[i].items, { segmento, colorFamilia, termino: q }, mercados[i], consultas[i].vistoEl);
  }
  if (prendas.length === 0) return null;

  return <VitrinaFranja prendas={prendas} clave={claveVitrina(segmento, tipo, colorFamilia)} desde="maleta" />;
}
