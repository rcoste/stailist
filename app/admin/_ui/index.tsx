import Link from "next/link";
import type { ReactNode } from "react";
import { banderaDe, paisEnPalabras } from "@/lib/lugar";

// EL KIT DEL ADMIN (2026-10-13). Seis piezas y nada más: toda pantalla de leer
// el experimento se arma con éstas, y ninguna pantalla declara las suyas.
//
// Por qué existe: tres replanteos del admin en cuatro días (10-09, 10-11,
// 10-12) reorganizaron QUÉ iba dónde y conservaron el mismo lenguaje visual —
// página como documento: pila de cajas iguales con rótulo de 12px, un párrafo
// explicando la pantalla arriba y otro explicando definiciones abajo, cinco
// acordeones cerrados, seis filas de chips de filtro, tablas de 7 a 14
// columnas. Roberto: "súper poco claro, revuelto, el UI asqueroso". Cada
// pantalla había inventado sus piezas (`Dato` existía dos veces, idéntica).
//
// Las reglas que estas piezas imponen:
//   · Una pantalla contesta su pregunta en la primera vista: cifras grandes
//     arriba, UNA vista principal debajo. Sin acordeones; lo secundario va en
//     pestañas visibles (Pestanas) o se va.
//   · Cero párrafos explicativos en pantalla. Las definiciones viven en
//     /admin/como-se-cuenta; aquí sólo cabe un `sub` de una línea.
//   · Los correos se leen por la parte de antes de la arroba (Quien); el
//     dominio va apagado.
//   · Tokens del sistema, nunca hex: bg-surface, border-line/line2, text-ink
//     /muted/faint, bg-tile, text-success/error.

/* ───────────────────────── Encabezado de página ───────────────────────── */

