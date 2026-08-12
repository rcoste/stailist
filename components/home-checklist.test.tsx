// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HomeChecklist } from "@/components/home-checklist";
import type { HomeChecklist as HomeChecklistData } from "@/lib/home-checklist";

afterEach(cleanup);

// Lo que este test blinda son las dos decisiones de producto del checklist
// (handoff design_handoff_inicio, decisión 7), no su markup:
//  1. SOLO se listan pendientes. Un paso hecho no es información — vive detrás
//     de "ver lo hecho". Si un día se cuelan los hechos, el bloque vuelve a ser
//     el trámite de ~450px que empujaba el CTA bajo el pliegue.
//  2. Con look ya creado COLAPSA a una línea: el empujón sigue, pero deja de
//     competir con la card del look.
//
// El numerito es la posición REAL en la secuencia (un "2" sin "1" visible dice
// "el 1 ya lo hiciste"), así que también se verifica que no se renumere.

const checklist = (done: string[]): HomeChecklistData => {
  const steps = [
    { id: "estilo" as const, label: "afina tu estilo", hint: "sube un look que te encante", href: "/perfil/referencia", done: done.includes("estilo") },
    { id: "silueta" as const, label: "cuéntame de tu cuerpo", hint: "afino los looks a tu medida", href: "/perfil/silueta", done: done.includes("silueta") },
    { id: "capsula" as const, label: "arma tus esenciales", hint: "tus básicos, lo que te falta", href: "/closet/capsula/editar", done: done.includes("capsula") },
  ];
  return { steps, doneCount: done.length, total: steps.length };
};

describe("HomeChecklist", () => {
  it("los hechos van plegados; los pendientes, a la vista", () => {
    render(<HomeChecklist checklist={checklist(["estilo"])} />);
    // El paso hecho SIGUE en el DOM —el plegable se anima con max-height, que
    // exige que el contenido exista— pero tiene que estar dentro del cajón
    // cerrado, no en la lista. Se comprueba por el max-height del ancestro:
    // "está en el DOM" sería un falso verde.
    const hecho = screen.getByText("afina tu estilo");
    const cajon = hecho.closest("[style*='max-height']") as HTMLElement | null;
    expect(cajon, "el paso hecho debe vivir dentro del plegable").not.toBeNull();
    expect(cajon?.style.maxHeight).toBe("0px");
    // Los pendientes no viven en ningún cajón cerrado.
    for (const label of ["cuéntame de tu cuerpo", "arma tus esenciales"]) {
      const pendiente = screen.getByText(label);
      expect(pendiente.closest("[style*='max-height']")).toBeNull();
    }
  });

  it("'ver lo hecho' abre el cajón", () => {
    render(<HomeChecklist checklist={checklist(["estilo"])} />);
    fireEvent.click(screen.getByRole("button", { name: /ver lo hecho/i }));
    const cajon = screen
      .getByText("afina tu estilo")
      .closest("[style*='max-height']") as HTMLElement;
    expect(cajon.style.maxHeight).not.toBe("0px");
  });

  it("sin nada hecho, el control 'ver lo hecho' no existe", () => {
    // Un plegable vacío es una puerta que no lleva a ningún lado.
    render(<HomeChecklist checklist={checklist([])} />);
    expect(screen.queryByRole("button", { name: /ver lo hecho/i })).toBeNull();
    expect(screen.getByText(/qué sigue · 0 de 3 listos/)).toBeTruthy();
  });

  it("el número es la posición real, no el orden de lo que queda", () => {
    // Con el primer paso hecho, el siguiente pendiente es el 2 — nunca el 1.
    const { container } = render(<HomeChecklist checklist={checklist(["estilo"])} />);
    const numeros = Array.from(container.querySelectorAll("span"))
      .map((s) => s.textContent?.trim())
      .filter((t) => t === "1" || t === "2" || t === "3");
    expect(numeros).toContain("2");
    expect(numeros).not.toContain("1");
  });

  it("colapsado enseña UNA línea con el siguiente paso", () => {
    render(<HomeChecklist checklist={checklist(["estilo"])} colapsado />);
    expect(screen.getByText(/qué sigue · 1 de 3 listos/)).toBeTruthy();
    // El siguiente paso viaja con su gancho en la misma línea…
    expect(screen.getByText(/cuéntame de tu cuerpo — afino los looks/)).toBeTruthy();
    // …y el tercer pendiente NO se lista (eso es el punto de colapsar).
    expect(screen.queryByText("arma tus esenciales")).toBeNull();
  });

  it("sin pendientes no se dibuja nada", () => {
    // Cinturón sobre el tirante de buildHomeChecklist (que ya devuelve null):
    // si algún día llega un checklist completo, no debe quedar un cascarón.
    const { container } = render(
      <HomeChecklist checklist={checklist(["estilo", "silueta", "capsula"])} />
    );
    expect(container.textContent).toBe("");
  });
});
