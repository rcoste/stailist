"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { registrarEvento } from "@/lib/telemetria";
import { registrarError } from "@/lib/errores";
import { MAX_FALLOS } from "@/lib/avisos-push";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "sin_sesion" };
  if (!valida(s)) {
    // Que se VEA (/admin/errores). Si un navegador real entrega una dirección
    // de un servicio que no está en la lista, esa persona dice "sí" y no queda
    // suscrita: sin este renglón nadie se enteraría. Sólo el nombre del
    // servidor, nunca la dirección completa.
    let host = "ilegible";
    try {
      host = new URL(s.endpoint).hostname;
    } catch {}
    await registrarError(supabase, {
      userId: user.id,
      origen: "servidor",
      clave: "push:suscripcion-rechazada",
      pantalla: motivo.slice(0, 40),
      tecnico: host,
    });
    return { ok: false, motivo: "invalida" };
  }

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
    await registrarError(supabase, {
      userId: user.id,
      origen: "servidor",
      clave: "push:suscripcion-no-guardada",
      pantalla: motivo.slice(0, 40),
      tecnico: `${error.code ?? "?"} ${error.message}`,
    });
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
 * ¿El SERVIDOR tiene viva la suscripción de este teléfono para ESTA cuenta?
 * El navegador sólo sabe que existe una suscripción, no de quién es ni si
 * sirve. Sin esta pregunta el interruptor de Perfil decía "activado" cuando la
 * dirección era de otra cuenta (teléfono compartido, o una persona con dos
 * cuentas), cuando no se había podido guardar, o cuando ya se había dado por
 * rota. La RLS sólo deja ver filas propias, así que una ajena responde false.
 */
export async function suscripcionViva(endpoint: string): Promise<boolean> {
  if (typeof endpoint !== "string" || !endpoint) return false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("endpoint", endpoint)
    .is("revoked_at", null)
    .lt("fallos", MAX_FALLOS)
    .limit(1);
  return !!data?.length;
}

/**
 * Apaga los avisos de la CUENTA y BORRA todas sus direcciones, la de este
 * teléfono y las de cualquier otro. /privacidad promete "al apagarlo borramos
 * esa dirección": borrar sólo la de este navegador dejaba las demás guardadas.
 */
export async function apagarAvisos(endpoint: string | null, via: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  // `endpoint` ya no decide qué se borra (se borra todo lo de la cuenta); se
  // conserva en la firma porque el navegador lo manda y deja ver de dónde vino.
  void endpoint;
  const borrado = await supabase.from("push_subscriptions").delete().eq("user_id", user.id);
  if (borrado.error) return { ok: false };
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
