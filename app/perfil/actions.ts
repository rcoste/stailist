"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STYLE_WORDS_MAX } from "@/lib/style-words";
import { referenciaPreset } from "@/lib/referencias";
import { registrarEvento } from "@/lib/telemetria";
import { withDb } from "@/lib/db";
import { isAgeRange, isMinor } from "@/lib/edad";
import { guardarEdad } from "@/lib/edad-guardar";
import { isEmailValido } from "@/lib/valid-email";
import { sendParentConsentEmail } from "@/lib/consentimiento";
import { fechaDeBorrado, fechaLegible } from "@/lib/borrado-programado";
import { sendEmail } from "@/lib/email";
import { borradoProgramadoEmail } from "@/lib/email-template";
import { marcarNavegadorSiEsMenor } from "@/lib/marca-menor-servidor";

type StyleRefPayload = {
  summary: string;
  tags: string[];
  fit?: { verdict: string; note: string } | null;
  image_paths: string[];
};

// Paths de las fotos guardadas en una referencia (tolera el shape viejo image_path).
function refPaths(ref: unknown): string[] {
  const r = ref as { image_paths?: string[]; image_path?: string } | null;
  if (!r) return [];
  if (Array.isArray(r.image_paths)) return r.image_paths;
  return r.image_path ? [r.image_path] : [];
}

// Guarda la referencia que el usuario DECIDIÓ absorber (tras ver el pushback).
// Borra las fotos de la referencia anterior si las reemplaza.
export async function saveStyleReference(
  data: StyleRefPayload
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  if (!data?.summary || !Array.isArray(data.image_paths) || data.image_paths.length === 0) {
    return { ok: false };
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("style_reference")
    .eq("id", user.id)
    .single();
  const old = refPaths(prof?.style_reference).filter((p) => !data.image_paths.includes(p));
  if (old.length) await supabase.storage.from("prendas").remove(old);

  const style_reference = {
    summary: data.summary,
    tags: data.tags ?? [],
    fit: data.fit ?? null,
    image_paths: data.image_paths,
  };
  const { error } = await supabase
    .from("profiles")
    .update({ style_reference })
    .eq("id", user.id);
  if (error) return { ok: false };
  revalidatePath("/perfil");
  return { ok: true };
}

// Aplica una referencia PRECARGADA (Carla/María) con un tap — sin fotos. El id
// se valida contra el catálogo server-side (el cliente no puede inyectar un
// summary arbitrario por esta vía). Borra las fotos de la referencia anterior.
export async function applyReferencePreset(id: string): Promise<{ ok: boolean }> {
  const preset = referenciaPreset(id);
  if (!preset) return { ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: prof } = await supabase
    .from("profiles")
    .select("style_reference")
    .eq("id", user.id)
    .single();
  const old = refPaths(prof?.style_reference);
  if (old.length) await supabase.storage.from("prendas").remove(old);

  const style_reference = {
    summary: preset.summary,
    tags: preset.tags,
    fit: null,
    image_paths: [],
    preset: preset.id,
  };
  const { error } = await supabase
    .from("profiles")
    .update({ style_reference })
    .eq("id", user.id);
  if (error) return { ok: false };
  revalidatePath("/perfil");
  return { ok: true };
}

// El usuario DESCARTÓ el preview → borra las fotos huérfanas que se subieron.
export async function discardStyleReference(
  paths: string[]
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const mine = (paths ?? []).filter((p) => p.startsWith(`${user.id}/`));
  if (mine.length) await supabase.storage.from("prendas").remove(mine);
  return { ok: true };
}

// Quita el estilo de referencia guardado: borra sus fotos y limpia la columna.
export async function removeStyleReference(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: prof } = await supabase
    .from("profiles")
    .select("style_reference")
    .eq("id", user.id)
    .single();
  const paths = refPaths(prof?.style_reference);
  if (paths.length) await supabase.storage.from("prendas").remove(paths);

  const { error } = await supabase
    .from("profiles")
    .update({ style_reference: null })
    .eq("id", user.id);
  if (error) return { ok: false };
  revalidatePath("/perfil");
  return { ok: true };
}

