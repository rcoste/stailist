import { createReadStream, readFileSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { isIP } from "node:net";
import pg from "pg";
import { dispositivoDesdeUA } from "../lib/dispositivo";
import { esPais } from "../lib/lugar";

// RELLENAR PAÍS Y APARATO DE LAS CUENTAS QUE YA EXISTÍAN (2026-10-06).
//
// Desde la migración 0171 cada cuenta nueva guarda su país (encabezados de
// Vercel) y su aparato al arrancar. Las de antes no tienen ninguno de los dos,
// o sólo el aparato desde el 2026-10-01. Pero Supabase guarda la IP y el
// navegador de cada sesión (auth.sessions): de la sesión MÁS VIEJA de cada
// cuenta sale el aparato y, con una base de IP→país, el país.
//
// La base de IP→país se lee de un archivo local (DB-IP "IP to Country Lite",
// CSV .gz, licencia CC BY 4.0, https://db-ip.com). Las IPs NUNCA salen de esta
// compu ni se copian a ninguna tabla: sólo se escribe el código de país. Sin el
// archivo, el script rellena sólo el aparato.
//
// Uso (ensayo por default; no escribe nada):
//   npx tsx scripts/rellenar-pais-aparato.mts [ruta/dbip-country-lite.csv.gz]
//   npx tsx scripts/rellenar-pais-aparato.mts [ruta] --escribir

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);

const args = process.argv.slice(2);
const escribir = args.includes("--escribir");
const archivo = args.find((a) => !a.startsWith("--"));

/** IPv4 e IPv6 al mismo eje numérico (IPv4 como ::ffff:a.b.c.d no hace falta: DB-IP las separa). */
const B = (n: number) => BigInt(n);

function ipANumero(ip: string): bigint | null {
  const v = isIP(ip);
  if (v === 4) return ip.split(".").reduce((n, o) => (n << B(8)) + B(Number(o)), B(0));
  if (v !== 6) return null;
  const [cabeza, cola = ""] = ip.split("::");
  const a = cabeza ? cabeza.split(":") : [];
  const b = cola ? cola.split(":") : [];
  const grupos = ip.includes("::") ? [...a, ...Array(8 - a.length - b.length).fill("0"), ...b] : a;
  if (grupos.length !== 8) return null;
  return grupos.reduce((n, g) => (n << B(16)) + B(parseInt(g || "0", 16)), B(0)) + (B(1) << B(128));
}

type Rango = { desde: bigint; hasta: bigint; pais: string };

async function cargarRangos(ruta: string): Promise<Rango[]> {
  const rangos: Rango[] = [];
  const lineas = createInterface({ input: createReadStream(ruta).pipe(createGunzip()) });
  for await (const l of lineas) {
    const [desde, hasta, pais] = l.split(",");
    const d = ipANumero(desde);
    const h = ipANumero(hasta);
    if (d != null && h != null && esPais(pais)) rangos.push({ desde: d, hasta: h, pais });
  }
  return rangos.sort((x, y) => (x.desde < y.desde ? -1 : x.desde > y.desde ? 1 : 0));
}

function paisDeIp(rangos: Rango[], ip: string): string | null {
  const n = ipANumero(ip);
  if (n == null) return null;
  let lo = 0;
  let hi = rangos.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (n < rangos[m].desde) hi = m - 1;
    else if (n > rangos[m].hasta) lo = m + 1;
    else return rangos[m].pais;
  }
  return null;
}

const url = env.DATABASE_URL;
const client = new pg.Client({ connectionString: url, ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false } });
await client.connect();
try {
  const rangos = archivo ? await cargarRangos(archivo) : [];
  if (archivo) console.log(`base de países: ${rangos.length} rangos`);

  const { rows } = await client.query(`
    select p.id, p.dispositivo, p.pais, s.user_agent, host(s.ip) as ip
    from public.profiles p
    left join lateral (
      select user_agent, ip from auth.sessions where user_id = p.id order by created_at limit 1
    ) s on true
    where p.dispositivo is null or p.pais is null`);

  let aparatos = 0;
  let paises = 0;
  const conteo = new Map<string, number>();
  for (const r of rows) {
    const dispositivo = r.dispositivo ? null : dispositivoDesdeUA(r.user_agent);
    const pais = r.pais || !r.ip || rangos.length === 0 ? null : paisDeIp(rangos, r.ip);
    if (dispositivo) aparatos++;
    if (pais) {
      paises++;
      conteo.set(pais, (conteo.get(pais) ?? 0) + 1);
    }
    if (escribir && (dispositivo || pais)) {
      await client.query(
        `update public.profiles set
           dispositivo = coalesce(dispositivo, $2),
           pais = coalesce(pais, $3)
         where id = $1`,
        [r.id, dispositivo, pais]
      );
    }
  }
  console.log(`cuentas por revisar: ${rows.length}`);
  console.log(`aparato encontrado: ${aparatos} · país encontrado: ${paises}`);
  console.log(`por país: ${[...conteo].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${n}`).join(" · ") || "—"}`);
  console.log(escribir ? "ESCRITO." : "ensayo: no se escribió nada (agrega --escribir).");
} finally {
  await client.end();
}
