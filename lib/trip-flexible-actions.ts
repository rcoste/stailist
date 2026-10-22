"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { revisarGasto } from "@/lib/cuotas";
import { loadClosetImageMap, loadClosetLite } from "@/lib/capsule-data";
import {
  CATEGORIES,
  FORMALIDADES,
  type CapsuleItem,
  type CapsuleMatch,
  type CapsuleOverrides,
  type CapsuleTarget,
  type Category,
  type Formalidad,
  type MatchEntry,
} from "@/lib/capsule";
import { empacablesDelViaje } from "@/lib/trip-maleta";
import { grupoDePieza, type GrupoMaleta } from "@/lib/trip-grupos";
import { firmaDeMaleta, leerRevision, type RevisionMaleta } from "@/lib/trip-revision-maleta";
import { registrarEvento } from "@/lib/telemetria";
import { JUDGE_MODEL } from "@/lib/models";
import { medirAnthropic } from "@/lib/recibos";
import { capsuleFloor, luggageCapacity, occasionLabels, textoDeClima, tripDays, type Bolsas, type Luggage, type Occasion, type TripWeather } from "@/lib/trip";

// LA MALETA FLEXIBLE (2026-10-21). Roberto, empacando: "quitar y poner, o
// decirte 'esto es lo que empaqué', dame un assessment, y arma los looks a
// partir de esto". Quitar ya existía para las piezas que faltan ("no lo
// necesito", fueraKey); aquí van las otras dos:
//
//  · AGREGAR algo de su clóset que no estaba en el plan. Entra como una pieza
//    más del viaje (al final de la lista, con su cruce en "tienes"), así lo
//    cuentan el resumen, el empacado, el juez y los looks sin código aparte —
//    el mismo truco con que entran las anclas al crear el viaje.
//  · LA REVISIÓN de stylist de lo que de verdad lleva: qué está bien, qué
//    sobra, qué falta y cuántos looks salen. Una llamada al juez (Sonnet), con
//    el freno de gasto; se guarda con la firma de la maleta para saber cuándo
//    quedó vieja.

export type OpcionAgregar = { id: string; nombre: string; image: string | null; grupo: GrupoMaleta };

async function sesion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Lo de su clóset que todavía no va en la maleta, para "agregar algo de mi clóset". */
export async function opcionesParaAgregar(tripId: string): Promise<OpcionAgregar[]> {
  const { supabase, user } = await sesion();
  if (!user) return [];
  const { data: trip } = await supabase
    .from("trips")
    .select("capsule_target, capsule_match, overrides")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  const target = trip?.capsule_target as CapsuleTarget | null;
  if (!target) return [];
  const enMaleta = new Set(
    empacablesDelViaje(target, (trip?.capsule_match as CapsuleMatch | null) ?? null, (trip?.overrides as CapsuleOverrides | null) ?? null).map((p) => p.nombre)
  );
  const [closet, imageMap] = await Promise.all([loadClosetLite(supabase, user.id), loadClosetImageMap(supabase, user.id)]);
  const vistos = new Set<string>();
  return closet
    .filter((c) => !enMaleta.has(c.nombre) && (vistos.has(c.nombre) ? false : (vistos.add(c.nombre), true)))
    .map((c) => ({ id: c.id, nombre: c.nombre, image: imageMap[c.nombre] ?? null, grupo: grupoDePieza(c) }));
}

const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28);

