import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { PROMPT_VERSION } from "@/lib/engine/prompt";
import { NuevaCorridaMotor } from "./nueva-motor";

export const dynamic = "force-dynamic";

export default async function NuevaMotor() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-ink">Comparar motores</h1>
          <Link href="/admin/comparador" className="text-sm font-semibold text-accent">
            Volver
          </Link>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Dos variantes del motor arman looks sobre los mismos días y tu mismo
          clóset. Votas a ciegas cuál quedó mejor, y al final se revela qué era
          cada una. Prompt vigente: {PROMPT_VERSION}.
        </p>
      </header>
      <NuevaCorridaMotor />
    </div>
  );
}
