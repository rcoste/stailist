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
