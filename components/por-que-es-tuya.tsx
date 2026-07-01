import { Icon, type IconName } from "@/components/icon";
import type { CapsulePilar } from "@/lib/capsule";

const PILAR_ICON: Record<string, IconName> = {
  paleta: "paleta",
  color: "paleta",
  versatilidad: "repetir",
  vida: "repetir",
  estructura: "gancho",
  metal: "estrella",
};

// La firma trae la frase clave entre *asteriscos* → la pinta en acento.
function renderFirma(firma: string) {
  return firma.split(/(\*[^*]+\*)/g).map((part, i) =>
    part.startsWith("*") && part.endsWith("*") ? (
      <span key={i} className="text-accent">
        {part.slice(1, -1)}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

// "Por qué esta cápsula es tuya": abre con el SELLO de estilo en serif (masthead,
// no párrafo) y baja el razonamiento a pilares cortos con ícono, sobre el papel
// (sin caja). Antes era ~90 palabras de Instrument Serif a 14px en una caja rosa — bulky y
// contra el DS (la serif no es para párrafos a tamaño de cuerpo).
export function PorQueEsTuya({
  firma,
  subline,
  pilares,
  resumen,
}: {
  firma?: string;
  subline?: string;
  pilares?: CapsulePilar[];
  resumen?: string;
}) {
  return (
    <section className="flex flex-col">
      <span className="flex w-fit items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.09em] text-accent">
        <Icon name="destello" size={13} />
        Por qué es tuya
      </span>

      {firma ? (
        <p className="display mt-3 text-[22px] font-medium leading-[1.28] tracking-[-0.006em] text-ink">
          {renderFirma(firma)}
        </p>
      ) : null}

      {subline ? (
        <p className="mt-2 text-[13px] leading-[1.5] text-muted">{subline}</p>
      ) : null}

      {pilares?.length ? (
        <div className="mt-[18px]">
          {pilares.map((p, i) => (
            <div
              key={i}
              className="flex items-start gap-3 border-t border-line py-3 first:border-t-0 first:pt-1"
            >
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-sm bg-accent-soft text-accent">
                <Icon name={PILAR_ICON[p.icono ?? ""] ?? "destello"} size={16} />
              </span>
              <div className="pt-px">
                <p className="text-[13.5px] font-semibold leading-snug text-ink">{p.titulo}</p>
                <p className="mt-0.5 text-[12.5px] leading-[1.46] text-muted">{p.detalle}</p>
              </div>
            </div>
          ))}
        </div>
      ) : resumen ? (
        // Fallback legado: cápsula vieja con solo `resumen` → el párrafo, pero en
        // Hanken (NO serif) a tamaño legible.
        <p className="mt-3 text-[14px] leading-relaxed text-muted">{resumen}</p>
      ) : null}
    </section>
  );
}
