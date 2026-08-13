// @vitest-environment jsdom
//
// LA PREGUNTA DEL FIT CHECK: "¿a dónde vas?".
//
// Lo que se blinda NO es el markup —eso cambia con cada rebrand— sino la
// DECISIÓN que viaja: qué `registro` sale hacia /api/espejo según lo que ella
// tocó, y cuál llega marcado antes de que toque nada. La marca es la parte
// delicada: encender la chip equivocada da un consejo con toda la seguridad y
// todo mal, que es peor que no tener contexto.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EspejoFlow, type EspejoHandle } from "./espejo-flow";
import { createRef } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Las server actions del clóset arrastran `server-only`, que vite no resuelve
// en un test de jsdom. Se simulan enteras: son el segundo tiempo del flujo
// (sumar prendas), no la pregunta que este archivo mira.
vi.mock("@/app/closet/actions", () => ({
  addPhotoItems: vi.fn(async () => ({ ok: true, ids: [] })),
  ligarPrendasAlEspejo: vi.fn(async () => ({ ok: true })),
  ponerRenderAPrenda: vi.fn(async () => ({ ok: true })),
  removeItem: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: { from: () => ({ upload: async () => ({ error: null }) }) },
  }),
}));

// La compresión de imagen usa canvas, que jsdom no implementa. Se devuelve el
// dataURL tal cual: lo que este test mira es a dónde va el registro, no cómo
// se comprime un JPEG.
vi.mock("@/lib/image-file", () => ({
  toUsableImage: async (f: File) => f,
}));

/** Los cuerpos de cada POST, por ruta. Es lo único que este test observa. */
const enviado: Record<string, Record<string, unknown>[]> = {};

beforeEach(() => {
  for (const k of Object.keys(enviado)) delete enviado[k];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { body?: string }) => {
      const ruta = String(url);
      const body = init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      (enviado[ruta] ??= []).push(body);
      if (ruta.includes("contar-personas")) {
        return { ok: true, json: async () => ({ personas: 1 }) };
      }
      if (ruta.includes("/api/espejo/prendas")) {
        return { ok: true, json: async () => ({ prendas: [], vistas: 0, yaEstan: [] }) };
      }
      return {
        ok: true,
        json: async () => ({
          titulo: "Un look",
          resumen: "algo",
          colorimetria: "algo",
          clima: null,
          ajuste: "algo",
          outfitId: "o1",
        }),
      };
    })
  );
  // LA COMPRESIÓN PIDE UN NAVEGADOR DE VERDAD: `new Image()` que decodifica y
  // un canvas que dibuja. jsdom no trae ninguno de los dos, así que se ponen
  // los mínimos para que `comprimir` complete — sin esto el flujo cae al
  // estado de error y la pregunta nunca se pinta.
  vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
  Object.defineProperty(window.Image.prototype, "src", {
    configurable: true,
    set() {
      // La carga es asíncrona en un navegador; imitarlo evita que el onload se
      // dispare antes de que el llamador lo asigne.
      setTimeout(() => this.onload?.(new Event("load")), 0);
    },
  });
  HTMLCanvasElement.prototype.getContext = (() => ({ drawImage() {} })) as never;
  HTMLCanvasElement.prototype.toDataURL = () => "data:image/jpeg;base64,AAAA";
  HTMLCanvasElement.prototype.toBlob = function (cb: (b: Blob | null) => void) {
    cb(new Blob(["x"], { type: "image/jpeg" }));
  } as never;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Dispara el flujo con una foto de mentira y espera a la pregunta. */
async function abrirConFoto(props: Record<string, unknown> = {}) {
  const ref = createRef<EspejoHandle>();
  const { container } = render(<EspejoFlow userId="u1" headless ref={ref} {...props} />);
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(["x"], "f.jpg", { type: "image/jpeg" });
  await userEvent.upload(input, file);
  return screen.findByRole("button", { name: /^trabajo/ });
}

describe("¿a dónde vas? — la decisión que viaja", () => {
  it("tocar una chip manda ESE registro a /api/espejo", async () => {
    await abrirConFoto();
    await userEvent.click(screen.getByRole("button", { name: /^trabajo/ }));
    await waitFor(() => expect(enviado["/api/espejo"]?.length).toBe(1));
    expect(enviado["/api/espejo"][0].registro).toBe("trabajo");
  });

  it("una chip distinta manda un registro distinto", async () => {
    // Parece obvio y no lo es: si el handler ignorara su argumento y usara el
    // sugerido, este test sería el único que lo notaría.
    await abrirConFoto();
    await userEvent.click(screen.getByRole("button", { name: /^gym o un mandado/ }));
    await waitFor(() => expect(enviado["/api/espejo"]?.length).toBe(1));
    expect(enviado["/api/espejo"][0].registro).toBe("rapido");
  });

  it("NO llama al espejo antes de que ella conteste", async () => {
    // El corazón del diseño: la pregunta vive en el hueco de espera, y por eso
    // el consejo no puede salir disparado antes. Si esto se rompe, el registro
    // llegaría siempre nulo y las chips serían decorativas.
    await abrirConFoto();
    expect(enviado["/api/espejo"]).toBeUndefined();
  });

  it("mientras ella lee las opciones, la cuenta de personas YA está corriendo", async () => {
    // Es lo que hace que preguntar casi no cueste espera: los ~6 s de la
    // llamada de consejo y la cuenta de personas se solapan con su tap.
    await abrirConFoto();
    expect(enviado["/api/contar-personas"]?.length).toBe(1);
  });
});

describe("la chip marcada — la apuesta de la app", () => {
  /**
   * Cuál de las cuatro viene marcada.
   *
   * POR `data-sugerida` Y NO POR LA CLASE CSS: la primera versión miraba si el
   * className incluía "border-ink" y daba verde siempre — las chips NO marcadas
   * llevan `hover:border-ink`, que contiene esa cadena. Un test que no puede
   * fallar es peor que ninguno, y este pasó dos veces antes de que lo cazara.
   */
  function marcada(): string | null {
    const b = document.querySelector("[data-sugerida]");
    return b ? (b.textContent ?? "").replace(" — mi apuesta", "").trim() : null;
  }

  it("sin nada que saber, marca 'un día normal' — el default que no afirma nada", async () => {
    await abrirConFoto();
    expect(marcada()).toBe("un día normal");
  });

  it("con un look de HOY para un evento, marca 'algo especial'", async () => {
    await abrirConFoto({
      ultimaOcasion: "boda",
      ultimoLookCreadoEn: new Date().toISOString(),
    });
    expect(marcada()).toBe("algo especial");
  });

  it("EL LOOK DE AYER NO CUENTA", async () => {
    // Haber pedido un look para una boda ayer no dice nada de hoy, y encender
    // "algo especial" por eso sube la vara sin razón — el error caro.
    const ayer = new Date(Date.now() - 26 * 3600_000).toISOString();
    await abrirConFoto({ ultimaOcasion: "boda", ultimoLookCreadoEn: ayer });
    expect(marcada()).toBe("un día normal");
  });

  it("la marcada NO se auto-confirma: sin tap, no hay llamada", async () => {
    // La diferencia entre sugerir y decidir por ella. Un default que se
    // dispara solo ES inferir en silencio.
    await abrirConFoto({
      ultimaOcasion: "oficina",
      ultimoLookCreadoEn: new Date().toISOString(),
    });
    expect(marcada()).toBe("trabajo");
    expect(enviado["/api/espejo"]).toBeUndefined();
  });
});
