"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icon";
import { enviarReporte } from "@/lib/reportes";

// EL BUZÓN, en una hoja. Roberto, 2026-09-09: "algún botón para que los
// usuarios puedan reportar algún problema o sugerencia… es más fácil que de
// memoria me lo expliquen".
//
// TRES DECISIONES QUE NO SON COSMÉTICAS:
//
// 1. NO se pregunta dónde estaba ni qué versión trae. Eso viaja solo (ruta,
//    versión, últimos eventos, fallos de IA recientes — ver lib/reportes.ts).
//    Pedírselo es pedirle que haga de soporte técnico, y quien está molesto
//    porque algo falló no escribe informes.
//
// 2. NO se obliga a clasificar antes de escribir. El tipo (problema/idea) está
//    ahí, con "problema" por defecto, pero se puede mandar sin tocarlo:
//    obligar a elegir antes del texto frena el impulso, que es lo único que
//    hace que un reporte exista.
//
// 3. El acuse dice qué pasa DESPUÉS ("lo leo yo, en serio"), no "gracias por
//    tu feedback". Val falló cuatro veces el 2026-09-09 y no reportó nada; lo
//    que hace que alguien escriba la segunda vez es haber sentido que la
//    primera sirvió de algo.
export function ReporteSheet({ onClose }: { onClose: () => void }) {
  const ruta = usePathname();
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<"problema" | "idea">("problema");
  const [enviando, startTransition] = useTransition();
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function enviar() {
    if (!texto.trim() || enviando) return;
    setError(null);
    startTransition(async () => {
      const r = await enviarReporte({ texto, tipo, ruta });
      if (r.ok) setListo(true);
      else setError("No pude mandarlo. ¿Lo intentas otra vez?");
    });
  }

  if (listo) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-tile text-ink">
          <Icon name="check" size={22} />
        </span>
        <p className="text-[17px] font-bold text-ink">Llegó</p>
        <p className="max-w-xs text-[14px] leading-relaxed text-muted">
          Lo leo yo, en serio — no es un buzón que nadie abre. Si hace falta, te escribo.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-1 min-h-11 rounded-sm bg-accent px-6 text-[14px] font-bold text-on-accent transition-colors hover:bg-accent-deep"
        >
          listo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-[22px] font-bold tracking-[-0.01em] text-ink">cuéntame</h3>
        <p className="text-[13.5px] leading-relaxed text-muted">
          Algo que no jaló, algo que te gustaría, algo que te chocó. Lo que sea.
        </p>
      </div>

      <div className="flex gap-2">
        {(["problema", "idea"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            aria-pressed={tipo === t}
            className={`min-h-11 flex-1 rounded-sm border px-3 text-[13px] font-semibold transition-colors ${
              tipo === t
                ? "border-accent bg-accent text-on-accent"
                : "border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {t === "problema" ? "algo falló" : "una idea"}
          </button>
        ))}
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={5}
        autoFocus
        placeholder={
          tipo === "problema"
            ? "qué estabas haciendo y qué pasó…"
            : "qué te gustaría que hiciera…"
        }
        className="w-full rounded-sm border border-line bg-surface p-3 text-[15px] text-ink outline-none placeholder:text-faint focus:border-ink"
      />

      {/* Se dice que el contexto va solo: si no, la persona cree que tiene que
          explicar en qué pantalla estaba y con qué versión. */}
      <p className="text-[12px] leading-relaxed text-faint">
        Va con la pantalla en la que estás y lo que acaba de pasar — no tienes que explicarlo.
      </p>

      {error ? <p className="text-[13px] font-medium text-error">{error}</p> : null}

      <button
        type="button"
        onClick={enviar}
        disabled={!texto.trim() || enviando}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors hover:bg-accent-deep disabled:bg-accent-soft disabled:text-faint"
      >
        {enviando ? "mandando…" : "mandar"}
      </button>
    </div>
  );
}
