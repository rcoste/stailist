"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { ChangeAvatar } from "@/components/change-avatar";
import { InstallAppRow } from "@/components/install-app-row";
import { ColorimetriaSection } from "@/components/colorimetria-section";
import { StyleVetoesSection } from "@/components/style-vetoes-section";
import type { Season } from "@/lib/colorimetria";
import type { Gender, StyleVetoes } from "@/lib/vetoes";

type Tab = "cuenta" | "estilo" | "prefs";

export type PerfilTabsProps = {
  name: string;
  email: string;
  avatarUrl: string | null;
  season: Season | null;
  flow: Season | null;
  archetype: { nombre: string; descripcion: string } | null;
  tasteTags: string[];
  gender: Gender | null;
  styleVetoes: StyleVetoes;
  siluetaLabel: string | null; // "Promedio · Parejo" o null si no hay
  banner: {
    title: string; // estación o fallback
    sub: string | null; // "Pulido versátil · metal oro"
    swatches: string[]; // mejores
  };
  signOut: () => void;
};

// Wordmark "stailist" con el "ai" tintado (sobre fondo burdeos: blanco translúcido).
// `.display` (Bodoni) sin forzar weight → lo fija font-semibold (la itálica del
// .editorial no aplica aquí: el banner lo quiere recto, peso 600).
function Wordmark() {
  return (
    <span className="display text-sm font-semibold tracking-tight">
      st<span className="text-on-accent/60">ai</span>list
    </span>
  );
}

// Perfil reorganizado en mini-tabs: Cuenta (default) · Estilo · Preferencias.
// Cambiar de pestaña no recarga; cada una es corta (sin scroll largo). Todos los
// datos llegan ya resueltos del server; el estado editable vive en las secciones
// existentes (ColorimetriaSection, StyleVetoesSection).
export function PerfilTabs(props: PerfilTabsProps) {
  const [tab, setTab] = useState<Tab>("cuenta");

  const TABS: { id: Tab; label: string }[] = [
    { id: "cuenta", label: "cuenta" },
    { id: "estilo", label: "estilo" },
    { id: "prefs", label: "preferencias" },
  ];

  return (
    <section className="flex flex-col gap-5 pt-4">
      <h1 className="text-[30px] font-bold leading-none tracking-[-0.02em] text-ink">perfil</h1>

      {/* Segmented control de página */}
      <div
        role="tablist"
        aria-label="Secciones del perfil"
        className="flex gap-1.5 rounded-sm border border-line bg-bg p-1"
      >
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-[2px] py-2 text-center text-[13px] font-semibold transition-colors duration-200 ${
                on
                  ? "bg-surface text-ink shadow-[var(--shadow-hairline)]"
                  : "text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "cuenta" ? <CuentaTab {...props} /> : null}
      {tab === "estilo" ? <EstiloTab {...props} /> : null}
      {tab === "prefs" ? <PrefsTab {...props} /> : null}
    </section>
  );
}

function CuentaTab({ name, email, avatarUrl, signOut }: PerfilTabsProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Hero de identidad */}
      <div className="flex items-center gap-4 rounded-lg border border-line bg-surface p-4">
        {avatarUrl ? (
          <div className="relative h-[72px] w-[58px] shrink-0 overflow-hidden rounded-md border border-line bg-bg">
            <Image src={avatarUrl} alt="Tu foto" fill sizes="58px" className="object-cover" />
          </div>
        ) : (
          <span className="flex h-[72px] w-[58px] shrink-0 items-center justify-center rounded-md border border-dashed border-line bg-bg text-muted">
            <Icon name="persona" size={24} />
          </span>
        )}
        <div className="flex min-w-0 flex-col">
          <span className="editorial text-[19px] leading-tight text-ink">{name}</span>
          <span className="truncate text-xs text-muted">{email}</span>
          <ChangeAvatar hasAvatar={!!avatarUrl} />
        </div>
      </div>

      <InstallAppRow />

      <a
        href="mailto:hola@stailist.co?subject=Mi%20opini%C3%B3n%20de%20stailist"
        className="flex items-center gap-3 rounded-md border border-line bg-surface p-4 transition-colors hover:border-accent"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon name="corazon" size={16} />
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-ink">danos tu opinión</span>
          <span className="text-xs text-muted">qué te gusta, qué no, qué falta.</span>
        </div>
        <Icon name="chevron" size={16} className="ml-auto shrink-0 text-muted" />
      </a>

      <form action={signOut}>
        <button
          type="submit"
          className="flex min-h-12 w-full items-center justify-center rounded-md border border-line bg-surface text-sm font-medium text-muted transition-colors hover:border-ink hover:text-ink"
        >
          cerrar sesión
        </button>
      </form>
    </div>
  );
}

