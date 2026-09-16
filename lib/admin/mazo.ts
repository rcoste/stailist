// EL MAZO DE SWIPES VISTO DESDE LOS VOTOS — para /admin/adquisicion.
//
// Nació de una pregunta del assessment de Aesty (2026-09-16): ¿las cartas
// atrevidas del arranque espantan a los hombres que trae la campaña? La primera
// medición dijo que no — 7 de 7 terminaron, 1 de 9 usó el escape, 54% de likes —
// pero con 9 hombres, todos conocidos de antes de los anuncios. Esta sección
// existe para repetirla sin pedirla cuando la campaña traiga ~20 hombres nuevos.
//
// QUÉ SE DECIDE CON ELLA: si aparece abandono o escape temprano en hombres,
// cambiar SÓLO la primera vuelta del mazo (una carta clásica en lugar de
// Streetwear o Hipster) sin romper la alternancia de familias (lib/looks.ts).
// Sin abandono, el orden se queda: las atrevidas se rechazan, y eso mide.

import { looksForGender } from "@/lib/looks";

/** Por cuenta real: su género, si llegó y terminó el swipe, y sus votos. */
export const SQL_MAZO = `
with cuentas as (
  select p.id, p.gender, p.onboarding_step, p.age_range
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.gender is not null
    and coalesce(p.is_admin, false) = false
    and coalesce(u.email, '') not ilike '%@stailist.app'
),
swipes as (
  select distinct on (e.user_id) e.user_id, e.data
  from public.events e
  where e.type = 'onboarding_step' and (e.data->>'step') = '1' and e.data ? 'swipes'
  order by e.user_id, e.created_at
)
select c.gender,
  c.age_range is not null as llego,
  c.onboarding_step >= 1 as termino,
  s.data->>'escape' as escape,
  s.data->'swipes' as votos
from cuentas c
left join swipes s on s.user_id = c.id
`;

export type FilaMazo = {
  gender: string;
  /** Desde que se pide la edad (antes del swipe) se sabe quién llegó. */
  llego: boolean;
  termino: boolean;
  escape: string | null;
  votos: { id: string; liked: boolean }[] | null;
};

export type ResumenGenero = {
  genero: "hombre" | "mujer";
  llegaron: number;
  terminaron: number;
  conVotos: number;
  escape: number;
  pctLikes: number | null;
  /** Cartas del mazo ACTUAL, en su orden, con sus votos. */
  cartas: { posicion: number; id: string; nombre: string; votos: number; likes: number }[];
};

export function resumirMazo(filas: FilaMazo[]): ResumenGenero[] {
  return (["hombre", "mujer"] as const).map((genero) => {
    const suyas = filas.filter((f) => f.gender === genero);
    const conVotos = suyas.filter((f) => Array.isArray(f.votos) && f.votos.length > 0);
    const todos = conVotos.flatMap((f) => f.votos ?? []);
    const likes = todos.filter((v) => v.liked).length;
    const cartas = looksForGender(genero).map((l, i) => {
      const deEsta = todos.filter((v) => v.id === l.id);
      return {
        posicion: i + 1,
        id: l.id,
        nombre: l.nombre,
        votos: deEsta.length,
        likes: deEsta.filter((v) => v.liked).length,
      };
    });
    return {
      genero,
      // Llegar = tener edad (se pide justo antes del swipe). Las cuentas de
      // antes de la pantalla de edad no cuentan aquí para no inventar abandono.
      llegaron: suyas.filter((f) => f.llego).length,
      terminaron: suyas.filter((f) => f.llego && f.termino).length,
      conVotos: conVotos.length,
      escape: conVotos.filter((f) => f.escape === "true").length,
      pctLikes: todos.length ? Math.round((likes / todos.length) * 100) : null,
      cartas,
    };
  });
}
