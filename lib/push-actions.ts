"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { registrarEvento } from "@/lib/telemetria";
import { esServicioDePush } from "@/lib/avisos-push";

// LO QUE EL NAVEGADOR LE PIDE AL SERVIDOR SOBRE LOS AVISOS PUSH.
//
// Una suscripción se crea SÓLO con un sí explícito de la persona (el prompt
// tras el primer 👍 o el interruptor de Perfil). No hay re-suscripción en
// silencio: en un teléfono compartido, quien entra después no debe heredar
// el permiso de quien salió. Si el endpoint ya es de otra cuenta, la base lo
// rechaza (RLS) y el navegador pide uno nuevo (lib/push-navegador.ts).

export type SuscripcionDelNavegador = { endpoint: string; p256dh: string; auth: string };

export type ResultadoGuardar =
  | { ok: true }
  | { ok: false; motivo: "sin_sesion" | "invalida" | "endpoint_ajeno" | "error" };

const BASE64URL = /^[A-Za-z0-9_-]{16,256}$/;

function valida(s: SuscripcionDelNavegador): boolean {
  // Sólo direcciones de Google, Apple, Mozilla o Microsoft (lib/avisos-push.ts).
  if (!esServicioDePush(s.endpoint)) return false;
  return BASE64URL.test(s.p256dh) && BASE64URL.test(s.auth);
}

export async function guardarSuscripcion(
  s: SuscripcionDelNavegador,
  userAgent: string | null,
  motivo: string
): Promise<ResultadoGuardar> {
  if (!valida(s)) return { ok: false, motivo: "invalida" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "sin_sesion" };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: s.endpoint,
      p256dh: s.p256dh,
      auth: s.auth,
      user_agent: userAgent ? userAgent.slice(0, 200) : null,
      revoked_at: null,
      fallos: 0,
    },
    { onConflict: "endpoint" }
  );
  if (error) {
    // 42501 = la RLS no dejó tocar una fila que es de otra cuenta; 23505 = el
    // único choque posible es el endpoint. Las dos dicen lo mismo: ese
    // endpoint ya tiene dueña. El navegador pedirá otro.
    if (error.code === "42501" || error.code === "23505") return { ok: false, motivo: "endpoint_ajeno" };
    console.error("[push] no se guardó la suscripción:", error.message);
    return { ok: false, motivo: "error" };
  }
  await supabase
    .from("profiles")
    .update({ avisos_push: "on", updated_at: new Date().toISOString() })
    .eq("id", user.id);
  await registrarEvento(supabase, {
    user_id: user.id,
    type: "push_suscrito",
    data: { motivo: motivo.slice(0, 40) },
  });
  revalidatePath("/perfil");
  return { ok: true };
}

/**
 * Apaga los avisos de la CUENTA (todos sus teléfonos dejan de recibir en el
 * próximo cron) y borra la suscripción de este navegador si la manda.
 */
export async function apagarAvisos(endpoint: string | null, via: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  if (endpoint) {
    await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  }
  const { error } = await supabase
    .from("profiles")
    .update({ avisos_push: "off", updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { ok: false };
  await registrarEvento(supabase, {
    user_id: user.id,
    type: "push_rechazado",
    data: { via: via.slice(0, 40) },
  });
  revalidatePath("/perfil");
  return { ok: true };
}

const EVENTOS_DEL_NAVEGADOR = new Set(["push_prompt_shown", "push_rechazado", "push_abierto"]);

/** Huellas que deja el navegador: se le ofreció, dijo que no, entró desde un aviso. */
export async function registrarAviso(
  evento: "push_prompt_shown" | "push_rechazado" | "push_abierto",
  data: Record<string, string> = {}
): Promise<void> {
  if (!EVENTOS_DEL_NAVEGADOR.has(evento)) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await registrarEvento(supabase, { user_id: user.id, type: evento, data });
}
