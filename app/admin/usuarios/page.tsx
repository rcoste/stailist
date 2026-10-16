import { ONBOARDING_COMPLETE } from "@/lib/onboarding";
import { cargarPersonas, cargarResumenPersonas, type ResumenPersona } from "@/lib/admin/personas-datos";
import { UsuariosTable, type UserRow } from "./usuarios-table";
import { withDb } from "@/lib/db";
import {
  EVENTOS_QUE_NO_SON_VOLVER,
  SQL_ADQUISICION,
  campanaDe,
  fuenteDe,
  ventanaCerrada,
  volvioEn7Dias,
} from "@/lib/admin/adquisicion";
import { esDeCampana } from "@/lib/admin/campana";
import { origenDesdeDato } from "@/lib/origen";
import { Encabezado, Pestanas } from "../_ui";

// Actividad primero: es la vista que más se usa.
const PESTANAS_PERSONAS = [
  { href: "/admin/actividad", label: "Actividad" },
  { href: "/admin/usuarios", label: "Lista" },
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Profile = {
  id: string;
  email: string;
  is_admin: boolean;
  onboarding_step: number;
  palette_season: string | null;
  avatar_path: string | null;
  capsule_target: unknown | null;
  created_at: string;
  pais: string | null;
};

export default async function AdminUsuarios() {

  // Dos idas a la base y nada que sumar en memoria (lib/admin/personas-datos.ts).
  // Los borradores (sin correo, lib/borrador.ts) no son usuarias todavía.
  const [{ perfiles }, resumen] = [await cargarPersonas(new Date()), await cargarResumenPersonas()];
  const profiles = perfiles.filter((p) => p.email) as unknown as Profile[];
  const vacio = (): ResumenPersona => ({ closet: 0, closetPhotos: 0, looks: 0, viaje: 0, cartera: 0, worn: 0, votes: 0, ultimoUso: null });

  // DE DÓNDE LLEGÓ Y SI VOLVIÓ, con las mismas definiciones que Campañas y
  // Retención (SQL_ADQUISICION): la lista ya no dice una cosa y el resto otra.
  const ahora = new Date();
  const adquisicion = new Map(
    (await withDb(async (c) => (await c.query(SQL_ADQUISICION, [EVENTOS_QUE_NO_SON_VOLVER])).rows)).map((r) => {
      const o = origenDesdeDato(r.origen);
      const campana = campanaDe(o);
      return [
        r.id as string,
        {
          origen: campana !== "—" ? campana : fuenteDe(o),
          deAnuncio: esDeCampana(o),
          volvio: volvioEn7Dias(r.dia_inicio, r.dias)
            ? ("si" as const)
            : ventanaCerrada(r.dia_inicio, ahora)
              ? ("no" as const)
              : ("semana" as const),
        },
      ];
    })
  );

  // Quién instaló la app en su pantalla de inicio (lib/pwa-actions.ts): la
  // abrió desde el ícono o el navegador avisó la instalación.
  const instalaron = new Set(
    await withDb(async (c) => (await c.query(`select distinct user_id from public.events where type = 'pwa_installed'`)).rows.map((r) => r.user_id as string))
  );

  const rows: UserRow[] = profiles.map((p) => {
    const a = resumen.get(p.id) ?? vacio();
    const q = adquisicion.get(p.id);
    return {
      id: p.id,
      email: p.email,
      pais: p.pais,
      origen: q?.origen ?? "—",
      deAnuncio: q?.deAnuncio ?? false,
      volvio: q?.volvio ?? null,
      isAdmin: p.is_admin,
      onboardingStep: p.onboarding_step ?? 0,
      onboardingDone: (p.onboarding_step ?? 0) >= ONBOARDING_COMPLETE,
      color: !!p.palette_season,
      avatar: !!p.avatar_path,
      capsula: !!p.capsule_target,
      closet: a.closet,
      closetPhotos: a.closetPhotos,
      looks: a.looks,
      viaje: a.viaje,
      cartera: a.cartera,
      worn: a.worn,
      votes: a.votes,
      lastActive: a.ultimoUso ? new Date(a.ultimoUso).getTime() : null,
      app: instalaron.has(p.id),
    };
  });

  const now = ahora.getTime();
  const activos = rows.filter((r) => r.lastActive !== null && now - r.lastActive <= WEEK_MS).length;
  const conApp = rows.filter((r) => r.app).length;

  return (
    <>
      <Pestanas pestanas={PESTANAS_PERSONAS} activa="/admin/usuarios" />
      <Encabezado
        titulo="Personas"
        sub={`${rows.length} ${rows.length === 1 ? "perfil" : "perfiles"} · ${activos} ${activos === 1 ? "activo" : "activos"} esta semana · ${conApp} ${conApp === 1 ? "instaló" : "instalaron"} la app`}
      />
      <UsuariosTable rows={rows} now={now} />
    </>
  );
}
