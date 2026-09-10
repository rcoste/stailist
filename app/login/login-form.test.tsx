// @vitest-environment jsdom
//
// EL CORREO DE LA LANDING LLEGA AL LOGIN SIN PASAR POR LA URL.
//
// Antes viajaba como /login?email=…, y con las etiquetas de publicidad cargadas
// en la landing esa URL la veían Google y TikTok. Ahora viaja por
// sessionStorage (lib/email-landing.ts). Lo que se blinda: que el login lo
// LEA (si no, quien tecleó su correo en la landing lo tiene que teclear otra
// vez), que lo BORRE (no puede quedarse rondando la pestaña), que no pise un
// correo que ya venía resuelto del servidor (la invitación), y que SOBREVIVA a
// un error: React 19 resetea el formulario al terminar la acción, y la primera
// versión escribía el valor directo en el input y lo perdía.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EMAIL_LANDING_KEY } from "@/lib/email-landing";
import { LoginForm } from "./login-form";

// Las server actions arrastran Supabase: se simulan, este test no manda nada.
const acciones = vi.hoisted(() => ({
  sendCode: vi.fn(
    async (_prev: unknown, _fd: FormData): Promise<{ status: string; message?: string }> => ({ status: "idle" })
  ),
}));
vi.mock("./actions", () => ({
  sendCode: acciones.sendCode,
  verifyCode: vi.fn(async () => ({ status: "idle", email: "" })),
}));

beforeEach(() => {
  sessionStorage.clear();
  acciones.sendCode.mockClear();
});
afterEach(cleanup);

const campoCorreo = () => screen.getByLabelText("Tu correo") as HTMLInputElement;

describe("LoginForm — el correo que viene de la landing", () => {
  it("se precarga y se borra de sessionStorage", async () => {
    sessionStorage.setItem(EMAIL_LANDING_KEY, "ana@x.com");
    render(<LoginForm />);

    await waitFor(() => expect(campoCorreo().value).toBe("ana@x.com"));
    expect(sessionStorage.getItem(EMAIL_LANDING_KEY)).toBeNull();
  });

  it("el correo de una invitación gana, y el de la landing se borra igual", async () => {
    sessionStorage.setItem(EMAIL_LANDING_KEY, "ana@x.com");
    render(<LoginForm prefillEmail="luz@y.com" />);

    await waitFor(() => expect(sessionStorage.getItem(EMAIL_LANDING_KEY)).toBeNull());
    expect(campoCorreo().value).toBe("luz@y.com");
  });

  it("tras un error del servidor (ritmo, correo raro) el correo sigue en el campo", async () => {
    acciones.sendCode.mockResolvedValueOnce({ status: "error", message: "espera un momento" });
    sessionStorage.setItem(EMAIL_LANDING_KEY, "ana@x.com");
    render(<LoginForm />);
    await waitFor(() => expect(campoCorreo().value).toBe("ana@x.com"));

    fireEvent.submit(campoCorreo().form!);

    await screen.findByText("espera un momento");
    expect(acciones.sendCode).toHaveBeenCalledTimes(1);
    expect(campoCorreo().value).toBe("ana@x.com");
  });
});
