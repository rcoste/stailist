import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

// EL TALLER: las herramientas de CONSTRUIR el producto, apartadas de las de
// LEER el experimento (2026-10-09). Antes compartían la barra con el pulso y
// eran 10 de las 17 entradas del menú; con Stailist en pausa (opción A) casi
// no se tocan, pero tampoco se tiran: cada una vale cuando se retome.

export const dynamic = "force-dynamic";

const GRUPOS: { titulo: string; herramientas: { href: string; nombre: string; que: string }[] }[] = [
  {
    titulo: "Costos",
    herramientas: [
      { href: "/admin/ia", nombre: "Llamadas de IA", que: "Qué cuesta cada tarea, cuánto tarda y qué falla. El gasto por persona." },
    ],
  },
  {
    titulo: "Motor",
    herramientas: [
      { href: "/admin/comparador", nombre: "Comparador", que: "Votos a ciegas entre dos modelos o dos versiones del motor. Es la balanza." },
      { href: "/admin/evales", nombre: "Evales", que: "El nivel del motor contra los casos de referencia. Es la banda de medir." },
      { href: "/admin/destilador", nombre: "Destilador", que: "Saca reglas de vestir de las fuentes y las deja listas para las recetas." },
      { href: "/admin/recetas", nombre: "Recetas", que: "Las reglas de vestir que alimentan al motor, curadas a mano." },
      { href: "/admin/capsulas", nombre: "Cápsulas", que: "Las cápsulas ideales por perfil y lo que falta en cada clóset." },
    ],
  },
  {
    titulo: "Contenido",
    herramientas: [
      { href: "/admin/catalogo", nombre: "Catálogo", que: "Las prendas con imagen de arquetipo que la app enseña." },
      { href: "/admin/basicos", nombre: "Básicos del onboarding", que: "La lista de prendas que se palomean al empezar." },
      { href: "/admin/looks", nombre: "Looks de swipes", que: "Las cartas que se deslizan en el onboarding." },
      { href: "/admin/limpieza", nombre: "Limpieza", que: "Prendas repetidas o mal leídas, para corregirlas." },
    ],
  },
  {
    titulo: "Ya no se usa",
    herramientas: [
      { href: "/admin/acceso", nombre: "Invitaciones", que: "La lista de espera y las invitaciones de la beta cerrada. El registro está abierto desde el 2026-09-06." },
    ],
  },
];

export default async function Taller() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">Taller</h1>
        <p className="text-sm text-muted">
          Las herramientas para construir y afinar el producto. Lo que se mira a diario está en
          las otras cuatro entradas del menú.
        </p>
      </header>
      {GRUPOS.map((g) => (
        <section key={g.titulo} className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{g.titulo}</h2>
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {g.herramientas.map((h) => (
              <li key={h.href}>
                <Link href={h.href} className="flex flex-col gap-0.5 px-4 py-3 hover:bg-bg">
                  <span className="text-sm font-semibold text-ink">{h.nombre}</span>
                  <span className="text-xs text-muted">{h.que}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
