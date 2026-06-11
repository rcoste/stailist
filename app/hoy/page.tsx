import { AppShell } from "@/components/app-shell";
import { OutfitCard } from "@/components/outfit-card";

// Datos de muestra mientras conectamos el motor de IA (ANTHROPIC_API_KEY pendiente).
const DEMO_OUTFIT = {
  prendas: [
    { nombre: "Blazer marino", detalle: "estructura y presencia", swatch: "#27425F" },
    { nombre: "Jeans oscuros", detalle: "auténtico y versátil", swatch: "#2C3E50" },
    { nombre: "Tenis blancos", detalle: "limpio y sin esfuerzo", swatch: "#F5F5F0" },
  ],
  justificacion: "un look equilibrado que combina estructura y simplicidad",
};

export default function HoyPage() {
  return (
    <AppShell>
      <section className="flex flex-col gap-4 pt-4">
        <div>
          <h1 className="text-h1 font-semibold text-ink">Hoy</h1>
          <p className="text-sm text-muted">Tu look recomendado para hoy.</p>
        </div>

        <OutfitCard {...DEMO_OUTFIT} />

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-line bg-surface text-sm font-medium text-ink transition-colors duration-200 hover:border-ink"
            aria-label="Me gusta este look"
          >
            👍 Me gusta
          </button>
          <button
            type="button"
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-line bg-surface text-sm font-medium text-ink transition-colors duration-200 hover:border-ink"
            aria-label="No me gusta este look"
          >
            👎 No va
          </button>
          <button
            type="button"
            className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-accent text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            Otro look
          </button>
        </div>

        <p className="text-center text-xs text-muted">
          Demo visual — el motor de outfits se conecta en el siguiente paso.
        </p>
      </section>
    </AppShell>
  );
}
