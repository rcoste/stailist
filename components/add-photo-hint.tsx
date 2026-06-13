"use client";

import { useState } from "react";

// El upload de fotos propias aún no existe. El botón se queda visible (comunica
// la promesa) pero es honesto: al tocarlo avisa que viene pronto, en vez de
// fingir una pantalla que no está.
export function AddPhotoHint() {
  const [shown, setShown] = useState(false);

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        className="flex min-h-12 items-center rounded-full bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
      >
        + Foto
      </button>
      {shown && (
        <p className="max-w-[12rem] text-right text-xs text-muted">
          Muy pronto vas a poder sumar tus propias prendas con una foto.
        </p>
      )}
    </div>
  );
}
