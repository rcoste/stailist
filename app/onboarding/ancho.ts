// EL ONBOARDING EN ESCRITORIO (2026-10-01).
//
// Hasta hoy todo el onboarding era la columna de 430px del teléfono, también en
// un monitor: funcionaba, pero las pantallas que enseñan FOTOS (swipes, pares de
// corte, acentos, checklist, los tres primeros looks) desperdiciaban el ancho
// justo donde más falta hace ver. Desde que hay anuncios de búsqueda prendidos,
// una parte del tráfico llega por computadora.
//
// La regla: de `lg` (1024px) para arriba el cascarón (layout.tsx) se abre a
// max-w-5xl y CADA pantalla decide su ancho. Las de pregunta se quedan en esta
// columna; las de fotos usan el ancho. Debajo de `lg` no cambia nada.
//
// Vive en una constante para que las pantallas de pregunta midan lo mismo: una
// columna que cambia de ancho entre un paso y el siguiente se lee como error.
export const COLUMNA = "lg:mx-auto lg:w-full lg:max-w-md";
