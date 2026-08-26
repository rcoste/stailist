"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DEFECTOS_MOTOR } from "@/lib/comparador/motor";
import { agruparConjuntos, veredictoDeTraje } from "@/lib/traje";
import { formalidadLegible } from "@/lib/formalidad";
import { votarParMotor, completarMarcas } from "../../motor-actions";

// Votar a ciegas, un par a la vez. Las columnas se llaman "Look A / Look B" y
// el orden viene barajado del servidor: aquí NADIE sabe qué variante es cuál —
// el voto viaja como izquierda/derecha y el servidor lo resuelve.
//
// UNA PESTAÑA POR LOOK, y esa decisión manda todo lo demás. La primera versión
// apilaba los 3 looks de cada lado en dos columnas: en un celular eso deja
// ~170px por lado, así que las prendas salían a 56px ("no se ven, están muy
// chiquitas"), el try-on era lo único legible porque ocupaba el ancho completo,
// y las etiquetas de defecto caían al fondo de la columna leyéndose como si
// aplicaran a los tres looks. Mostrando UN look por lado a la vez, las prendas
// caben al doble y cada control —👍/👎, defectos, comentario, try-on— vive
// dentro del look al que pertenece.
//
// Lado a lado se queda: comparar A contra B ES la tarea, y apilarlos obligaría
// a recordar uno mientras se mira el otro.

export type LookParaVotar = {
  nombre: string;
  explicacion: string;
  tip: string | null;
  prendas: {
    id: string;
    nombre: string;
    swatch: string;
    imagen: string | null;
    /** El lazo del traje (ver PrendaUI): habilita la etiqueta de "mismo traje". */
    conjunto?: string | null;
  }[];
};

export type ParParaVotar = {
  parId: string;
  n: number;
  etiqueta: string;
  /** El evento concreto del brief (pool v2 en adelante). */
  plan: string | null;
  /** Los grados exactos del brief: "frío" a secas no se puede calificar. */
  clima: { temp: number; lluvia: boolean } | null;
  formalidad: string | null;
  /** Del dueño del clóset: el ancla concreta de la formalidad es por género. */
  gender: "hombre" | "mujer" | null;
  izq: LookParaVotar[];
  der: LookParaVotar[];
  claveIzq: string;
  claveDer: string;
};

type PorLook<T> = Record<number, T>;

/** Lo que Roberto escribe una y otra vez, a un toque. El texto es el suyo. */
const ATAJOS_COMENTARIO = [
  "bien, pero muy formal para la ocasión",
  "bien, pero muy casual para la ocasión",
  // Los dos del CLIMA (pedidos viendo la matriz de votar): el look se sostiene
  // y lo que falla es la temperatura. Señal de REGLA (física, para todos), a
  // diferencia de los de registro, que son señal de DIAL (de la persona).
  "el look está bien, pero muy abrigado para el clima",
  "el look está bien, pero desabrigado para el clima",
  "depende del tipo de plan — así no puedo decidir",
];

/** "1, 2 y 3" — el botón nombra lo que falta, no cuenta cuántos faltan. */
function listaEnEspanol(ns: number[]): string {
  if (ns.length <= 1) return String(ns[0] ?? "");
  return `${ns.slice(0, -1).join(", ")} y ${ns[ns.length - 1]}`;
}

