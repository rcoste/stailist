"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Acceso rápido SOLO para desarrollo local: entra con contraseña (sin magic
// link) como un usuario de prueba. Triple candado para que jamás funcione en
// producción: (1) gate por NODE_ENV aquí, (2) los botones no se renderizan en
// prod, (3) DEV_LOGIN_PASSWORD no existe en el entorno de Vercel.
const DEV_USERS = ["roberto.dev@stailist.app", "claude.dev@stailist.app"];

export async function devLogin(formData: FormData) {
  if (process.env.NODE_ENV === "production") return;

  const email = String(formData.get("email") ?? "");
  if (!DEV_USERS.includes(email)) return;

  const password = process.env.DEV_LOGIN_PASSWORD;
  if (!password) redirect("/login?error=dev");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=dev");

  redirect("/");
}
