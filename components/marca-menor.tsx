"use client";

import { useEffect } from "react";
import { COOKIE_MENOR } from "@/lib/publicidad";

// LA MARCA DE MENOR EN ESTE NAVEGADOR, puesta desde lo que sabe el servidor.
//
// /onboarding/edad deja la cookie al guardar la edad, pero sólo en el navegador
// donde se guardó. Una cuenta de 13-17 que sigue su onboarding en otro
// dispositivo, en la app instalada (otra caja de cookies) o tras borrar cookies
// llegaba a las pantallas medidas SIN la marca, y ahí se cargaban las
// etiquetas de publicidad (lo cazó la revisión de seguridad del 2026-09-10).
// app/onboarding/layout.tsx la monta cuando el perfil es de menor, y también
// para un admin en "ver como": su navegador no puede medirse por otra cuenta
// (y que el navegador del admin deje de medirse en la landing es un efecto
// deseable, no un costo: sus visitas ensuciaban la campaña).
//
// Orden: este efecto corre antes que el de components/tags-publicidad.tsx (va
// dentro de {children}, que en el layout raíz está antes), así que la marca
// existe cuando se decide si cargar. Si ya estaban cargadas, la recarga de ese
// componente las suelta.
export function MarcaMenor() {
  useEffect(() => {
    document.cookie = `${COOKIE_MENOR}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, []);
  return null;
}
