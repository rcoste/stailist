"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { AGE_RANGES, isMinor, type AgeRange } from "@/lib/edad";
import { isEmailValido } from "@/lib/valid-email";
import { saveAge } from "./actions";

// Selección de rango de edad + CTA. Si eligen el rango de menor (13-17), se
// pide el correo del tutor + check de "ya hablé con ellos". El onboarding
// continúa sin esperar, pero SUBIR FOTOS queda bloqueado hasta que el tutor
// confirme el link (ver lib/consentimiento). La server action lee los hidden.
export function EdadPicker() {
  const [sel, setSel] = useState<AgeRange | null>(null);
  const [ack, setAck] = useState(false);
  const [parentEmail, setParentEmail] = useState("");

  const menor = isMinor(sel);
  const emailOk = isEmailValido(parentEmail);
  const puedeSeguir = !!sel && (!menor || (ack && emailOk));

  return (
    <form action={saveAge} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {AGE_RANGES.map((o) => {
          const on = sel === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setSel(o.id)}
              aria-pressed={on}
              className={`flex min-h-[64px] items-center justify-center border bg-surface px-4 py-4 text-[19px] font-semibold text-ink transition-colors ${
                on
                  ? "border-ink shadow-[inset_0_0_0_1px_var(--c-ink)]"
                  : "border-line hover:border-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {menor ? (
        <div className="mt-1 flex flex-col gap-3 border border-line bg-bg px-4 py-4">
          <p className="text-[15px] leading-snug text-ink">
            Como eres menor de edad, necesitamos el permiso de tus papás o
            tutores — sobre todo porque vas a subir fotos tuyas. Danos su correo
            y les mandamos un link para que lo confirmen (les toma un minuto).
          </p>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="correo de tu papá, mamá o tutor"
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
            className="min-h-[48px] rounded-sm border border-line bg-surface px-4 text-base text-ink placeholder:text-muted focus:border-ink focus:outline-none"
          />
          <label className="flex items-start gap-3 text-[15px] leading-snug text-ink">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="mt-[3px] h-[18px] w-[18px] shrink-0 accent-[var(--c-accent)]"
            />
            <span>Ya hablé con ellos y saben que voy a usar Stailist.</span>
          </label>
          <p className="text-[13px] leading-snug text-muted">
            Puedes explorar la app mientras confirman; subir fotos se desbloquea
            con su permiso.
          </p>
        </div>
      ) : null}

      <input type="hidden" name="age_range" value={sel ?? ""} />
      <input type="hidden" name="minor_ack" value={menor && ack ? "1" : ""} />
      <input type="hidden" name="parent_email" value={menor ? parentEmail.trim() : ""} />
      {/* CTA sticky (mismo patrón que el checklist del clóset): con el bloque
          de consentimiento parental abierto, "seguir" caía bajo el fold. */}
      <div className="sticky bottom-0 mt-3 bg-bg pb-4 pt-2">
        <button
          type="submit"
          disabled={!puedeSeguir}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[16px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:opacity-40"
        >
          seguir <Icon name="flecha" size={19} />
        </button>
      </div>
    </form>
  );
}