function EstiloTab({
  season,
  flow,
  archetype,
  tasteTags,
  gender,
  siluetaLabel,
  banner,
}: PerfilTabsProps) {
  const showSilueta = gender === "mujer" || gender === "hombre";
  return (
    <div className="flex flex-col gap-4">
      {/* Banner del pasaporte: tarjeta NEGRA con la paleta como único color
          (asoma identidad, su acción es VER). */}
      <Link
        href="/perfil/pasaporte"
        className="block overflow-hidden rounded-lg bg-accent text-on-accent shadow-[0_6px_20px_rgba(20,20,20,.16)]"
      >
        <div className="flex items-center justify-between px-4 pt-3.5">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.13em] text-on-accent/70">
            Pasaporte de estilo
          </span>
          <Wordmark />
        </div>
        <div className="px-4 pb-4 pt-2.5">
          <div className="editorial text-[23px] leading-[1.05]">{banner.title}</div>
          {banner.sub ? (
            <div className="text-xs text-on-accent/80">{banner.sub}</div>
          ) : null}
          {banner.swatches.length > 0 ? (
            <div className="my-3 flex flex-wrap gap-1.5">
              {banner.swatches.map((hex, i) => (
                <span
                  key={i}
                  className="h-7 w-7 rounded-full border border-on-accent/40"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          ) : (
            <div className="h-2" />
          )}
          <span className="flex min-h-[42px] items-center justify-center gap-2 rounded-sm bg-surface text-sm font-medium text-accent">
            ver mi pasaporte
            <Icon name="chevron" size={16} />
          </span>
        </div>
      </Link>

      {/* Tu ADN de estilo: una sola card, segmentos separados por hairline */}
      <div className="rounded-lg border border-line bg-surface">
        <div className="p-4">
          <ColorimetriaSection season={season} flow={flow} />
        </div>

        <div className="flex flex-col gap-2.5 border-t border-line p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Estilo
            </span>
            <Link
              href="/perfil/estilo"
              className="shrink-0 text-[11.5px] font-medium text-accent hover:text-accent-deep"
            >
              {archetype ? "¿cambió? rehazlo" : "descúbrelo"}
            </Link>
          </div>
          {archetype ? (
            <>
              <span className="editorial text-h3 leading-tight text-ink">
                {archetype.nombre}
              </span>
              {tasteTags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {tasteTags.map((t) => (
                    <span
                      key={t}
                      className="rounded-sm border border-line bg-bg px-2.5 py-1 text-xs capitalize text-muted"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <span className="text-sm text-muted">Aún no tenemos tu estilo.</span>
          )}
        </div>

        {showSilueta ? (
          <Link
            href="/perfil/silueta"
            className="flex items-center gap-3 border-t border-line p-4 transition-colors hover:bg-bg"
          >
            <div className="flex min-w-0 flex-col">
              <span className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                Silueta
              </span>
              <span className="text-sm font-medium text-ink">
                {siluetaLabel ?? "cuéntame de tu cuerpo"}
              </span>
            </div>
            <Icon name="chevron" size={16} className="ml-auto shrink-0 text-muted" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function PrefsTab({ gender, styleVetoes }: PerfilTabsProps) {
  return <StyleVetoesSection gender={gender} initial={styleVetoes} />;
}
