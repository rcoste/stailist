"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/spinner";
import { saveSilueta } from "@/app/perfil/silueta/actions";
import {
  builds,
  volumes,
  buildImg,
  volumeOpt,
  volumeLabel,
  siluetaConsejo,
  type Gender,
  type Build,
  type Volume,
  type Zone,
} from "@/lib/silueta";

// Cuerpo con la zona resaltada encima (tokens: bg-accent translúcido).
function ZoneBody({
  img,
  zones,
  band,
  sizes,
}: {
  img: string;
  zones?: Zone[];
  band?: boolean;
  sizes: string;
}) {
  return (
    <div className="relative aspect-[3/4] w-full">
      <Image src={img} alt="" fill sizes={sizes} className="object-contain" />
      {(zones ?? []).map(([l, t, w, h], i) => (
        <span
          key={i}
          className="absolute rounded-full bg-accent/40"
          style={{ left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%` }}
        />
      ))}
      {band ? (
        <span
          className="absolute rounded-full bg-accent/15"
          style={{ left: "36%", top: "22%", width: "28%", height: "46%" }}
        />
      ) : null}
    </div>
  );
}

export function SiluetaFlow({
  gender,
  initialBuild,
  initialVolume,
  returnTo = "/perfil",
}: {
  gender: Gender;
  initialBuild: Build | null;
  initialVolume: Volume | null;
  /** A dónde salir al terminar (o al saltar). Desde el checklist de Home es
   *  /hoy: ahí está la lista de pasos que la persona venía siguiendo. */
  returnTo?: string;
}) {
  const router = useRouter();
  const done = !!(initialBuild && initialVolume);
  const [step, setStep] = useState<"build" | "volume" | "done">(done ? "done" : "build");
  const [build, setBuild] = useState<Build | null>(initialBuild);
  const [volume, setVolume] = useState<Volume | null>(initialVolume);
  const [saving, setSaving] = useState(false);

  const bList = builds(gender);
  const vList = volumes(gender);
  const buildCols = bList.length === 4 ? "grid-cols-2" : "grid-cols-3";

  async function pickVolume(v: Volume) {
    setVolume(v);
    setSaving(true);
    await saveSilueta(build, v);
    setSaving(false);
    setStep("done");
  }

  // --- Paso 1: complexión ---
  if (step === "build") {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Paso 1 de 2</span>
          <h2 className="text-2xl font-semibold text-ink">¿Cuál se parece a tu cuerpo?</h2>
          <p className="text-sm text-muted">
            Para mostrarte con un cuerpo como el tuyo, no una modelo. Es opcional.
          </p>
        </div>
        <div className={`grid ${buildCols} gap-3`}>
          {bList.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setBuild(b.id);
                setStep("volume");
              }}
              className={`flex flex-col items-center gap-2 rounded-sm border p-2.5 transition-colors ${
                build === b.id ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-ink"
              }`}
            >
              <ZoneBody img={b.img} sizes="(max-width: 430px) 45vw, 180px" />
              <span className="text-xs font-medium text-ink">{b.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => router.push(returnTo)}
          className="self-center text-sm font-medium text-muted hover:text-ink"
        >
          Saltar por ahora
        </button>
      </div>
    );
  }

  // --- Paso 2: dónde carga volumen/forma (sobre la complexión elegida) ---
  if (step === "volume" && build) {
    const img = buildImg(build)!;
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Paso 2 de 2</span>
          <h2 className="text-2xl font-semibold text-ink">¿Dónde sientes que cargas más?</h2>
          <p className="text-sm text-muted">Sobre tu cuerpo, marca dónde notas más.</p>
        </div>
        {saving ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <Spinner className="h-6 w-6 text-accent" />
            <span className="text-sm text-muted">Guardando…</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {vList.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => pickVolume(v.id)}
                className={`flex flex-col items-center gap-1 rounded-sm border p-2 transition-colors ${
                  volume === v.id ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-ink"
                }`}
              >
                <ZoneBody img={img} zones={v.zones} band={v.band} sizes="(max-width: 430px) 30vw, 110px" />
                <span className="text-xs font-medium text-ink">{v.label}</span>
                <span className="text-[10.5px] leading-tight text-muted">{v.desc}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setStep("build")}
          className="self-center text-sm font-medium text-muted hover:text-ink"
        >
          ← Cambiar complexión
        </button>
      </div>
    );
  }

  // --- Premio: lo que te equilibra + el efecto contrario (agencia) ---
  const consejo = volume ? siluetaConsejo(volume) : null;
  const img = buildImg(build);
  const vOpt = volumeOpt(volume);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Tu silueta</span>
        <h2 className="text-2xl font-semibold text-ink">Lo que te equilibra</h2>
      </div>
      <div className="flex gap-4 rounded-lg border border-line bg-surface p-4">
        {img ? (
          <div className="w-24 shrink-0">
            <ZoneBody img={img} zones={vOpt?.zones} band={vOpt?.band} sizes="96px" />
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <span className="w-fit rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-medium text-accent">
            {volumeLabel(volume)}
          </span>
          {consejo ? (
            <>
              <p className="text-sm text-ink">{consejo.equilibra}</p>
              <p className="text-sm text-muted">{consejo.acentua}</p>
            </>
          ) : null}
        </div>
      </div>
      {/* Sticky sobre la tab bar (patrón del PR #284): era el último elemento
          del scroll y en móvil quedaba bajo el fold (auditoría de CTAs). */}
      <div className="sticky bottom-[calc(57px+env(safe-area-inset-bottom))] z-30 -mx-4 flex gap-3 border-t border-line bg-bg px-4 pb-2 pt-2.5 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
        <button
          type="button"
          onClick={() => setStep("build")}
          className="min-h-11 flex-1 rounded-sm border border-line bg-surface text-sm font-medium text-ink transition-colors hover:border-ink"
        >
          Cambiar
        </button>
        <button
          type="button"
          onClick={() => router.push(returnTo)}
          className="min-h-11 flex-[2] rounded-sm bg-accent text-sm font-medium text-on-accent transition-colors hover:bg-accent-deep"
        >
          Listo
        </button>
      </div>
    </div>
  );
}