/** "Agregar algo de mi clóset": la prenda entra como una pieza más del viaje, ya cubierta. */
export async function agregarAlViaje(tripId: string, itemId: string): Promise<{ ok: boolean }> {
  if (typeof itemId !== "string" || !itemId) return { ok: false };
  const { supabase, user } = await sesion();
  if (!user) return { ok: false };
  const { data: trip } = await supabase
    .from("trips")
    .select("capsule_target, capsule_match, overrides, outfits")
    .eq("id", tripId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  const target = trip?.capsule_target as CapsuleTarget | null;
  if (!trip || !target?.items) return { ok: false };
  const closet = await loadClosetLite(supabase, user.id);
  const prenda = closet.find((c) => c.id === itemId);
  if (!prenda) return { ok: false };
  const match = (trip.capsule_match as CapsuleMatch | null) ?? null;
  const overrides = (trip.overrides as CapsuleOverrides | null) ?? null;
  // Ya va en la maleta: no se duplica.
  if (empacablesDelViaje(target, match, overrides).some((p) => p.nombre === prenda.nombre)) return { ok: true };

  const pieza: CapsuleItem = {
    nombre: prenda.nombre,
    tipo: slug(prenda.nombre) || "prenda",
    category: ((CATEGORIES as readonly string[]).includes(prenda.category) ? prenda.category : "top") as Category,
    colorFamilia: prenda.color || "neutro",
    formalidad: ((FORMALIDADES as readonly string[]).includes(prenda.formalidad) ? prenda.formalidad : "casual") as Formalidad,
    temporada: prenda.temporada ?? "todo-el-año",
    prioridad: target.items.length + 1,
    porque: "La agregaste tú a la maleta.",
  };
  const items = [...target.items, pieza];
  // El cruce alineado por índice: si venía corto (o no había), se completa con "falta".
  const previas = (match?.entries ?? []) as MatchEntry[];
  const entries: MatchEntry[] = target.items.map((_, i) => previas[i] ?? { status: "falta", by: null, difiere: null });
  entries.push({ status: "tienes", by: prenda.nombre, difiere: null });

  const hasOutfits = Array.isArray(trip.outfits) && trip.outfits.length > 0;
  const { error } = await supabase
    .from("trips")
    .update({
      capsule_target: { ...target, items },
      capsule_match: { signature: match?.signature ?? "", entries },
      ...(hasOutfits ? { outfits_stale: true } : {}),
    })
    .eq("id", tripId)
    .eq("user_id", user.id);
  if (error) return { ok: false };
  await registrarEvento(supabase, { user_id: user.id, type: "trip_item_added", data: { trip_id: tripId, prenda: prenda.nombre } });
  revalidatePath(`/viaje/${tripId}`);
  return { ok: true };
}

const VERSION_REVISION = "revision-v1";

/** "Revisa mi maleta": la stylist lee lo que de verdad lleva y dice qué está bien, qué sobra y qué falta. */
export async function revisarMiMaleta(
  tripId: string
): Promise<{ ok: true; revision: RevisionMaleta } | { ok: false; mensaje?: string }> {
  const { supabase, user } = await sesion();
  if (!user) return { ok: false };
  const gasto = await revisarGasto(supabase, user.id);
  if (!gasto.permitido) return { ok: false, mensaje: gasto.mensaje };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false };

  const [{ data: trip }, { data: profile }] = await Promise.all([
    supabase
      .from("trips")
      .select("lugar, fecha_inicio, fecha_fin, ocasiones, weather, bolsas, maleta, lavado, contexto, capsule_target, capsule_match, overrides")
      .eq("id", tripId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("profiles").select("gender, cambio_ropa").eq("id", user.id).single(),
  ]);
  const target = trip?.capsule_target as CapsuleTarget | null;
  if (!trip || !target) return { ok: false };
  const lleva = empacablesDelViaje(target, (trip.capsule_match as CapsuleMatch | null) ?? null, (trip.overrides as CapsuleOverrides | null) ?? null);
  if (lleva.length === 0) return { ok: false };

  const closet = await loadClosetLite(supabase, user.id);
  const porNombre = new Map(closet.map((c) => [c.nombre, c]));
  const dias = tripDays(trip.fecha_inicio as string, trip.fecha_fin as string);
  const ocasiones = ((trip.ocasiones as Occasion[] | null) ?? []) as Occasion[];
  const piso = capsuleFloor(dias, ocasiones, luggageCapacity(trip.bolsas as Bolsas | null, trip.maleta as Luggage | null), {
    cambio: (profile?.cambio_ropa as "repito" | "seguido" | null) ?? null,
    lavar: (trip.lavado as boolean | null) ?? null,
  });
  const lineas = lleva
    .map((p) => {
      const c = porNombre.get(p.nombre);
      const datos = [c?.category ?? p.item.category, c?.color, c?.material, c?.patron && c.patron !== "liso" ? c.patron : null, c?.temporada && c.temporada !== "todo-el-año" ? `para ${c.temporada}` : null, c?.formalidad]
        .filter(Boolean)
        .join(", ");
      return `- ${p.nombre} (${datos})`;
    })
    .join("\n");
  const clima = textoDeClima(trip.weather as TripWeather | null) ?? "desconocido";
  const genero = profile?.gender === "hombre" ? " Es hombre." : profile?.gender === "mujer" ? " Es mujer." : "";
  const contexto = (trip.contexto as string | null)?.trim();

  const client = new Anthropic({ maxRetries: 3 });
  const response = await medirAnthropic({ supabase, userId: user.id, tarea: "viaje-revision", version: VERSION_REVISION }, JUDGE_MODEL, () =>
    client.messages.create({
      model: JUDGE_MODEL,
      max_tokens: 1500,
      thinking: { type: "disabled" },
      system: `Eres la stylist de stailist revisando la maleta REAL que alguien ya empacó.${genero} Le hablas a ella, en tuteo, cálida y directa, sin jerga de moda. Juzga con criterio de stylist profesional:
- ¿Alcanza para los días y los planes? Lo pegado a la piel (camisas, playeras, blusas) casi no se repite; suéteres, pantalones y abrigos sí.
- ¿Aguanta el clima de la parada más fría y la lluvia si la hay?
- ¿Qué SOBRA? Algo redundante (dos prendas que hacen lo mismo), que no va con el clima o que no combina con nada más de la maleta. Nombra la prenda EXACTA de la lista.
- ¿Qué FALTA de verdad? Un hueco real para un plan o el clima, dicho como tipo de prenda ("algo para la cena formal", "un segundo par de zapatos cerrados").
- ¿Cuántos looks distintos y usables salen, aproximadamente?
Sé concreta y breve. Máximo 3 cosas en cada lista; si no hay nada que decir en una, va vacía. No inventes prendas que no estén en la lista.`,
      messages: [
        {
          role: "user",
          content: `VIAJE: ${trip.lugar}, ${dias} días. Planes: ${occasionLabels(ocasiones) || "general"}. Clima: ${clima}.${contexto ? ` En sus palabras: "${contexto.slice(0, 200)}".` : ""}
LO QUE EL VIAJE PIDE COMO MÍNIMO: ${piso.base} prendas base, ${piso.bottoms} pantalones o faldas, ${piso.calzado} pares de zapatos.

LO QUE EMPACÓ (${lleva.length} prendas):
${lineas}

Revisa la maleta.`,
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              veredicto: { type: "string" },
              looks: { type: "integer" },
              bien: { type: "array", items: { type: "string" } },
              sobra: {
                type: "array",
                items: { type: "object", properties: { prenda: { type: "string" }, porque: { type: "string" } }, required: ["prenda", "porque"], additionalProperties: false },
              },
              falta: {
                type: "array",
                items: { type: "object", properties: { que: { type: "string" }, porque: { type: "string" } }, required: ["que", "porque"], additionalProperties: false },
              },
            },
            required: ["veredicto", "looks", "bien", "sobra", "falta"],
            additionalProperties: false,
          },
        },
      },
    })
  );
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text || response.stop_reason === "max_tokens") return { ok: false };
  const nombres = new Set(lleva.map((p) => p.nombre));
  const revision = leerRevision(JSON.parse(text), nombres, firmaDeMaleta(lleva.map((p) => p.nombre)));
  if (!revision) return { ok: false };
  await supabase.from("trips").update({ revision }).eq("id", tripId).eq("user_id", user.id);
  await registrarEvento(supabase, { user_id: user.id, type: "trip_revision", data: { trip_id: tripId, prendas: lleva.length, looks: revision.looks } });
  revalidatePath(`/viaje/${tripId}`);
  return { ok: true, revision };
}
