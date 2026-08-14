// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { UltimoLookCard } from "@/components/ultimo-look-card";
import type { UltimoLook } from "@/lib/ultimo-look";

// next/image exige configuración del loader que en jsdom no existe; aquí solo
// importa QUÉ imagen se pinta, no cómo la optimiza Next.
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { fill: _fill, sizes: _sizes, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

afterEach(cleanup);

// Lo que este test blinda no es el markup: son las DOS decisiones de producto
// de la card (handoff design_handoff_inicio):
// 1. La variante la decide el DATO — con retrato va el avatar; sin él, la tira.
// 2. Tocar la card VE el look (onVer), nunca dispara una generación pagada.

const base: UltimoLook = {
  id: "look-1",
  nombre: "Sastre Suelto de Noche",
  ocasion: "evento",
  fecha: null,
  creadoEn: new Date().toISOString(),
  retrato: null,
  prendas: [],
};

describe("UltimoLookCard", () => {
  // Las imágenes van con alt="" (decorativas: el texto de la card ya nombra el
  // look), así que no tienen rol accesible — se consultan por tag.
  it("con retrato pinta el avatar y NO la tira de prendas", () => {
    const { container } = render(
      <UltimoLookCard
        look={{ ...base, retrato: "https://x/retrato.jpg", prendas: ["https://x/p1.png"] }}
        onVer={() => {}}
      />
    );
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute("src")).toBe("https://x/retrato.jpg");
  });

  it("sin retrato pinta la tira con las prendas en su orden", () => {
    const { container } = render(
      <UltimoLookCard
        look={{ ...base, prendas: ["https://x/p1.png", "https://x/p2.png"] }}
        onVer={() => {}}
      />
    );
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.map((i) => i.getAttribute("src"))).toEqual([
      "https://x/p1.png",
      "https://x/p2.png",
    ]);
  });

  it("tocarla llama onVer — ver no puede costar dinero", () => {
    const onVer = vi.fn();
    render(<UltimoLookCard look={base} onVer={onVer} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onVer).toHaveBeenCalledTimes(1);
  });

  it("dice cuándo se creó y ofrece verlo", () => {
    render(<UltimoLookCard look={base} onVer={() => {}} />);
    expect(screen.getByText(/creado hoy/i)).toBeTruthy();
    expect(screen.getByText(/ver el look/i)).toBeTruthy();
  });
});

// Abrir el look es un fetch de segundos. Mientras iba en vuelo la card quedaba
// idéntica y muda, así que la lectura correcta era "no reaccionó" y la reacción
// natural, picarle otra vez (Roberto, 2026-08-13: "le pico y no reacciona, le
// quiero picar varias veces"). El acuse es DOBLE y los dos importan: el CTA dice
// que está abriendo, y el botón se bloquea para que el segundo tap no exista.
// Probar sólo el texto dejaría pasar que alguien quite el `disabled`, que es la
// mitad que cuesta dinero — cada tap extra es otro request.
describe("UltimoLookCard — abriendo (candado anti-doble-tap)", () => {
  const boton = () => screen.getByRole("button") as HTMLButtonElement;

  it("en reposo el botón responde y el CTA invita", () => {
    const onVer = vi.fn();
    render(<UltimoLookCard look={base} onVer={onVer} />);
    expect(boton().disabled).toBe(false);
    expect(boton().textContent).toContain("ver el look");
  });

  it("cargando: el CTA dice «abriendo…», el botón se bloquea y el tap no pasa", () => {
    const onVer = vi.fn();
    render(<UltimoLookCard look={base} onVer={onVer} cargando />);

    expect(boton().textContent).toContain("abriendo…");
    expect(boton().getAttribute("aria-busy")).toBe("true");
    expect(boton().disabled).toBe(true);

    fireEvent.click(boton());
    expect(onVer).not.toHaveBeenCalled(); // el segundo request no ocurre
  });

  it("el candado también aplica a la variante con retrato (try-on)", () => {
    const onVer = vi.fn();
    render(
      <UltimoLookCard
        look={{ ...base, retrato: "https://x/retrato.jpg" }}
        onVer={onVer}
        cargando
      />
    );

    expect(boton().disabled).toBe(true);
    fireEvent.click(boton());
    expect(onVer).not.toHaveBeenCalled();
  });
});
