"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function addToAllowlist(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) return;

  const supabase = await createClient();
  await supabase.from("allowlist").upsert({ email }, { onConflict: "email" });
  revalidatePath("/admin/allowlist");
  // La vista de waitlist muestra un badge "ya invitado" derivado de la
  // allowlist — al invitar desde ahí, refréscala también.
  revalidatePath("/admin/waitlist");
}

export async function removeFromAllowlist(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "");
  if (!email) return;

  const supabase = await createClient();
  await supabase.from("allowlist").delete().eq("email", email);
  revalidatePath("/admin/allowlist");
}
