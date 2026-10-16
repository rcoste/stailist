import { describe, expect, it } from "vitest";
import { leTocaCorreoInvitar, type ViajeParaCorreo } from "./correo-invitar-viaje";

// LO QUE BLINDAN: que el correo salga una vez, en el momento útil (después de
// armar el viaje, antes de salir) y nunca a quien ya invitó o vino invitado.

const AHORA = new Date("2026-10-16T16:00:00Z");
const HOY = "2026-10-16";
const v = (x: Partial<ViajeParaCorreo>): ViajeParaCorreo => ({
  creadoEn: "2026-10-15T10:00:00Z",
  fechaInicio: "2026-10-25",
  yaTieneLink: false,
  vinoInvitado: false,
  ...x,
});

describe("leTocaCorreoInvitar", () => {
  it("un viaje de ayer que todavía no empieza: sí", () => {
    expect(leTocaCorreoInvitar(v({}), AHORA, HOY)).toEqual({ toca: true });
  });
  it("armado hace menos de un día: todavía no", () => {
    expect(leTocaCorreoInvitar(v({ creadoEn: "2026-10-16T08:00:00Z" }), AHORA, HOY).toca).toBe(false);
  });
  it("si el viaje empieza hoy o ya empezó: no", () => {
    expect(leTocaCorreoInvitar(v({ fechaInicio: HOY }), AHORA, HOY).toca).toBe(false);
    expect(leTocaCorreoInvitar(v({ fechaInicio: "2026-10-10" }), AHORA, HOY).toca).toBe(false);
  });
  it("quien ya invitó o vino invitado no lo recibe", () => {
    expect(leTocaCorreoInvitar(v({ yaTieneLink: true }), AHORA, HOY)).toEqual({ toca: false, motivo: "ya invitó" });
    expect(leTocaCorreoInvitar(v({ vinoInvitado: true }), AHORA, HOY)).toEqual({ toca: false, motivo: "vino invitado" });
  });
});

describe("invitarViajeEmail", () => {
  it("el destino lo escribe la persona: va escapado en el HTML", async () => {
    const { invitarViajeEmail } = await import("./email-template");
    const m = invitarViajeEmail({ unsubToken: "t", destino: "Tokio <img src=x>", tripId: "abc", fechas: "16 oct – 20 oct" });
    expect(m.html).not.toContain("<img src=x>");
    expect(m.html).toContain("Tokio &lt;img src=x&gt;");
    expect(m.text).toContain("/viaje/abc");
  });
});