export function Encabezado({
  titulo,
  sub,
  children,
}: {
  titulo: string;
  /** Una línea de contexto. No un párrafo: lo que necesite más va a Cómo se cuenta. */
  sub?: ReactNode;
  /** Controles a la derecha (periodo, acciones). */
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-h1 font-bold tracking-[-0.025em] text-ink">{titulo}</h1>
        {sub ? <p className="mt-0.5 text-sm text-muted">{sub}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

/** Un control del encabezado (periodo, acción). Enlace o botón de formulario. */
export function Control({
  href,
  activo = false,
  children,
}: {
  href: string;
  activo?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-9 items-center rounded-sm border px-3 text-sm font-medium transition-colors duration-200 ${
        activo ? "border-ink bg-ink text-on-accent" : "border-line bg-surface text-ink2 hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

/* ───────────────────────── Panel ───────────────────────── */

export function Panel({
  titulo,
  extra,
  hero = false,
  sinPadding = false,
  className = "",
  children,
}: {
  titulo?: ReactNode;
  /** Lo que va a la derecha del título: un enlace, una nota corta. */
  extra?: ReactNode;
  /** El panel que contesta la pregunta de la página: borde de tinta. */
  hero?: boolean;
  /** Para listas y tablas que pintan hasta el borde. */
  sinPadding?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-lg bg-surface ${hero ? "border-2 border-ink" : "border border-line"} ${className}`}
    >
      {titulo ? (
        <div className="flex items-baseline justify-between gap-3 px-5 pt-4">
          <h2 className="text-[15px] font-bold tracking-[-0.01em] text-ink">{titulo}</h2>
          {extra ? <div className="text-[13px] text-muted">{extra}</div> : null}
        </div>
      ) : null}
      <div className={sinPadding ? (titulo ? "pt-2" : "") : titulo ? "px-5 pb-4 pt-3" : "p-5"}>{children}</div>
    </section>
  );
}

/** Una fila de paneles o cifras. `cols` = cuántas en escritorio; en celular siempre 1 o 2. */
export function Fila({
  cols,
  children,
  className = "",
}: {
  cols: 2 | 3 | 4 | "3-2" | "2-3";
  children: ReactNode;
  className?: string;
}) {
  const grid = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
    "3-2": "lg:grid-cols-[3fr_2fr]",
    "2-3": "lg:grid-cols-[2fr_3fr]",
  }[cols];
  return <div className={`mb-4 grid gap-4 ${grid} ${className}`}>{children}</div>;
}

/* ───────────────────────── Cifra ───────────────────────── */

export function Cifra({
  label,
  valor,
  unidad,
  sub,
  tono = "ink",
  barra,
  enPanel = true,
}: {
  label: string;
  valor: ReactNode;
  /** Lo que acompaña al número, chico y apagado: "de 6 que pide la regla", "MXN". */
  unidad?: ReactNode;
  sub?: ReactNode;
  tono?: "ink" | "success" | "error";
  /** Barra de avance debajo del número: n de de. */
  barra?: { n: number; de: number };
  /** false cuando la cifra va dentro de otro panel (el héroe). */
  enPanel?: boolean;
}) {
  const color = { ink: "text-ink", success: "text-success", error: "text-error" }[tono];
  const relleno = { ink: "bg-ink", success: "bg-success", error: "bg-error" }[tono];
  const pct = barra && barra.de > 0 ? Math.min(100, Math.round((barra.n / barra.de) * 100)) : 0;
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${enPanel ? "rounded-lg border border-line bg-surface px-5 py-4" : ""}`}>
      <span className="text-xs text-muted">{label}</span>
      <span className={`tabular-nums text-[30px] font-bold leading-9 tracking-[-0.03em] ${color}`}>
        {valor}
        {unidad ? <span className="ml-1 text-[15px] font-normal tracking-normal text-muted">{unidad}</span> : null}
      </span>
      {barra ? (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-tile">
          <div className={`h-full rounded-full ${relleno}`} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      {sub ? <span className="text-xs text-faint">{sub}</span> : null}
    </div>
  );
}

/* ───────────────────────── Personas ───────────────────────── */

/** Un correo legible: bandera, la parte de antes de la arroba en negritas, el dominio apagado. */
export function Quien({
  correo,
  pais,
  href,
  className = "",
}: {
  correo: string | null | undefined;
  pais?: string | null;
  href?: string;
  className?: string;
}) {
  const bandera = banderaDe(pais);
  const [local, dominio] = correo && correo.includes("@") ? correo.split("@") : [null, null];
  const nombre = local ? (
    <>
      {local}
      <span className="font-normal text-faint">@{dominio}</span>
    </>
  ) : (
    <span className="font-normal text-faint">{correo || "sin correo todavía"}</span>
  );
  const cuerpo = (
    <span className={`inline-flex min-w-0 items-baseline gap-2 ${className}`}>
      <span className="w-[18px] shrink-0 text-[13px]" title={pais ? paisEnPalabras(pais) : "sin país"}>
        {bandera ?? ""}
      </span>
      <span className="truncate font-semibold text-ink">{nombre}</span>
    </span>
  );
  return href ? (
    <Link href={href} className="min-w-0 hover:underline hover:decoration-line hover:underline-offset-2">
      {cuerpo}
    </Link>
  ) : (
    cuerpo
  );
}

/** Una lista de renglones con hairlines. Va dentro de un Panel sinPadding. */
export function Lista({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col">{children}</ul>;
}

export function Renglon({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <li className={`flex min-h-10 items-center gap-2.5 border-t border-line2 px-5 py-2 first:border-t-0 ${className}`}>
      {children}
    </li>
  );
}

/** El pie de una lista: el resumen de lo que no se listó, con su enlace. */
export function PieDeLista({ children }: { children: ReactNode }) {
  return <div className="border-t border-line2 px-5 py-2.5 text-[13px] text-muted">{children}</div>;
}

export function Chip({
  children,
  tono = "muted",
}: {
  children: ReactNode;
  tono?: "muted" | "ink" | "success" | "error";
}) {
  const c = {
    muted: "border-line text-muted",
    ink: "border-ink text-ink",
    success: "border-success text-success",
    error: "border-error text-error",
  }[tono];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-[7px] text-[11px] font-semibold leading-[18px] ${c}`}>
      {children}
    </span>
  );
}

/** Lo que va al final del renglón, apagado (origen, fecha). */
export function AlFinal({ children }: { children: ReactNode }) {
  return <span className="ml-auto shrink-0 pl-2 text-[13px] text-muted">{children}</span>;
}

/* ───────────────────────── Tabla ───────────────────────── */

/**
 * Una tabla con la cabecera apagada, celdas numéricas a la derecha y una
 * línea secundaria (`Sub`) bajo el dato cuando hace falta. Va dentro de un
 * Panel sinPadding; en celular se desplaza a lo ancho dentro del panel.
 */
export function Tabla({ children, minW = "" }: { children: ReactNode; minW?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse text-sm ${minW}`}>{children}</table>
    </div>
  );
}

export function Th({ children, izq = false, className = "" }: { children?: ReactNode; izq?: boolean; className?: string }) {
  return (
    <th
      className={`whitespace-nowrap border-b border-line px-3 py-2.5 text-xs font-medium text-muted first:pl-5 last:pr-5 ${
        izq ? "text-left" : "text-right"
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, izq = false, className = "" }: { children?: ReactNode; izq?: boolean; className?: string }) {
  return (
    <td
      className={`border-t border-line2 px-3 py-2.5 align-top tabular-nums text-ink first:pl-5 last:pr-5 [tr:first-child>&]:border-t-0 ${
        izq ? "text-left" : "text-right"
      } ${className}`}
    >
      {children}
    </td>
  );
}

/** La línea secundaria de una celda: el %, los clics, la nota. */
export function Sub({ children }: { children: ReactNode }) {
  return <span className="block text-xs font-normal text-faint">{children}</span>;
}

/* ───────────────────────── Filtros y pestañas ───────────────────────── */

/**
 * Los filtros de una pantalla, en UNA línea: cada grupo es "rótulo · opciones",
 * cada opción un enlace (sin JavaScript, la URL se puede guardar). Sustituye a
 * las seis filas de chips que abrían Retención.
 */
export function Filtros({
  grupos,
}: {
  grupos: { titulo: string; opciones: { href: string; label: string; activo: boolean }[] }[];
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
      {grupos.map((g) => (
        <span key={g.titulo} className="inline-flex flex-wrap items-center gap-1">
          <span className="mr-1 text-faint">{g.titulo}</span>
          {g.opciones.map((o) => (
            <Link
              key={o.href}
              href={o.href}
              className={`rounded-sm px-2 py-0.5 transition-colors duration-200 ${
                o.activo ? "bg-ink font-medium text-on-accent" : "text-ink2 hover:bg-tile hover:text-ink"
              }`}
            >
              {o.label}
            </Link>
          ))}
        </span>
      ))}
    </div>
  );
}

/** Las pestañas de una sección: enlaces subrayados, sin acordeones. */
export function Pestanas({
  pestanas,
  activa,
  sufijo = "",
}: {
  pestanas: { href: string; label: string; nota?: ReactNode }[];
  activa: string;
  /** Los filtros vigentes, para que cambiar de pestaña no los pierda. */
  sufijo?: string;
}) {
  return (
    <nav className="-mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-line px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {pestanas.map((p) => (
        <Link
          key={p.href}
          href={`${p.href}${sufijo}`}
          className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-200 ${
            p.href === activa ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {p.label}
          {p.nota ? <span className="ml-1.5 text-xs font-normal text-faint">{p.nota}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/* ───────────────────────── Vacío ───────────────────────── */

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="px-5 py-4 text-sm text-muted">{children}</p>;
}
