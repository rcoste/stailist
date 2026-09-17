// ¿"ARMA TU SEMANA" REPITE DE MÁS? — la medición sobre clósets reales.
//
// Uso: npx tsx scripts/medir-semana.ts [--salida=<ruta.json>] [userId ...]
//
// POR QUÉ EXISTE. La primera semana de prueba (claude.dev, 2026-09-16) sacó el
// blazer marino en 5 de 7 días y dejó 6 de 15 prendas sin usar. Pero esa cuenta
// tiene un clóset de otoño con paleta de invierno y 5 planes arreglados de 7:
// no es evidencia. Esto arma una semana REALISTA en clósets reales y cuenta.
//
// NO ESCRIBE NADA en las cuentas: carga el clóset, arma cada día en memoria y
// acumula los días anteriores como "recientes" — igual que producción, donde
// cada día de la semana ve a los anteriores. El camino es el MISMO que
// producción (elegirLookPlaneado en lib/look-del-dia/nucleo.ts), no una copia.
// Las llamadas no dejan recibo (quien = null): es laboratorio, no uso real.
//
// LA SEMANA (fija, para que los clósets se comparen entre sí):
//   lun-vie: trabajo si la persona dijo cómo se viste para trabajar; si no, día
//            a día. Con código "depende del día", martes y jueves con cliente.
//   sáb: cena con amigos (noche) · dom: comida familiar (día).
//   Clima fijo 20° parcialmente nublado, para que el clima no mueva la ropa.
//
// LA REGLA, ESCRITA ANTES DE CORRER (2026-09-16):
//   Un clóset tiene REPETICIÓN DE MÁS si una misma prenda de CAPA (saco,
//   blazer, chamarra, abrigo) o de CALZADO sale en 4 o más de los 7 días,
//   teniendo el clóset al menos 2 prendas más de esa misma zona.
//   Hay PROBLEMA DEL MOTOR si le pasa a 3 o más de los clósets medidos.
//   Si no, no se toca el motor y la semana de claude.dev queda como artefacto
//   de un clóset de prueba mal armado.
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { cargarBaseDelMotor, construirContexto } from "../lib/engine/contexto";
import { elegirLookPlaneado } from "../lib/look-del-dia/nucleo";
import { cuerpoDelPlan, type PlanSemanaId } from "../lib/semana";
import { tipoDePrenda } from "../lib/engine/vocabulario";

for (const l of readFileSync(".env.local", "utf8").split("\n")) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#"))
    process.env[l.slice(0, i)] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}

const CLOSETS_POR_DEFECTO = [
  "ad98e8bc-6ad5-4ae5-a7e1-83b451f0f203", // Roberto · 149 · depende del día
  "1dd21553-c904-41d7-897f-3be5ff600ede", // Val · 66 · depende del día
  "a0009f9b-5644-49cf-99f6-130935ee00c9", // Andy · 81
  "73755f53-a97c-4004-a66a-bd47d47e1c09", // Islam · 57
  "9e5d61fc-b4ad-49ab-8356-7aec37b35817", // Ricardo · 56 · formal
  "8b35fb8e-812f-4145-b532-f20cac871f7d", // Hugo · 38 (clóset chico)
];

const DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"] as const;
const UMBRAL_DIAS = 4;
const MIN_ALTERNATIVAS = 2;
const UMBRAL_CLOSETS = 3;

function semanaPara(codigo: string | null): PlanSemanaId[] {
  const trabajo: PlanSemanaId = codigo ? "oficina" : "diario";
  const conCliente: PlanSemanaId = codigo === "variable" ? "cliente" : trabajo;
  return [trabajo, conCliente, trabajo, conCliente, trabajo, "cena-amigos", "comida-familiar"];
}

type DiaMedido = { dia: string; plan: string; prendas: string[]; item_ids: string[]; error?: string };

