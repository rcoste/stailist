"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { registrarCompartido } from "@/lib/compartir-actions";
import { linkDeInvitacion } from "@/lib/viaje-invitacion-actions";

// "¿VIAJAS CON ALGUIEN?" (2026-10-16, boceto 2 de crecimiento). Manda el link
// del viaje: la otra persona entra con la ruta y las fechas puestas y arma SU
// maleta. Por debajo, cuántas ya lo hicieron (sólo lo ve quien invitó).
export function InvitarViaje({ tripId, destino, unidos }: { tripId: string; destino: string; unidos: string | null }) {
  const [busy, setBusy] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState(false);

  async function invitar() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const token = await linkDeInvitacion(tripId);
      if (!token) throw new Error("sin link");
      const url = `${window.location.origin}/v/${token}`;
      const texto = `voy a ${destino} y armé mi maleta con stailist. arma la tuya con tu ropa, la ruta y las fechas ya están puestas:`;
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: `viaje a ${destino}`, text: texto, url });
          void registrarCompartido("viaje", "share");
        } catch {
          /* canceló el diálogo: sin drama */
        }
      } else {
        await navigator.clipboard.writeText(`${texto} ${url}`);
        void registrarCompartido("viaje", "link");
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2200);
      }
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border-2 border-ink bg-surface p-4">
      <span className="text-[16px] font-bold text-ink">¿viajas con alguien?</span>
      <p className="text-[13.5px] leading-snug text-muted">
        mándale el viaje: llega con la ruta y las fechas puestas y arma su maleta con su ropa. no ve la tuya.
      </p>
      <button
        type="button"
        onClick={invitar}
        disabled={busy}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[14px] font-semibold text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-60"
      >
        {busy ? <Spinner className="h-4 w-4 text-on-accent" /> : <Icon name="compartir" size={16} />}
        {copiado ? "link copiado" : "invitar a este viaje"}
      </button>
      {error ? <span className="text-[12.5px] text-error">no pude crear el link — reintenta en un momento.</span> : null}
      {unidos ? (
        <span className="flex items-center gap-2 text-[13px] text-ink">
          <Icon name="check" size={14} />
          {unidos}
        </span>
      ) : null}
    </div>
  );
}
