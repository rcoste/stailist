import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Encabezado, Fila, Panel } from "../_ui";

// EL TALLER: las herramientas de CONSTRUIR el producto, apartadas de las de
// LEER el experimento (2026-10-09). Antes compartían la barra con el pulso y
// eran 10 de las 17 entradas del menú; con Stailist en pausa (opción A) casi
// no se tocan, pero tampoco se tiran: cada una vale cuando se retome. Sus
// pantallas conservan el diseño viejo a propósito: son instrumentos de uso
// ocasional y rehacerlos no cambia ninguna lectura.

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
      { href: "/admin/mazo", nombre: "El mazo de swipes", que: "¿Las cartas espantan a alguien? Cuántas terminan, cuántas usan el escape y qué carta gusta." },
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
    <>
      <Encabezado titulo="Taller" sub="Las herramientas para construir y afinar el producto. Lo de leer el experimento está en el menú." />
      <Fila cols={2}>
        {GRUPOS.map((g) => (
          <Panel key={g.titulo} titulo={g.titulo} sinPadding>
            <ul className="flex flex-col">
              {g.herramientas.map((h) => (
                <li key={h.href} className="border-t border-line2 first:border-t-0">
                  <Link href={h.href} className="flex flex-col gap-0.5 px-5 py-3 transition-colors duration-200 hover:bg-tile">
                    <span className="text-sm font-semibold text-ink">{h.nombre}</span>
                    <span className="text-[13px] text-muted">{h.que}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </Fila>
    </>
  );
}