async function medirCloset(s: ReturnType<typeof createClient>, userId: string) {
  const carga = await cargarBaseDelMotor(s as never, userId);
  if ("error" in carga) return { userId, error: carga.error };
  const base = carga.base;
  const nombre = new Map(base.items.map((i) => [i.id, i.attrs.nombre ?? "Prenda"]));
  const codigo = (base.profile.work_dress_code as string | null) ?? null;
  const planes = semanaPara(codigo);
  const recientes = [...base.recentCombos];
  const dias: DiaMedido[] = [];

  for (let d = 0; d < DIAS.length; d++) {
    const ctx = construirContexto(
      { ...base, recentCombos: recientes },
      { ...cuerpoDelPlan(planes[d]), weather: { temp_c: 20, condition: "parcialmente nublado" } }
    );
    try {
      const { result } = await elegirLookPlaneado(ctx, null);
      const ids = result.outfit.item_ids;
      recientes.unshift(ids);
      dias.push({ dia: DIAS[d], plan: planes[d], item_ids: ids, prendas: ids.map((id) => nombre.get(id) ?? id) });
      console.log(`  ${userId.slice(0, 8)} ${DIAS[d]} ${planes[d]}: ${ids.map((id) => nombre.get(id)).join(" + ")}`);
    } catch (e) {
      dias.push({ dia: DIAS[d], plan: planes[d], item_ids: [], prendas: [], error: e instanceof Error ? e.message : String(e) });
      console.log(`  ${userId.slice(0, 8)} ${DIAS[d]}: FALLÓ ${e instanceof Error ? e.message : e}`);
    }
  }

  // Conteo por prenda, y la zona de cada una (capa, calzado…).
  const veces = new Map<string, number>();
  for (const d of dias) for (const id of new Set(d.item_ids)) veces.set(id, (veces.get(id) ?? 0) + 1);
  const zonaDe = (id: string) => tipoDePrenda(nombre.get(id) ?? "")?.zona ?? null;
  const porZona = (z: string) => base.items.filter((i) => zonaDe(i.id) === z).length;
  const repetidas = [...veces.entries()]
    .map(([id, n]) => ({ id, prenda: nombre.get(id) ?? id, zona: zonaDe(id), veces: n }))
    .sort((a, b) => b.veces - a.veces);
  const deMas = repetidas.filter(
    (r) =>
      (r.zona === "capa" || r.zona === "pie") &&
      r.veces >= UMBRAL_DIAS &&
      porZona(r.zona) - 1 >= MIN_ALTERNATIVAS
  );
  return {
    userId,
    codigo,
    prendasEnCloset: base.items.length,
    capasEnCloset: porZona("capa"),
    calzadoEnCloset: porZona("pie"),
    distintas: veces.size,
    dias,
    top: repetidas.slice(0, 5),
    deMas,
  };
}

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const args = process.argv.slice(2);
  const salida = args.find((a) => a.startsWith("--salida="))?.slice("--salida=".length);
  const ids = args.filter((a) => !a.startsWith("--"));
  const closets = ids.length ? ids : CLOSETS_POR_DEFECTO;

  console.log(`Midiendo ${closets.length} clósets × 7 días…`);
  const resultados = await Promise.all(closets.map((id) => medirCloset(s as never, id)));

  console.log(`\nREGLA: capa o calzado en ≥${UMBRAL_DIAS}/7 días con ≥${MIN_ALTERNATIVAS} alternativas de su zona → repetición de más. Problema del motor si ≥${UMBRAL_CLOSETS} clósets.\n`);
  let conProblema = 0;
  for (const r of resultados) {
    if ("error" in r && !("dias" in r)) {
      console.log(`${r.userId.slice(0, 8)} · no se pudo cargar (${r.error})`);
      continue;
    }
    const x = r as Exclude<typeof r, { error: string }>;
    if (x.deMas.length) conProblema++;
    console.log(
      `${x.userId.slice(0, 8)} · ${x.prendasEnCloset} prendas (${x.capasEnCloset} capas, ${x.calzadoEnCloset} calzado) · ${x.distintas} distintas en la semana · ${x.deMas.length ? "REPITE DE MÁS" : "ok"}`
    );
    console.log(`   más usadas: ${x.top.map((t) => `${t.prenda} ×${t.veces}`).join(", ")}`);
    for (const m of x.deMas) console.log(`   ⚠ ${m.prenda} (${m.zona}) en ${m.veces}/7`);
  }
  console.log(`\nClósets con repetición de más: ${conProblema} de ${resultados.length} → ${conProblema >= UMBRAL_CLOSETS ? "PROBLEMA DEL MOTOR" : "no alcanza la regla: no se toca el motor"}`);
  if (salida) writeFileSync(salida, JSON.stringify(resultados, null, 1));
}
main();
