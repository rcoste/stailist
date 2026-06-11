import { AppShell } from "@/components/app-shell";

// Mismo catálogo sembrado en supabase/migrations/0002 (se leerá de la DB con auth).
const BASICOS = [
  { nombre: "Camiseta blanca", swatch: "#F5F5F0" },
  { nombre: "Camiseta negra", swatch: "#1A1A1A" },
  { nombre: "Camisa blanca", swatch: "#FAFAF7" },
  { nombre: "Camisa azul claro", swatch: "#AEC6E8" },
  { nombre: "Suéter gris", swatch: "#8A8784" },
  { nombre: "Blazer azul marino", swatch: "#27425F" },
  { nombre: "Chamarra de mezclilla", swatch: "#4A6B8A" },
  { nombre: "Abrigo camel", swatch: "#B08D57" },
  { nombre: "Jeans azul oscuro", swatch: "#2C3E50" },
  { nombre: "Pantalón negro", swatch: "#1A1A1A" },
  { nombre: "Chinos beige", swatch: "#C8B89A" },
  { nombre: "Vestido negro", swatch: "#1A1A1A" },
  { nombre: "Tenis blancos", swatch: "#F5F5F0" },
  { nombre: "Zapato formal negro", swatch: "#1A1A1A" },
  { nombre: "Botas negras", swatch: "#1A1A1A" },
];

export default function ClosetPage() {
  return (
    <AppShell>
      <section className="flex flex-col gap-4 pt-4">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-h1 font-semibold text-ink">Clóset</h1>
            <p className="text-sm text-muted">
              Tu clóset arranca con 15 básicos.
            </p>
          </div>
          <button
            type="button"
            className="flex min-h-12 items-center rounded-full bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            + Foto
          </button>
        </div>

        <ul className="grid grid-cols-3 gap-3">
          {BASICOS.map((b) => (
            <li key={b.nombre} className="flex flex-col gap-1.5">
              <div
                className="aspect-[3/4] rounded-xl border border-line"
                style={{ backgroundColor: b.swatch }}
                aria-hidden
              />
              <p className="text-xs font-medium text-ink">{b.nombre}</p>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