function Lado({
  titulo,
  look,
  indice,
  marca,
  setMarca,
  defectos,
  setDefectos,
  comentario,
  setComentario,
  tryon,
  pedirTryon,
  rendereando,
}: {
  titulo: string;
  look: LookParaVotar | undefined;
  indice: number;
  marca?: "arriba" | "abajo";
  setMarca: (m: "arriba" | "abajo" | undefined) => void;
  defectos: string[];
  setDefectos: (d: string[]) => void;
  comentario?: string;
  setComentario: (c: string) => void;
  tryon?: { image?: string; error?: string; detalle?: string };
  pedirTryon: () => void;
  rendereando: boolean;
}) {
  const alternar = (clave: string) =>
    setDefectos(
      defectos.includes(clave) ? defectos.filter((x) => x !== clave) : [...defectos, clave]
    );
  // LO QUE SE USA VA A LA VISTA; LO QUE NO, PLEGADO. Medido sobre 105 pares
  // votados: el 👍/👎 se usa en el 97%, el comentario por look en el 57%, los
  // chips de defecto en el 21%. Siete chips por lado y por look eran la mitad
  // del scroll de la pantalla para un control que se toca una de cada cinco
  // veces. El comentario se abre solo con el 👎 (es cuando Roberto escribe) y
  // los chips sólo si él los pide.
  const [verPeros, setVerPeros] = useState(false);
  const [verComentario, setVerComentario] = useState(false);
  const comentarioAbierto = verComentario || marca === "abajo" || !!comentario;
  const perosAbiertos = verPeros || defectos.length > 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{titulo}</p>

      {!look ? (
        // El prompt pide "2 o 3 outfits" (v54-v56 pidieron EXACTAMENTE 3 y se
        // revirtió en v57: forzar el tercero metía relleno), así que un lado
        // con 2 es legal aunque deje este hueco (el marcador lo cuenta). Este texto
        // existe porque Roberto abrió esta pestaña, encontró un lado vacío y
        // lo leyó como error de la pantalla.
        <p className="text-xs leading-relaxed text-muted">
          Este lado entregó menos looks: armó {indice} y el otro {indice + 1}.
          <span className="mt-0.5 block">
            El prompt acepta 2 o 3 looks. Este look no tiene pareja, así que
            no cuenta para el voto del par.
          </span>
        </p>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
          {/* min-h de dos renglones: sin esto un nombre que envuelve a 3
              líneas empuja sus prendas más abajo que las del otro lado, y la
              comparación prenda-contra-prenda deja de ser posible de un
              vistazo. Es una pantalla de comparar: las dos columnas tienen que
              arrancar a la misma altura. */}
          <div className="flex min-h-[2.6rem] items-start">
            <p className="line-clamp-2 text-sm font-semibold leading-tight text-ink">
              {look.nombre}
            </p>
          </div>
          {/* Pulgares al tamaño de un dedo y en su propia fila: es el control
              que más se toca, y al lado del nombre lo dejaba en "Cena con…". */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wide text-muted">¿sale?</span>
            <span className="flex shrink-0 gap-1.5">
              <button
                onClick={() => setMarca(marca === "arriba" ? undefined : "arriba")}
                aria-label="este look sí"
                className={`rounded-full border px-3 py-1.5 text-base leading-none ${
                  marca === "arriba" ? "border-ink bg-ink text-bg" : "border-line text-muted"
                }`}
              >
                👍
              </button>
              <button
                onClick={() => setMarca(marca === "abajo" ? undefined : "abajo")}
                aria-label="este look no"
                className={`rounded-full border px-3 py-1.5 text-base leading-none ${
                  marca === "abajo" ? "border-error bg-error text-on-accent" : "border-line text-muted"
                }`}
              >
                👎
              </button>
            </span>
          </div>

          {/* SÓLO SE AVISA CUANDO ALGO ESTÁ MAL. El "traje completo" ya no se
              escribe: desde que el par se dibuja junto (agruparConjuntos), la
              etiqueta repetía en texto lo que la retícula enseña. Roberto lo
              pidió así — "englobarlos, los que son del saco y el traje" — y una
              confirmación redundante encima de cinco fotos es justo lo que no
              se leía. El parchado y el suelto SÍ siguen, en acento: esos no se
              ven solos, y son el error que engaña (dos grises plausibles). */}
          {(() => {
            const vt = veredictoDeTraje(look.prendas);
            if (!vt || vt.tipo === "completo") return null;
            const texto =
              vt.tipo === "parchado"
                ? "traje parchado: saco y pantalón de trajes distintos"
                : `${vt.prenda} sin su par`;
            return (
              <p className="mb-1.5 text-[11px] font-semibold leading-tight text-accent">
                {texto}
              </p>
            );
          })()}
          {/* Las prendas, EN GRANDE. Dos por fila dentro de la columna: con un
              solo look en pantalla caben al doble que antes. El traje va en UNA
              celda a todo lo ancho, con las dos piezas dentro y un pie común. */}
          <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
            {/* El traje va PRIMERO. Ocupa las dos columnas, así que dejarlo en
                su lugar de origen parte la fila anterior y deja un hueco a
                media retícula; arriba, el hueco cae al final, que es como se ve
                cualquier última fila incompleta. Y es la lectura correcta: si
                hay traje, el look ES el traje. */}
            {[...agruparConjuntos(look.prendas)]
              .sort((a, b) => Number(b.tipo === "conjunto") - Number(a.tipo === "conjunto"))
              .map((celda, ci) =>
              celda.tipo === "conjunto" ? (
                <div key={ci} className="col-span-2 flex flex-col items-center gap-1 rounded-lg border border-line bg-tile p-1.5">
                  <div
                    className="grid w-full gap-1.5"
                    style={{ gridTemplateColumns: `repeat(${celda.piezas.length}, minmax(0,1fr))` }}
                  >
                    {celda.piezas.map((p) => (
                      <span key={p.id} className="relative block aspect-square w-full overflow-hidden rounded-md border border-line bg-surface">
                        {p.imagen ? (
                          <Image
                            src={p.imagen}
                            alt={p.nombre}
                            fill
                            sizes="(max-width: 430px) 22vw, 120px"
                            loading="eager"
                            className="object-cover"
                          />
                        ) : (
                          <span className="absolute inset-0" style={{ backgroundColor: p.swatch }} aria-hidden />
                        )}
                      </span>
                    ))}
                  </div>
                  <span className="text-center text-[11px] font-semibold leading-tight text-ink">
                    {celda.nombre}
                  </span>
                </div>
              ) : (
                <div key={ci} className="flex flex-col items-center gap-1">
                  <span className="relative block aspect-square w-full overflow-hidden rounded-lg border border-line">
                    {celda.prenda.imagen ? (
                      <Image
                        src={celda.prenda.imagen}
                        alt={celda.prenda.nombre}
                        fill
                        sizes="(max-width: 430px) 22vw, 120px"
                        loading="eager"
                        className="object-cover"
                      />
                    ) : (
                      <span
                        className="absolute inset-0"
                        style={{ backgroundColor: celda.prenda.swatch }}
                        aria-hidden
                      />
                    )}
                  </span>
                  <span className="line-clamp-2 text-center text-[11px] leading-tight text-muted">
                    {celda.prenda.nombre}
                  </span>
                </div>
              )
            )}
          </div>

          {tryon?.image ? (
            <span className="relative block aspect-[3/4] overflow-hidden rounded-lg border border-line">
              <Image
                src={tryon.image}
                alt={`${look.nombre} en tu avatar`}
                fill
                sizes="(max-width: 430px) 45vw, 260px"
                loading="eager"
                className="object-cover"
              />
            </span>
          ) : null}
          {/* El motivo REAL cuando falla. El servicio de imágenes se cae solo
              —500 intermitentes, timeouts de red— y decir solo "sin render"
              dejaba imposible distinguir eso de un avatar que falta o de un
              prompt bloqueado. */}
          {tryon?.error ? (
            <p className="text-xs text-error">
              {tryon.error === "sin_avatar"
                ? "no tienes avatar"
                : tryon.error === "generacion"
                  ? "el servicio de imágenes falló — vuelve a intentar"
                  : `sin render (${tryon.error})`}
              {tryon.detalle ? (
                <span className="block text-[11px] text-muted">{tryon.detalle}</span>
              ) : null}
            </p>
          ) : null}
          {!tryon?.image ? (
            <button
              disabled={rendereando}
              onClick={pedirTryon}
              className="rounded-lg border border-line py-1.5 text-xs font-semibold text-ink active:bg-tile disabled:opacity-50"
            >
              {rendereando
                ? "vistiendo…"
                : tryon?.error
                  ? "reintentar"
                  : "verme con este"}
            </button>
          ) : null}

          <p className="text-xs leading-relaxed text-muted">{look.explicacion}</p>
          {look.tip ? (
            <p className="text-xs leading-relaxed text-muted">✦ {look.tip}</p>
          ) : null}

          {comentarioAbierto ? (
            <textarea
              value={comentario ?? ""}
              onChange={(e) => setComentario(e.target.value)}
              rows={2}
              autoFocus={verComentario && !comentario}
              placeholder={marca === "abajo" ? "qué no te late de este" : "qué le viste a este"}
              className="rounded-lg border border-line bg-bg p-2 text-sm text-ink placeholder:text-muted"
            />
          ) : null}

          {/* Los defectos, DENTRO del look y plegados. Antes vivían al fondo de
              la columna y se leían como si aplicaran a los tres; ahora además
              se esconden hasta que hacen falta (21% de uso). */}
          {perosAbiertos ? (
            <div className="flex flex-wrap gap-1">
              {DEFECTOS_MOTOR.map((d) => (
                <button
                  key={d.clave}
                  onClick={() => alternar(d.clave)}
                  className={`rounded-full border px-2 py-1 text-[11px] font-medium ${
                    defectos.includes(d.clave)
                      ? "border-error text-error"
                      : "border-line text-muted"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          ) : null}

          {/* ATAJOS DE COMENTARIO. Roberto, votando: "ponme algún atajo de
              comentario que sea 'bien, pero muy formal'" — el outfit se
              sostiene y lo que falla es el registro frente a la ocasión. Y el
              tercero es su duda convertida en dato: "es una cita, ¿qué tipo de
              cita? hay muchísimos contextos que influyen". Si ese chip se
              repite en un brief, el problema es el brief, no el motor. Un
              toque lo pone en el comentario; se puede seguir escribiendo. */}
          <div className="flex flex-wrap gap-1">
            {ATAJOS_COMENTARIO.map((a) => {
              const puesto = (comentario ?? "").includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() =>
                    setComentario(
                      puesto
                        ? (comentario ?? "").replace(a, "").replace(/^[\s·]+|[\s·]+$/g, "")
                        : [comentario?.trim(), a].filter(Boolean).join(" · ")
                    )
                  }
                  className={`rounded-full border px-2 py-1 text-[11px] font-medium ${
                    puesto ? "border-ink bg-ink text-bg" : "border-line text-muted"
                  }`}
                >
                  {a}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            {!comentarioAbierto ? (
              <button type="button" onClick={() => setVerComentario(true)} className="underline underline-offset-2">
                comentar
              </button>
            ) : null}
            {!perosAbiertos ? (
              <button type="button" onClick={() => setVerPeros(true)} className="underline underline-offset-2">
                marcar un pero
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export function VotarClient({
  pares,
  yaHechos,
  total,
  tamano,
  modo = "votar",
  corridaId,
}: {
  pares: ParParaVotar[];
  yaHechos: number;
  total: number;
  tamano: string;
  /**
   * "votar": el par no tiene voto todavía y se decide aquí.
   * "marcar": el par YA se votó y solo falta el diagnóstico look por look.
   *
   * Es un modo y no una segunda pantalla porque la primera versión SÍ fue una
   * segunda pantalla: prendas a 56px, sin try-on, sin etiquetas de defecto y
   * con los looks apilados. Mirar un look para juzgarlo es el mismo trabajo
   * las dos veces; que se vea distinto según de dónde entraste solo hacía la
   * marca peor que el voto.
   */
  modo?: "votar" | "marcar";
  corridaId: string;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [look, setLook] = useState(0);
  const [marcIzq, setMarcIzq] = useState<PorLook<"arriba" | "abajo">>({});
  const [marcDer, setMarcDer] = useState<PorLook<"arriba" | "abajo">>({});
  const [defIzq, setDefIzq] = useState<PorLook<string[]>>({});
  const [defDer, setDefDer] = useState<PorLook<string[]>>({});
  const [comIzq, setComIzq] = useState<PorLook<string>>({});
  const [comDer, setComDer] = useState<PorLook<string>>({});
  const [votos, setVotos] = useState<PorLook<"izq" | "der" | "empate">>({});
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Try-on por VARIANTE y por índice de look. La respuesta no dice izq/der
  // para no delatar el ciego; se mapea abajo con las claves del servidor.
  const [tryon, setTryon] = useState<
    Record<string, PorLook<{ image?: string; error?: string; detalle?: string }>>
  >({});
  const [renderizando, setRenderizando] = useState<number | null>(null);

  const par = pares[idx];
  const nLooks = Math.max(par.izq.length, par.der.length);
  const [verNota, setVerNota] = useState(false);
  const arriba = useRef<HTMLDivElement>(null);

  // DESKTOP ES OTRA PANTALLA, no la de celular estirada. Roberto vota en
  // desktop ("para las evaluaciones lo hago en desktop") y ahí la queja era
  // exacta: "pongo los thumbs y luego tengo que dar scroll para escoger A,
  // empate o B". En un contenedor de 1024px caben los tres looks en filas, y
  // en cada fila el voto va EN MEDIO de las dos tarjetas, a la altura de los
  // pulgares — sin pestañas y sin scroll entre una decisión y la otra. En
  // celular se queda el look-por-pestaña con la barra fija.
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const al = () => setDesktop(mq.matches);
    al();
    mq.addEventListener("change", al);
    return () => mq.removeEventListener("change", al);
  }, []);

  // Al cambiar de look, la pantalla vuelve arriba: las prendas del look nuevo
  // tienen que quedar a la vista sin que haya que subir a mano.
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    arriba.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [look, idx]);

  // Pide el look `indice` de LOS DOS lados. Nunca uno solo: si un lado tuviera
  // render y el otro no, la comparación mediría el formato, no el look.
  const verEnAvatar = async (indice: number) => {
    if (renderizando !== null) return;
    setRenderizando(indice);
    setError(null);
    try {
      const r = await fetch("/api/admin/comparador/tryon-par", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parId: par.parId, indice }),
      });
      const json = (await r.json()) as {
        porVariante?: Record<
          string,
          { image?: string; error?: string; detalle?: string }
        >;
        error?: string;
      };
      if (json.error) setError(json.error);
      else {
        const porVariante = json.porVariante ?? {};
        setTryon((prev) => {
          const next = { ...prev };
          for (const [clave, v] of Object.entries(porVariante)) {
            next[clave] = { ...(next[clave] ?? {}), [indice]: v };
          }
          return next;
        });
      }
    } catch {
      setError("no se pudo generar el try-on");
    } finally {
      setRenderizando(null);
    }
  };

  const votar = async () => {
    if (guardando) return;
    setGuardando(true);
    setError(null);
    const r =
      modo === "marcar"
        ? await completarMarcas(
            par.parId,
            { izq: marcIzq, der: marcDer },
            { izq: comIzq, der: comDer },
            { izq: defIzq, der: defDer },
            votos
          )
        : await votarParMotor(
            par.parId,
            votos,
            { izq: defIzq, der: defDer },
            nota,
            { izq: marcIzq, der: marcDer },
            { izq: comIzq, der: comDer }
          );
    setGuardando(false);
    if (!r.ok) {
      setError(r.error ?? "no se pudo guardar");
      return;
    }
    setMarcIzq({});
    setMarcDer({});
    setDefIzq({});
    setDefDer({});
    setComIzq({});
    setComDer({});
    setVotos({});
    setNota("");
    setTryon({});
    setLook(0);
    if (idx + 1 < pares.length) setIdx(idx + 1);
    else if (modo === "marcar") router.push(`/admin/comparador/motor/${corridaId}`);
    else router.refresh();
  };


  // Los looks que SE PUEDEN comparar: los dos lados armaron uno con ese índice.
  // Si un lado solo trajo dos looks, el tercero no tiene contra qué medirse y
  // exigir un voto ahí sería pedir algo imposible.
  const comparables = Array.from({ length: nLooks }, (_, i) => i).filter(
    (i) => par.izq[i] && par.der[i]
  );
  // Marcando, la puerta la cierra el 👍/👎 de CADA look existente (los dos
  // lados, aunque uno tenga menos): la marca es diagnóstico por look, no una
  // comparación, así que un look sin par de enfrente igual se puede juzgar.
  const sinMarca = Array.from({ length: nLooks }, (_, i) => i).filter(
    (i) => (par.izq[i] && !marcIzq[i]) || (par.der[i] && !marcDer[i])
  );
  const sinVoto = comparables.filter((i) => !votos[i]);
  // Marcando falta un look si le debe CUALQUIERA de las dos cosas: el 👍/👎 de
  // cada lado o la preferencia entre los dos. Son preguntas distintas —"¿este
  // sirve?" y "¿cuál de los dos?"— y las dos se pierden si el botón deja pasar.
  const faltan =
    modo === "marcar"
      ? [...new Set([...sinMarca, ...sinVoto])].sort((a, b) => a - b)
      : sinVoto;
  // El guardado se abre hasta calificar todo. Antes bastaba con un voto:
  // Roberto votaba el primero, el par se guardaba, y los looks 2 y 3 se
  // quedaban sin ver — 99 de 119 en el primer veredicto. El botón que deja
  // avanzar a medias termina midiendo lo que nadie miró.
  const listo =
    faltan.length === 0 && (modo === "marcar" || Object.keys(votos).length > 0);

  // EL VOTO AVANZA SOLO (en celular). Votar el look 1 y tener que buscar la
  // pestaña del 2 era la mitad del trabajo: al votar se pasa al siguiente look
  // sin voto; cuando no queda ninguno, la barra ofrece guardar.
  /** Los botones de voto de UN look. En celular viven en la barra fija; en
   *  desktop, en medio de la fila de ese look. El mismo control. (Función de
   *  render, no componente: un componente creado dentro del render se
   *  desmonta en cada pintado.) */
  const botonesVoto = (i: number, vertical?: boolean) => (
    <div className={vertical ? "flex flex-col gap-2" : "grid grid-cols-3 gap-2"}>
      {(["izq", "empate", "der"] as const).map((op) => (
        <button
          key={op}
          onClick={() => {
            if (i !== look) setLook(i);
            setVotos((prev) => {
              const next = { ...prev };
              if (next[i] === op) delete next[i];
              else next[i] = op;
              return next;
            });
            if (!desktop) {
              const siguiente = comparables.find((j) => j > i && !votos[j]);
              if (siguiente !== undefined) setLook(siguiente);
            }
          }}
          className={`rounded-lg border py-3 text-sm font-semibold ${
            votos[i] === op
              ? "border-ink bg-ink text-bg"
              : "border-line bg-surface text-ink active:bg-tile"
          }`}
        >
          {op === "izq" ? "Gana A" : op === "der" ? "Gana B" : "Empate"}
        </button>
      ))}
    </div>
  );
  const votable = !!(par.izq[look] && par.der[look]);

  return (
    <div ref={arriba} className="flex flex-col gap-4 scroll-mt-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-ink">
            {modo === "marcar" ? "Completar las marcas" : "¿Cuál quedó mejor?"}
          </h1>
          <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">
            {yaHechos + idx + 1} de {total}
          </span>
        </div>
        <p className="text-sm text-muted">
          Brief: <span className="font-semibold text-ink">{par.etiqueta}</span>
          {par.clima ? (
            <span>
              {" · "}{par.clima.temp}°C{par.clima.lluvia ? " · con lluvia" : ""}
            </span>
          ) : null}
          {tamano === "vistazo" && modo === "votar"
            ? " · vistazo: caza defectos, aquí no se corona a nadie"
            : ""}
          {modo === "marcar"
            ? " · este par ya se votó; falta el diagnóstico look por look. Sigue ciego: no se revela cuál columna es cuál."
            : ""}
        </p>
        {/* El evento concreto, tal cual lo recibió el motor. Sin esto, "evento"
            a secas no se puede calificar: una boda y una cena con amigos no
            comparten piso de formalidad ni calzado. */}
        {par.plan ? (
          <p className="text-sm text-ink">
            Pidió: “{par.plan}”
            {/* La formalidad TRADUCIDA, no la clave cruda. Decía solo "formal"
                y Roberto, votando: "aquí no está tan claro al decir formal cuál
                era el dress code". Quien califica necesita exactamente lo mismo
                que quien pide — un dato que no se puede leer no se puede
                calificar. */}
            {formalidadLegible(par.formalidad, par.gender) ? (
              <span className="text-muted">
                {" "}
                · {formalidadLegible(par.formalidad, par.gender)}
              </span>
            ) : (
              /* Desde el pool v11 los eventos sociales viajan SIN formalidad
                 (nadie declara código para una cena). Antes aquí se traducía
                 el código fantasma; ahora se dice la verdad del brief, para
                 que quien vota juzgue contra lo mismo que el motor supo. */
              <span className="text-muted"> · sin código declarado</span>
            )}
          </p>
        ) : null}
      </header>

      {/* Pestañas por look: cada lado muestra UNO a la vez, y así las prendas
          caben grandes. El punto marca los que ya llevan 👍/👎. */}
      <div className="flex gap-2 lg:hidden">
        {Array.from({ length: nLooks }, (_, i) => (
          <button
            key={i}
            onClick={() => setLook(i)}
            className={`flex-1 rounded-sm border py-2 text-sm font-semibold ${
              look === i ? "border-accent bg-accent-soft text-ink" : "border-line text-muted"
            }`}
          >
            Look {i + 1}
            {/* Un look que solo tiene un lado no se puede comparar: se marca
                con "–" en vez de dejar que la pestaña prometa una comparación
                que no existe. */}
            {!par.izq[i] || !par.der[i]
              ? " –"
              : votos[i]
                ? votos[i] === "izq"
                  ? " · A"
                  : votos[i] === "der"
                    ? " · B"
                    : " · ="
                : ""}
          </button>
        ))}
      </div>

      {desktop ? (
        <div className="flex flex-col gap-6">
          {Array.from({ length: nLooks }, (_, i) => (
            <section
              key={i}
              className="grid grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)] items-start gap-4 border-t border-line pt-4 first:border-t-0 first:pt-0"
            >
              <Lado
                titulo={`Look ${i + 1} · A`}
                look={par.izq[i]}
                indice={i}
                marca={marcIzq[i]}
                setMarca={(m) => {
                  const next = { ...marcIzq };
                  if (m) next[i] = m;
                  else delete next[i];
                  setMarcIzq(next);
                }}
                defectos={defIzq[i] ?? []}
                setDefectos={(d) => setDefIzq({ ...defIzq, [i]: d })}
                comentario={comIzq[i]}
                setComentario={(c) => setComIzq({ ...comIzq, [i]: c })}
                tryon={tryon[par.claveIzq]?.[i]}
                pedirTryon={() => verEnAvatar(i)}
                rendereando={renderizando === i}
              />
              {/* El voto, en medio y a la altura de los pulgares: "pongo los
                  thumbs y luego tengo que dar scroll para escoger" era esto. */}
              <div className="sticky top-20 flex flex-col gap-2 pt-16">
                <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Look {i + 1}
                </p>
                {par.izq[i] && par.der[i] ? (
                  botonesVoto(i, true)
                ) : (
                  <p className="text-center text-[11px] leading-relaxed text-muted">
                    no se vota: solo un lado lo armó
                  </p>
                )}
              </div>
              <Lado
                titulo={`Look ${i + 1} · B`}
                look={par.der[i]}
                indice={i}
                marca={marcDer[i]}
                setMarca={(m) => {
                  const next = { ...marcDer };
                  if (m) next[i] = m;
                  else delete next[i];
                  setMarcDer(next);
                }}
                defectos={defDer[i] ?? []}
                setDefectos={(d) => setDefDer({ ...defDer, [i]: d })}
                comentario={comDer[i]}
                setComentario={(c) => setComDer({ ...comDer, [i]: c })}
                tryon={tryon[par.claveDer]?.[i]}
                pedirTryon={() => verEnAvatar(i)}
                rendereando={renderizando === i}
              />
            </section>
          ))}
        </div>
      ) : (
      <div className="flex gap-3">
        <Lado
          titulo="Look A"
          look={par.izq[look]}
          indice={look}
          marca={marcIzq[look]}
          setMarca={(m) => {
            const next = { ...marcIzq };
            if (m) next[look] = m;
            else delete next[look];
            setMarcIzq(next);
          }}
          defectos={defIzq[look] ?? []}
          setDefectos={(d) => setDefIzq({ ...defIzq, [look]: d })}
          comentario={comIzq[look]}
          setComentario={(c) => setComIzq({ ...comIzq, [look]: c })}
          tryon={tryon[par.claveIzq]?.[look]}
          pedirTryon={() => verEnAvatar(look)}
          rendereando={renderizando === look}
        />
        <Lado
          titulo="Look B"
          look={par.der[look]}
          indice={look}
          marca={marcDer[look]}
          setMarca={(m) => {
            const next = { ...marcDer };
            if (m) next[look] = m;
            else delete next[look];
            setMarcDer(next);
          }}
          defectos={defDer[look] ?? []}
          setDefectos={(d) => setDefDer({ ...defDer, [look]: d })}
          comentario={comDer[look]}
          setComentario={(c) => setComDer({ ...comDer, [look]: c })}
          tryon={tryon[par.claveDer]?.[look]}
          pedirTryon={() => verEnAvatar(look)}
          rendereando={renderizando === look}
        />
      </div>
      )}

      {/* LA BARRA FIJA. El voto del look visible vivía al final de la página,
          después de dos columnas de prendas, explicación, tip y chips: un
          scroll largo por look, tres looks por par, seis pares. Ahora el voto
          —el control que decide el experimento— está siempre a la vista, y
          cuando el par ya está completo la misma barra ofrece guardarlo.

          Marcando también se pregunta, pero NO reescribe el voto del par: se
          guarda aparte (prefs_look). El voto salió a ciegas y antes de que el
          marcador fuera alcanzable —es lo que lee la regla pre-registrada—;
          esto se anota después, con el marcador ya visible. Sigue siendo
          ciego por par, así que es dato bueno; solo es dato MÁS DÉBIL.

          NO se vota un look que solo un lado armó: no hay qué comparar, y ese
          voto contaba igual para la mayoría del par. Pasó en el veredicto —
          el par 6 salió "empate" y su espejo "gana Gemini", y la ÚNICA
          diferencia era un voto contra un lado vacío. */}
      {modo === "votar" ? (
        <div className="flex flex-col gap-1">
          {verNota || nota ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Nota de todo el par (opcional)
              </p>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                rows={2}
                autoFocus={!nota}
                placeholder="qué te decidió, qué te chocó, qué le faltó al otro"
                className="rounded-sm border border-line bg-bg p-3 text-sm text-ink placeholder:text-muted"
              />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setVerNota(true)}
              className="self-start text-xs text-muted underline underline-offset-2"
            >
              agregar una nota de todo el par
            </button>
          )}
        </div>
      ) : null}

      {error ? <p className="text-sm text-error">{error}</p> : null}

      <div className="sticky bottom-0 z-30 -mx-4 flex flex-col gap-2 border-t border-line bg-bg px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5">
        {listo ? (
          <button
            disabled={guardando}
            onClick={votar}
            className="rounded-sm bg-ink py-4 text-base font-semibold text-bg active:opacity-80 disabled:opacity-50"
          >
            {guardando
              ? "Guardando…"
              : modo === "marcar"
                ? idx + 1 < pares.length
                  ? "Guardar y siguiente"
                  : "Guardar y terminar"
                : idx + 1 < pares.length
                  ? `Guardar el par ${yaHechos + idx + 1} → siguiente`
                  : "Guardar el último par"}
          </button>
        ) : desktop ? (
          <p className="py-2 text-center text-xs text-muted">
            {faltan.length === 1
              ? `Falta votar el look ${faltan[0] + 1}`
              : `Faltan los looks ${listaEnEspanol(faltan.map((i) => i + 1))}`}
            {modo === "marcar" ? " (👍/👎 de los dos lados y tu preferencia)" : ""}
          </p>
        ) : !votable ? (
          <p className="py-2 text-center text-xs text-muted">
            Este look no se vota: solo un lado lo armó. Pasa al siguiente.
          </p>
        ) : (
          <>
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted">
              Look {look + 1} · ¿cuál te late más?
              {modo === "marcar" ? " (no cambia el voto del par)" : ""}
            </p>
            {botonesVoto(look)}
            {faltan.length ? (
              <p className="text-center text-[11px] text-muted">
                {faltan.length === 1
                  ? `falta el look ${faltan[0] + 1}`
                  : `faltan los looks ${listaEnEspanol(faltan.map((i) => i + 1))}`}
                {modo === "marcar" ? " (👍/👎 de los dos lados y tu preferencia)" : ""}
              </p>
            ) : null}
          </>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-muted">
        {modo === "marcar"
          ? "El voto de este par ya está emitido y no se toca; aquí sólo se completa el 👍/👎 de cada look y tu preferencia, que se guarda aparte."
          : "Se vota look contra look y el par sale por mayoría. El 👍/👎 y los comentarios son aparte y opcionales — son lo que más se lee después."}
      </p>
    </div>
  );
}
