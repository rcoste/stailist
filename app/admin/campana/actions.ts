"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { withDb } from "@/lib/db";

// CAPTURAR LO QUE DICE GOOGLE ADS, un día y una campaña a la vez (migración
// 0163). Upsert: volver a capturar el mismo día y campaña CORRIGE, no duplica.
// La campaña se guarda tal como el utm_campaign de la URL final del anuncio;
// si no coincide, el gasto aparece en su propia fila sin nadie adentro y se
// nota a simple vista.

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const CAMPANA = /^[\w.\-~+: ]{1,120}$/;

function entero(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function pesos(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().replace(/[$,\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export async function guardarGasto(formData: FormData) {
  await requireAdmin();
  const dia = String(formData.get("dia") ?? "");
  const campana = String(formData.get("campana") ?? "").trim().toLowerCase();
  const clics = entero(formData.get("clics"));
  const costo = pesos(formData.get("costo_mxn"));
  const registros = entero(formData.get("registros_google"));
  const nota = String(formData.get("nota") ?? "").trim().slice(0, 300) || null;
  if (!DIA.test(dia) || !CAMPANA.test(campana) || clics == null || costo == null) return;

  await withDb((c) =>
    c.query(
      `insert into public.campana_gasto (dia, campana, clics, costo_mxn, registros_google, nota, actualizado)
       values ($1::date, $2, $3, $4, $5, $6, now())
       on conflict (dia, campana) do update set
         clics = excluded.clics,
         costo_mxn = excluded.costo_mxn,
         registros_google = excluded.registros_google,
         nota = excluded.nota,
         actualizado = now()`,
      [dia, campana, clics, costo, registros, nota]
    )
  );
  revalidatePath("/admin/campana");
}

export async function borrarGasto(formData: FormData) {
  await requireAdmin();
  const dia = String(formData.get("dia") ?? "");
  const campana = String(formData.get("campana") ?? "");
  if (!DIA.test(dia) || !CAMPANA.test(campana)) return;
  await withDb((c) =>
    c.query(`delete from public.campana_gasto where dia = $1::date and campana = $2`, [dia, campana])
  );
  revalidatePath("/admin/campana");
}
