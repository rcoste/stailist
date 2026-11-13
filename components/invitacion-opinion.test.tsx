// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const marcarInvitacion = vi.fn(async (_accion: string) => {});
vi.mock("@/lib/invitacion-opinion", () => ({ marcarInvitacion: (a: string) => marcarInvitacion(a) }));
vi.mock("@/lib/reportes", () => ({ enviarReporte: vi.fn(async () => ({ ok: true })) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/hoy" }));

import { InvitacionOpinion } from "@/components/invitacion-opinion";

afterEach(() => {
  cleanup();
  marcarInvitacion.mockClear();
});

// Lo que blinda: qué queda registrado de la invitación. "Ahora no" es para
// siempre (no se le insiste a quien más usa la app) y verla cuenta una vez.
describe("InvitacionOpinion", () => {
  it("al aparecer la marca como vista", () => {
    render(<InvitacionOpinion />);
    expect(marcarInvitacion).toHaveBeenCalledWith("vista");
  });

  it('"ahora no" la descarta y desaparece', () => {
    render(<InvitacionOpinion />);
    fireEvent.click(screen.getByRole("button", { name: /ahora no/i }));
    expect(marcarInvitacion).toHaveBeenCalledWith("descartada");
    expect(screen.queryByText(/más usa stailist/i)).toBeNull();
  });

  it('"te cuento" abre el buzón en modo opinión, sin marcarla respondida todavía', () => {
    render(<InvitacionOpinion />);
    fireEvent.click(screen.getByRole("button", { name: /te cuento/i }));
    expect(screen.getByPlaceholderText(/lo que más usas/i)).toBeTruthy();
    expect(marcarInvitacion).not.toHaveBeenCalledWith("respondida");
  });
});
