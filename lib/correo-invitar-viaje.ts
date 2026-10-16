// A QUIÉN LE TOCA EL CORREO "¿CON QUIÉN VAS?" (2026-10-16). Las reglas de
// conjunto (opt-in de correos, sin borrado programado, cuentas de prueba)
// van en el SQL del cron; aquí van las de TIEMPO y de sentido, que son las que
// se discuten, probadas una por una.

/** Se espera un día después de armar el viaje: antes, la persona todavía lo está viendo. */
export const HORAS_ESPERA = 24;

export type ViajeParaCorreo = {
  creadoEn: string;
  /** "YYYY-MM-DD" */
  fechaInicio: string;
  /** Ya tocó "invitar" (tiene link): ya sabe que existe, no hace falta decírselo. */
  yaTieneLink: boolean;
  /** Llegó por la invitación de otra persona: quien organiza ya es la otra. */
  vinoInvitado: boolean;
};

export type VeredictoCorreo = { toca: true } | { toca: false; motivo: string };

export function leTocaCorreoInvitar(v: ViajeParaCorreo, ahora: Date, hoyCdmx: string): VeredictoCorreo {
  if (v.vinoInvitado) return { toca: false, motivo: "vino invitado" };
  if (v.yaTieneLink) return { toca: false, motivo: "ya invitó" };
  // El día que sale el viaje ya no sirve: la gente se coordina antes.
  if (v.fechaInicio <= hoyCdmx) return { toca: false, motivo: "el viaje ya empezó" };
  const horas = (ahora.getTime() - Date.parse(v.creadoEn)) / 3_600_000;
  if (horas < HORAS_ESPERA) return { toca: false, motivo: "todavía no pasa un día" };
  return { toca: true };
}