// "Tu estilo en tus palabras": texto libre opcional que entra a todos los
// motores. Cadena vacía = quitarlo (guarda null).
export async function saveStyleWords(words: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const clean = (words ?? "").trim().slice(0, STYLE_WORDS_MAX);
  const { error } = await supabase
    .from("profiles")
    .update({ style_words: clean.length ? clean : null })
    .eq("id", user.id);
  if (error) return { ok: false };
  revalidatePath("/perfil");
  return { ok: true };
}

// Cierra la sesión y manda al login. No es destructivo (se puede volver a entrar
// con el código OTP), por eso no pide confirmación.
export async function signOut() {
  const supabase = await createClient();
  // Una cuenta de 13-17 sale con la marca que apaga las etiquetas de la landing
  // (lib/marca-menor-servidor.ts). Antes del signOut: después ya no hay sesión.
  await marcarNavegadorSiEsMenor(supabase);
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Registra que alguien ABRIÓ la pestaña "estilo" del perfil.
 *
 * Existe para separar dos hipótesis que hoy no podemos distinguir: los campos
 * de esa pantalla (referencia y palabras) llevan semanas vacíos, y eso puede
 * ser porque la petición no convence o porque nadie llega. Sin este dato, un
 * rediseño se estrena con las mismas cero personas.
 *
 * Se llama una vez por montaje de la pestaña, no por render. Best-effort: si
 * falla, no rompe nada ni se le dice al usuario — es telemetría, no producto.
 * En modo "ver como" del admin ni siquiera corre (el proxy bloquea los POST),
 * que es justo lo que queremos: las visitas del admin no cuentan.
 */
export async function logEstiloTabView(): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await registrarEvento(supabase, {
      user_id: user.id,
      type: "perfil_estilo_view",
    });
  } catch {
    // silencio a propósito
  }
}

// ── El dial de registro por plan (lib/registro-plan.ts) ──────────────────────
// Guarda UN paso a la vez y mergea: el jsonb sólo lleva los planes movidos;
// volver a "normal" borra la llave (el default es el consenso, no un valor).
export async function guardarRegistroPlan(
  planKey: string,
  valor: "relajado" | "arreglado" | null
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: prof } = await supabase
    .from("profiles")
    .select("registro_por_plan")
    .eq("id", user.id)
    .single();
  const actual = (prof?.registro_por_plan ?? {}) as Record<string, string>;
  const siguiente = { ...actual };
  if (valor === "relajado" || valor === "arreglado") siguiente[planKey] = valor;
  else delete siguiente[planKey];

  const { error } = await supabase
    .from("profiles")
    .update({ registro_por_plan: Object.keys(siguiente).length ? siguiente : null })
    .eq("id", user.id);
  if (error) return { ok: false };
  revalidatePath("/perfil");
  return { ok: true };
}

// ── El apetito de acentos (lib/looks.ts, docs/designs/pantalla-apetito-acentos.md) ──
// Elegir aquí SIEMPRE gana sobre la semilla derivada de los swipes: se escribe
// la fuente 'elegido' y ningún backfill vuelve a pisarlo. Es la misma jerarquía
// del dial de registro — lo que la persona dice de sí misma manda sobre lo que
// dedujimos de ella.
export async function guardarApetitoAcentos(
  valor: "discreto" | "medio" | "protagonista"
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("profiles")
    .update({ acento_apetito: valor, acento_apetito_fuente: "elegido" })
    .eq("id", user.id);
  if (error) return { ok: false };
  revalidatePath("/perfil");
  return { ok: true };
}

// ─── CORREOS: OPT-IN ─────────────────────────────────────────────────────────
//
// La respuesta a "¿te mando un look cada lunes?" (card del home tras el primer
// 👍) y el toggle de Perfil › cuenta. `journey_state.correo_preguntado` es lo
// que evita volver a preguntar: se marca con cualquiera de las dos respuestas.
export async function responderCorreoSemanal(
  quiere: boolean
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: p } = await supabase
    .from("profiles")
    .select("journey_state")
    .eq("id", user.id)
    .single();
  const journey = ((p?.journey_state as Record<string, unknown> | null) ?? {});
  const { error } = await supabase
    .from("profiles")
    .update({
      email_semanal: quiere ? "semanal" : "off",
      journey_state: { ...journey, correo_preguntado: true },
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) return { ok: false };
  if (!quiere) {
    await registrarEvento(supabase, {
      user_id: user.id,
      type: "email_unsubscribed",
      data: { via: "app" },
    });
  }
  revalidatePath("/hoy");
  revalidatePath("/perfil");
  return { ok: true };
}

