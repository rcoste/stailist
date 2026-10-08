import { describe, expect, it } from "vitest";
import { correoReporteHtml } from "./reportes-correo";

describe("correoReporteHtml", () => {
  it("escapa lo que escribió la persona y enlaza a su ficha", () => {
    const html = correoReporteHtml({
      tipo: "problema",
      texto: "no carga <script>x</script>",
      de: "a@ejemplo.test",
      userId: "u-1",
      pantalla: "/closet",
      version: "0.2.356.0",
      fallosIa: ["render-prenda"],
    });
    expect(html).toContain("no carga &lt;script&gt;x&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("/admin/usuarios/u-1");
    expect(html).toContain("Tuvo fallos de IA");
  });
});
