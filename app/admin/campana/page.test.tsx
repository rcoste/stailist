// LA PANTALLA DE LA CAMPAÑA RENDERIZA LO QUE DECIDE.
//
// Lo que se blinda no es el markup (cambia con cada rebrand) sino las tres
// cosas que Roberto tiene que ver sin buscarlas: el veredicto del criterio de
// paro, una campaña que gastó y no trajo a nadie, y el supuesto del tipo de
// cambio que entra en el costo. Render de servidor, sin DOM: la página es un
// componente async que se llama como función.

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DatosCampana } from "@/lib/admin/campana-datos";

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn(async () => ({})) }));
vi.mock("./actions", () => ({ guardarGasto: vi.fn(), borrarGasto: vi.fn() }));

const datos = vi.hoisted(() => ({ actual: null as unknown as DatosCampana }));
vi.mock("@/lib/admin/campana-datos", () => ({
  desdePorDefecto: vi.fn(async () => "2026-09-25"),
  cargarCampana: vi.fn(async () => datos.actual),
}));

import AdminCampana from "./page";

const fila = {
  fuente: "google",
  campana: "hombres-eventos",
  impresiones: null,
  clics: 80,
  costoMxn: 600,
  registrosGoogle: 0,
  pidieronCodigo: 0, landing: 0, boton: 0, correoVisto: 0, correoOk: 0,
  entraron: 0,
  registro: 0,
  pasos: [0, 0, 0, 0, 0],
  primerLook: 0,
  ttvMedianaS: null,
  ventanaCerrada: 0,
  volvieron: 0,
  seLoPusieron: 0,
  iaUsd: 0,
};

async function html(d: Partial<DatosCampana>): Promise<string> {
  datos.actual = {
    desde: "2026-09-25",
    filas: [],
    resumen: [],
    paro: { estado: "faltan-datos", conPrimerLook: 0, cerradas: 0, volvieron: 0 },
    gasto: [],
    campanasConocidas: [],
    objetivos: [],
    uso: {
      personas: 0,
      conRopaPropia: 0,
      ropaPropiaMediana: null,
      looksMediana: null,
      modulos: { viaje: 0, capsula: 0, prueba: 0, fitcheck: 0, adelantado: 0 },
    },
    extras: new Map(),
    avatar: { cara: 0, cuerpo: 0, guardaron: 0 },
    dispositivos: {
      computadora: { cuentas: 0, primerLook: 0 },
      celular: { cuentas: 0, primerLook: 0 },
      tablet: { cuentas: 0, primerLook: 0 },
      sinDato: { cuentas: 0, primerLook: 0 },
    },
    paises: [],
    ...d,
  };
  const el = await AdminCampana({ searchParams: Promise.resolve({}) });
  return renderToStaticMarkup(el);
}

describe("/admin/campana", () => {
  it("enseña el veredicto del paro en cuanto lo hay", async () => {
    const h = await html({ paro: { estado: "no-pasa", conPrimerLook: 30, cerradas: 30, volvieron: 2 } });
    expect(h).toContain("NO PASA");
  });

  it("una campaña con gasto y nadie adentro sale en el embudo, con su costo", async () => {
    const h = await html({
      resumen: [fila],
      gasto: [{ dia: "2026-09-25", campana: "hombres-eventos", clics: 80, costo_mxn: 600, registros_google: 0 }],
    });
    expect(h).toContain("hombres-eventos");
    expect(h).toContain("$600");
  });

  it("dice el tipo de cambio que supone al sumar la IA al anuncio", async () => {
    const h = await html({});
    expect(h).toMatch(/MXN por dólar \(supuesto/);
  });

  it("cada objetivo del plan sale con su estado en palabras, no sólo en color", async () => {
    const h = await html({
      objetivos: [
        { clave: "costo-registro", objetivo: "Costo por registro", meta: "$200 o menos", real: "$500", estado: "alarma" },
      ],
    });
    expect(h).toContain("Objetivos del plan P-03");
    expect(h).toContain("Costo por registro");
    expect(h).toMatch(/text-error[^>]*>alarma</);
  });

  it("el uso de la primera semana dice cuando todavía no hay a quién medir", async () => {
    expect(await html({})).toContain("Todavía nadie de anuncios llegó a su primer look");
  });

  it("sin nada todavía, lo dice en vez de enseñar una tabla vacía muda", async () => {
    const h = await html({});
    expect(h).toContain("Nadie entró desde 2026-09-25");
  });
});
