"use client";

import { useEffect, useState } from "react";
import { setEmailSemanal } from "@/lib/email-prefs";

// Ofrece el correo semanal en el momento más comprometido ("me lo puse").
// Se monta una vez en el layout y escucha "stailist:worn". Muestra el prompt
// UNA sola vez por dispositivo (flag en localStorage) y solo si el usuario
// aún no decidió. Opt-in explícito: nadie recibe correos sin tocar "sí".

const ASKED_KEY = "stailist:email-semanal-asked";

export function EmailOptIn() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onWorn = () => {
      let asked = false;
      try {
        asked = localStorage.getItem(ASKED_KEY) === "1";
      } catch {}
      if (!asked) setOpen(true);
    };
    window.addEventListener("stailist:worn", onWorn);
    return () => window.removeEventListener("stailist:worn", onWorn);
  }, []);

  function close() {
    try {
      localStorage.setItem(ASKED_KEY, "1");
    } catch {}
    setOpen(false);
  }

  async function aceptar() {
    close();
    await setEmailSemanal("semanal");
  }

  function rechazar() {
    close();
    // No hace falta escribir 'off' en DB: ya es el default. Solo no volver a preguntar.
  }

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
      <div className="animate-[emailup_300ms_ease-out] w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-xl">
        <h2 className="text-h3 font-semibold text-ink">
          ¿Te mando un look cada lunes?
        </h2>
        <p className="mt-1 text-sm text-muted">
          Un correo a la semana con un empujón para armar tu look. Nada de spam
          — te das de baja de un toque cuando quieras.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={aceptar}
            className="min-h-12 flex-1 rounded-sm bg-accent px-6 text-base font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            Sí, cada lunes
          </button>
          <button
            type="button"
            onClick={rechazar}
            className="min-h-12 rounded-sm px-4 text-sm font-medium text-muted hover:text-ink"
          >
            No, gracias
          </button>
        </div>
      </div>
      <style>{`@keyframes emailup { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