// ─── EDAD: CORREGIRLA DESDE PERFIL ───────────────────────────────────────────
//
// Hasta el 2026-09-06 la edad era inmutable: quien se equivocaba de rango
// quedaba atrapado hasta que Roberto lo corrigiera a mano. Ahora se cambia
// aquí, con la misma regla que el onboarding (lib/edad-guardar.ts): pasar a
// 13-17 invalida cualquier consentimiento previo y exige correo de tutor.
export async function cambiarEdad(
  range: string,
  parentEmail: string | null
): Promise<{ ok: boolean; mensaje?: string }> {
  if (!isAgeRange(range)) return { ok: false, mensaje: "elige un rango." };
  const menor = isMinor(range);
  if (menor && !isEmailValido(parentEmail ?? "")) {
    return { ok: false, mensaje: "para 13-17 necesito el correo de tu papá, mamá o tutor." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const r = await withDb((c) =>
    guardarEdad(c, { uid: user.id, range, parentEmail: menor ? parentEmail : null, soloSiVacia: false })
  );
  if (!r) return { ok: false, mensaje: "no se guardó — inténtalo de nuevo." };
  if (menor && r.token && parentEmail) {
    const sent = await sendParentConsentEmail(parentEmail, r.token);
    if (!sent.ok) console.error(`parent_consent_email_failed: ${sent.error}`);
  }
  revalidatePath("/perfil");
  return { ok: true };
}

// ─── BORRAR MI CUENTA ────────────────────────────────────────────────────────
//
// Lo que promete el aviso de privacidad: un botón. Desde el 2026-09-10 el botón
// PROGRAMA el borrado (lib/borrado-programado.ts): la cuenta se bloquea hoy y
// la limpieza diaria la borra entera a los 30 días — archivos, filas y usuario
// de auth, en el orden de lib/borrar-cuenta.ts. Si la persona entra antes,
// elige recuperarla.
export async function borrarMiCuenta(
  confirmacion: string
): Promise<{ ok: false; mensaje: string } | never> {
  if (confirmacion.trim().toLowerCase() !== "borrar") {
    return { ok: false, mensaje: 'escribe "borrar" para confirmar.' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Antes de cerrar la sesión: "/?adios=1" es zona medida
  // (lib/marca-menor-servidor.ts).
  await marcarNavegadorSiEsMenor(supabase, user.id);

  const para = fechaDeBorrado(new Date());
  const { data: fila, error } = await supabase
    .from("profiles")
    .update({ borrado_programado_para: para.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select("email, email_unsub_token")
    .single();
  if (error || !fila) {
    console.error(`[borrado-programado] no se pudo programar ${user.id}: ${error?.message ?? "sin fila"}`);
    return { ok: false, mensaje: "no pude programar el borrado — inténtalo de nuevo o escríbenos a hola@stailist.co." };
  }

  await registrarEvento(supabase, {
    user_id: user.id,
    type: "cuenta_borrado_programado",
    data: { para: para.toISOString() },
  });

  // El correo es la única forma de avisarle la fecha y que puede volver. Best-
  // effort: si Postmark falla, el borrado sigue programado y la pantalla de
  // cuenta programada le dice la fecha en cuanto entre.
  const correo = (fila.email as string | null) ?? user.email ?? null;
  if (correo) {
    const r = await sendEmail({
      to: correo,
      ...borradoProgramadoEmail({
        fecha: fechaLegible(para),
        unsubToken: (fila.email_unsub_token as string | null) ?? null,
      }),
    });
    if (!r.ok) console.error(`[borrado-programado] no salió el correo: ${r.error}`);
  }

  await supabase.auth.signOut();
  redirect("/?adios=1");
}
