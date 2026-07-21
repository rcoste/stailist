"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { ConfirmDelete } from "@/components/confirm-delete";
import { deleteTrip } from "@/lib/delete-actions";

// Borrar el viaje, desde su propio detalle. Discreto y al pie: es la salida, no
// una acción del viaje. Los looks que hayas guardado del viaje SOBREVIVEN en el
// historial (outfits.trip_id es ON DELETE SET NULL desde 0054), y el copy lo dice.
export function DeleteTripButton({ tripId, lugar }: { tripId: string; lugar: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        disabled={borrando}
        className="mt-5 flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-error disabled:opacity-50"
      >
        <Icon name="equis" size={14} />
        {borrando ? "borrando…" : "borrar este viaje"}
      </button>

      <ConfirmDelete
        open={confirmando}
        titulo={`¿borrar tu viaje a ${lugar}?`}
        detalle="se va la maleta y su lista. los looks que guardaste de este viaje se quedan en tu historial."
        confirmar="sí, bórralo"
        onCancel={() => setConfirmando(false)}
        onConfirm={async () => {
          setConfirmando(false);
          setBorrando(true);
          const res = await deleteTrip(tripId);
          if (res.ok) router.push("/viaje/lista");
          else setBorrando(false);
        }}
      />
    </>
  );
}
