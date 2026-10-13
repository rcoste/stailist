import { requireAdmin } from "@/lib/auth";
import { DIAS_VENTANA } from "@/lib/admin/adquisicion";
import { MXN_POR_USD, PARO_MINIMO_VOLVIERON, PARO_MUESTRA } from "@/lib/admin/campana";
import { OBJETIVOS } from "@/lib/admin/objetivos";
import { Encabezado, Panel } from "../_ui";

// CÓMO SE CUENTA: todas las definiciones del admin en un solo lugar. Antes
// cada pantalla cargaba su párrafo gris arriba y otro abajo explicando qué es
// "volvió" o de dónde sale el costo; aquí viven una vez y las pantallas quedan
// para los datos. Los números (30, 6, 7 días, 18 MXN) se importan de donde se
// usan para que esta página no mienta cuando cambien.

const DEFINICIONES: { termino: string; que: string }[] = [
  {
    termino: "Empezó el onboarding",
    que: "Abrió la primera pantalla del onboarding. Un borrador que tocó el botón de la landing y nunca abrió el onboarding no cuenta como persona.",
  },
  {
    termino: "Primer look",
    que: "Llegó a ver su primer look generado. Es el paso que decide si alguien 'entró' de verdad; la promesa del producto es que ocurra en menos de 2 minutos.",
  },
  {
    termino: "Volvió",
    que: `Entró a la app otro día (en días de la Ciudad de México), al menos 4 horas después de empezar, y dentro de sus primeros ${DIAS_VENTANA} días. Entrar es cualquier acción: abrirla, subir una prenda, generar un look. Quien vuelve dos veces sigue siendo una persona que volvió.`,
  },
  {
    termino: "Criterio de paro",
    que: `Acordado el 2026-09-10: de las primeras ${PARO_MUESTRA} personas de anuncios con primer look, si menos de ${PARO_MINIMO_VOLVIERON} vuelven en su primera semana, se para y no se escala. "No pasa" se declara cuando ya cerraron tantas semanas sin regreso que es imposible llegar a ${PARO_MINIMO_VOLVIERON}.`,
  },
  {
    termino: "Semana cerrada",
    que: `La persona ya vivió sus ${DIAS_VENTANA} días completos. Los porcentajes de retención sólo cuentan a quien ya vivió el día del que hablan: quien empezó ayer no puede haber vuelto el día 7.`,
  },
  {
    termino: "Costo por primer look",
    que: `Gasto en anuncios más el costo de IA de esas personas en su primera semana, dividido entre sus primeros looks. Los dólares de IA se convierten a ${MXN_POR_USD} MXN por dólar (supuesto; se cambia con MXN_POR_USD).`,
  },
  {
    termino: "Sin anuncio",
    que: "Quien llegó por su cuenta o recomendada (sin utm de campaña). Es el fondo contra el que se lee lo demás, no una campaña.",
  },
  {
    termino: "Campaña pausada",
    que: "Sin gasto registrado en los últimos 3 días. Se lista aparte para que no pese igual que las que están corriendo.",
  },
  {
    termino: "Llegó por",
    que: "El utm del anuncio o, a falta de utm, el referer. 'Dijo' es la respuesta a '¿cómo nos conociste?' en el onboarding: ve lo que el link no, como la amiga que pasó el nombre.",
  },
  {
    termino: "Se quedó en una pantalla",
    que: "Terminó el paso anterior, no éste, y lleva más de media hora sin moverse. Quien llegó a un paso cuenta como que pasó por los anteriores aunque falte el registro (el onboarding cambió con el tiempo).",
  },
  {
    termino: "Prueba del onboarding (3 fotos)",
    que: "Desde el 2026-10-12, a la mitad de la gente nueva se le piden 3 fotos de outfits en vez de la lista de básicos. De qué lado cae cada quien lo decide su id, una sola vez.",
  },
  {
    termino: "Objetivos del plan P-03",
    que: `Lo que el plan escribió antes de gastar: anuncios del ${OBJETIVOS.anunciosDesde} al ${OBJETIVOS.anunciosHasta}, tope de ${OBJETIVOS.topeMxn.toLocaleString("es-MX")} MXN. Salvo el criterio de paro, los umbrales son estimados de confianza baja.`,
  },
  {
    termino: "Cuentas que no cuentan",
    que: "Ningún número del admin incluye a las cuentas de admin ni a las de prueba (@stailist.app). Los recorridos de prueba de campañas (utm 'prueba-…') tampoco.",
  },
  {
    termino: "El correo de las 8",
    que: "Lo mismo que Hoy, por correo, cada mañana a las 8 (hora de la Ciudad de México). Sale de las mismas funciones, así que nunca dice un número distinto.",
  },
];

export const dynamic = "force-dynamic";

export default async function ComoSeCuenta() {
  await requireAdmin();
  return (
    <>
      <Encabezado titulo="Cómo se cuenta" sub="Las definiciones detrás de cada número del admin, una sola vez." />
      <Panel sinPadding>
        <dl className="flex flex-col">
          {DEFINICIONES.map((d) => (
            <div key={d.termino} className="grid gap-1 border-t border-line2 px-5 py-3.5 first:border-t-0 sm:grid-cols-[220px_1fr] sm:gap-6">
              <dt className="text-sm font-semibold text-ink">{d.termino}</dt>
              <dd className="text-sm text-ink2">{d.que}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </>
  );
}
