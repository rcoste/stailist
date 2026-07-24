"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { toUsableImage } from "@/lib/image-file";
import { comprimir } from "@/lib/image-compress";
import { uploadGeneratedAvatar } from "@/lib/avatar-upload";
import { markNudge } from "@/lib/journey-actions";
import type { Gender } from "@/lib/auth";
import { builds, buildLabel, buildToBodyType, type Build } from "@/lib/silueta";

// Wizard de avatar digital, en DOS etapas (A1, 2026-07-15): primero el RETRATO
// (la identidad se aprueba barata y enfocada — con juez visible y ajustes
// dirigidos), después el cuerpo completo ANCLADO a ese retrato aprobado. Si
// falla, sale limpio sin guardar nada (el avatar es opcional). Las fotos fuente
// no se persisten — solo viajan en la request de generación.

type BodyType = "slim" | "athletic" | "average" | "full";
// Hasta 2 caras + 3 cuerpos: más ángulos = identidad más fiel (Gemini 3 Pro
// Image acepta muchas referencias; antes solo mandábamos 3 fotos).
type Slot = "face" | "face2" | "body1" | "body2" | "body3";
type Step = "fotos" | "cara" | "cuerpo" | "generando" | "preview" | "error";

const GEN_MSGS_CARA = [
  "Estudiando tus fotos…",
  "Dibujando tu retrato…",
  "Afinando el parecido…",
];
const GEN_MSGS_CUERPO = [
  "Retrato aprobado — ahora el cuerpo…",
  "Generando tu avatar…",
  "Afinando los detalles…",
  "Casi listo…",
];

// Ajustes dirigidos del retrato: un tap = una corrección regenerada, en vez de
// "rehacer" a ciegas. La barba solo aplica a hombre.
const AJUSTES_BASE = [
  "pelo más corto",
  "pelo más largo",
  "más edad",
  "más joven",
  "piel más clara",
  "piel más oscura",
];
const AJUSTES_HOMBRE = ["sin barba", "más barba"];

function blobToB64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("b64"));
    r.readAsDataURL(blob);
  });
}

export function AvatarWizard({
  userId,
  gender,
  returnTo,
  skipHref,
  siluetaBuild,
}: {
  userId: string;
  gender: Gender;
  returnTo: string;
  /** Si se pasa, muestra "ahora no, seguir sin avatar" en el primer paso y lleva
   *  ahí (el avatar es opcional — en el onboarding no debe atrapar a nadie). */
  skipHref?: string;
  /** Complexión de la silueta del perfil (body_build). Si viene, el wizard NO
   *  re-pregunta la morfología (se define UNA vez; taxonomía de silueta) — solo
   *  ofrece las fotos de cuerpo opcionales. */
  siluetaBuild?: Build | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("fotos");
  const [photos, setPhotos] = useState<Record<Slot, File | null>>({
    face: null,
    face2: null,
    body1: null,
    body2: null,
    body3: null,
  });
  const [previews, setPreviews] = useState<Record<Slot, string | null>>({
    face: null,
    face2: null,
    body1: null,
    body2: null,
    body3: null,
  });
  // Morfología en la taxonomía de SILUETA (única fuente); el bodyType del
  // prompt se deriva. Altura opcional (A3) para las proporciones.
  const [build, setBuild] = useState<Build | null>(siluetaBuild ?? null);
  const [alturaTxt, setAlturaTxt] = useState("");
  const bodyType: BodyType | null = buildToBodyType(build);
  // Cómo se representa el cuerpo: elegir una silueta de referencia, o subir
  // fotos propias. Son EXCLUYENTES — antes se mostraban las dos cosas en la
  // misma pantalla y no quedaba claro qué hacer. `null` = aún no elige.
  // Si ya definió su silueta en Perfil, arranca en "referencia" (ya la tiene;
  // igual puede cambiarse a foto desde el paso).
  const [metodo, setMetodo] = useState<"referencia" | "foto" | null>(
    siluetaBuild ? "referencia" : null
  );
  // Complexión deducida de la foto de cuerpo (método por foto): así el motor no
  // se queda sin señal de morfología por haber subido foto en vez de elegir
  // silueta. Se muestra corregible; nunca se guarda a ciegas.
  const [deteccion, setDeteccion] = useState<
    { estado: "cargando" } | { estado: "listo"; confianza: string } | null
  >(null);
  const fotosCuerpo = [photos.body1, photos.body2, photos.body3].filter(Boolean).length;
  // Se puede generar si: eligió referencia (hay complexión) o subió ≥1 foto.
  const puedeGenerar = metodo === "foto" ? fotosCuerpo > 0 : !!bodyType;
  const [generated, setGenerated] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  // Mensaje del 403 de permiso parental (solo alcanzable desde una pestaña
  // vieja: la página ya gatea server-side). Si está, el paso error lo muestra
  // en vez del genérico con retry inútil.
  const [permisoMsg, setPermisoMsg] = useState<string | null>(null);

  async function failGen(res: Response): Promise<never> {
    if (res.status === 403) {
      const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (err.error === "permiso_pendiente" && err.message) setPermisoMsg(err.message);
    }
    throw new Error("gen");
  }
  const [saving, setSaving] = useState(false);
  const [genMsg, setGenMsg] = useState(GEN_MSGS_CARA[0]);
  // Etapa cara: retrato generado + veredicto del juez (visible) + ajuste libre.
  const [faceGen, setFaceGen] = useState<string | null>(null);
  const [faceVeredicto, setFaceVeredicto] = useState<{ score: number | null; problema: string } | null>(null);
  const [ajusteLibre, setAjusteLibre] = useState("");
  // Qué etapa está generando/falló (para los mensajes y el retry del error).
  const [genKind, setGenKind] = useState<"cara" | "cuerpo">("cara");
  // Las caras comprimidas se cachean: los ajustes regeneran sin recomprimir.
  const facesRef = useRef<{ face: string; extra: string[] } | null>(null);
  // Character sheet (A2): 3 vistas en una imagen. Se genera EN PARALELO mientras
  // la persona contempla el avatar en el preview; confirm() lo espera si sigue
  // en vuelo. Best-effort: si falla, el avatar se guarda sin sheet.
  const [sheetState, setSheetState] = useState<"idle" | "gen" | "done" | "fail">("idle");
  const [sheetGen, setSheetGen] = useState<string | null>(null);
  const sheetPromiseRef = useRef<Promise<string | null> | null>(null);

  function startSheet(bodyImage: string, headshot: string) {
    setSheetGen(null);
    setSheetState("gen");
    const p = (async (): Promise<string | null> => {
      try {
        const res = await fetch("/api/avatar/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: "sheet", headshotB64: headshot, avatarB64: bodyImage }),
        });
        if (!res.ok) await failGen(res);
        const data = (await res.json()) as { image?: string };
        if (!data.image) throw new Error("sheet");
        setSheetGen(data.image);
        setSheetState("done");
        return data.image;
      } catch {
        setSheetState("fail");
        return null;
      }
    })();
    sheetPromiseRef.current = p;
  }

  // Limpia los object URLs al desmontar.
  useEffect(() => {
    return () => {
      Object.values(previews).forEach((u) => u && URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mensajes rotativos durante la generación. El reset al primer mensaje se hace
  // al entrar a "generando" (en generateFace/generateBody), no aquí, para no
  // llamar setState sincrónicamente dentro del effect.
  useEffect(() => {
    if (step !== "generando") return;
    const msgs = genKind === "cara" ? GEN_MSGS_CARA : GEN_MSGS_CUERPO;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % msgs.length;
      setGenMsg(msgs[i]);
    }, 2500);
    return () => clearInterval(t);
  }, [step, genKind]);

  function setSlot(slot: Slot, file: File | null) {
    // Cambió una foto de cara → el caché comprimido y el retrato dejan de valer.
    if (slot === "face" || slot === "face2") {
      facesRef.current = null;
      setFaceGen(null);
      setFaceVeredicto(null);
    }
    setPhotos((p) => ({ ...p, [slot]: file }));
    setPreviews((prev) => {
      if (prev[slot]) URL.revokeObjectURL(prev[slot] as string);
      return { ...prev, [slot]: file ? URL.createObjectURL(file) : null };
    });
    // La foto principal de cuerpo dispara la detección de complexión (en
    // segundo plano, no bloquea nada). Solo si ella no eligió ya una silueta:
    // una elección explícita SIEMPRE manda sobre lo que deduzca la IA.
    if (slot === "body1") {
      if (!file) {
        setDeteccion(null);
      } else if (!siluetaBuild) {
        detectarComplexion(file);
      }
    }
  }

  // Best-effort: si falla, simplemente no hay sugerencia (el avatar se genera
  // igual con las fotos; solo se pierde la señal de morfología para el motor).
  async function detectarComplexion(file: File) {
    setDeteccion({ estado: "cargando" });
    try {
      const dataUrl = `data:image/jpeg;base64,${await aB64(file)}`;
      const res = await fetch("/api/analizar-cuerpo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, gender }),
      });
      if (!res.ok) {
        setDeteccion(null);
        return;
      }
      const d = (await res.json()) as { build: Build; confianza: string };
      setBuild(d.build);
      setDeteccion({ estado: "listo", confianza: d.confianza });
    } catch {
      setDeteccion(null);
    }
  }

  // La etapa cara solo pide la cara; el cuerpo (fotos opcionales) va después.
  const canContinue = !!photos.face;

  // Altura opcional: entero 100-230 cm o null (se ignora en silencio si no).
  const alturaCm = (() => {
    const n = parseInt(alturaTxt, 10);
    return Number.isInteger(n) && n >= 100 && n <= 230 ? n : null;
  })();

  const aB64 = async (f: File) => blobToB64(await comprimir(await toUsableImage(f)));

  async function facesB64(): Promise<{ face: string; extra: string[] }> {
    if (facesRef.current) return facesRef.current;
    const face = await aB64(photos.face as File);
    const extra = photos.face2 ? [await aB64(photos.face2)] : [];
    facesRef.current = { face, extra };
    return facesRef.current;
  }

  // Etapa 1: retrato. `ajuste` = corrección dirigida sobre el retrato previo.
  async function generateFace(ajuste?: string) {
    setGenKind("cara");
    setGenMsg(GEN_MSGS_CARA[0]);
    setStep("generando");
    try {
      const { face, extra } = await facesB64();
      const res = await fetch("/api/avatar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "face",
          faceB64: face,
          faceExtraB64: extra,
          ...(ajuste ? { ajuste, prevFaceB64: faceGen } : {}),
        }),
      });
      if (!res.ok) await failGen(res);
      const data = (await res.json()) as {
        image?: string;
        score?: number | null;
        problema?: string | null;
      };
      if (!data.image) throw new Error("gen");
      setFaceGen(data.image);
      setFaceVeredicto({ score: data.score ?? null, problema: data.problema ?? "" });
      setAjusteLibre("");
      setFails(0);
      setStep("cara");
    } catch {
      setFails((n) => n + 1);
      setStep("error");
    }
  }

  // Etapa 2: cuerpo completo anclado al retrato aprobado.
  async function generateBody() {
    if (!puedeGenerar || !faceGen) return;
    setGenKind("cuerpo");
    setGenMsg(GEN_MSGS_CUERPO[0]);
    setStep("generando");
    try {
      const { face } = await facesB64();
      const bodyFiles = [photos.body1, photos.body2, photos.body3].filter(Boolean) as File[];
      const bodyB64 = await Promise.all(bodyFiles.map(aB64));
      const res = await fetch("/api/avatar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "body",
          faceB64: face,
          headshotB64: faceGen,
          bodyB64,
          // Con el método por foto sin complexión, se omite: el API lo acepta
          // porque las fotos de cuerpo ya son la morfología.
          ...(bodyType ? { bodyType } : {}),
          ...(alturaCm ? { heightCm: alturaCm } : {}),
        }),
      });
      if (!res.ok) await failGen(res);
      const data = (await res.json()) as { image?: string };
      if (!data.image) throw new Error("gen");
      setGenerated(data.image);
      setFails(0);
      setStep("preview");
      // Las 3 vistas se generan en paralelo mientras contempla el avatar.
      if (faceGen) startSheet(data.image, faceGen);
    } catch {
      setFails((n) => n + 1);
      setStep("error");
    }
  }

  async function confirm() {
    if (!generated) return;
    setSaving(true);
    // Si el sheet sigue en vuelo, se espera (con tope — jamás bloquea el guardar).
    const sheet = sheetPromiseRef.current
      ? await Promise.race([
          sheetPromiseRef.current,
          new Promise<null>((r) => setTimeout(() => r(null), 45000)),
        ]).catch(() => null)
      : null;
    // El retrato aprobado se guarda como ancla de identidad (avatar-face.jpg)
    // y el sheet de 3 vistas como referencia multi-ángulo (avatar-sheet.jpg).
    const res = await uploadGeneratedAvatar(
      generated,
      userId,
      bodyType,
      faceGen,
      sheet,
      build,
      alturaCm
    );
    if (!res.ok) {
      setSaving(false);
      setFails((n) => n + 1);
      setStep("error");
      return;
    }
    await markNudge("tryon", "done");
    router.push(returnTo);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-bg px-4 py-4">
      {/* Salida del wizard. SOLO en los pasos que no tienen su propio "atrás":
          en cara/cuerpo/preview quedaban dos flechas idénticas apiladas que
          iban a lugares distintos (salir vs. paso anterior). Una sola flecha
          arriba, siempre. */}
      {step === "cara" || step === "cuerpo" || step === "preview" ? null : (
        <Link href={returnTo} className="text-sm font-medium text-muted hover:text-ink">
          ← Volver
        </Link>
      )}

      {step === "fotos" && (
        <div className="mt-2 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-h1 font-semibold text-ink">Crea tu avatar</h1>
            <p className="text-sm text-muted">
              Con tus fotos armo un avatar tuyo para probarte los looks encima. Tus
              fotos no se guardan, solo las uso para generarlo.
            </p>
            {/* Guía de captura: gran parte de los avatares inconsistentes vienen
                de fotos con lentes/gorra, mala luz o cuerpo recortado. */}
            <p className="mt-1 rounded-sm border border-line bg-surface px-3 py-2 text-xs text-muted">
              El secreto de un avatar fiel: luz natural, fondo despejado, sin
              lentes ni gorra — y entre más fotos me des, más se parece a ti.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <UploadTile
              label="Tu cara"
              hint="De frente, con luz de día, sin lentes ni gorra"
              preview={previews.face}
              onPick={(f) => setSlot("face", f)}
            />
            <UploadTile
              variant="sutil"
              label="Sumar otro ángulo de tu cara"
              hint="De lado o 3/4 — ayuda al parecido"
              preview={previews.face2}
              onPick={(f) => setSlot("face2", f)}
            />
          </div>
          <button
            type="button"
            disabled={!canContinue}
            onClick={() => generateFace()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-sm bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
          >
            <Icon name="destello" size={16} />
            Ver mi retrato
          </button>
          {skipHref ? (
            <Link
              href={skipHref}
              className="flex min-h-11 items-center justify-center rounded-sm text-sm font-medium text-muted transition-colors duration-200 hover:text-ink"
            >
              Ahora no, seguir sin avatar
            </Link>
          ) : null}
        </div>
      )}

      {step === "cara" && faceGen && (
        <div className="mt-2 flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setStep("fotos")}
            className="self-start text-sm font-medium text-muted hover:text-ink"
          >
            ← Fotos
          </button>
          <div className="flex flex-col gap-1">
            <h1 className="text-h1 font-semibold text-ink">¿Te reconoces?</h1>
            <p className="text-sm text-muted">
              Primero clavamos tu cara — el cuerpo se arma sobre este retrato.
            </p>
          </div>
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[240px] overflow-hidden rounded-lg border border-line bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${faceGen}`}
              alt="Tu retrato generado"
              className="h-full w-full object-cover"
            />
          </div>

          {/* Juez de parecido, VISIBLE: antes puntuaba en silencio y se tiraba. */}
          {faceVeredicto?.score != null ? (
            faceVeredicto.score >= 7 ? (
              <p className="text-center text-xs text-muted">
                Mi juez de parecido te reconoce ({faceVeredicto.score}/10).
              </p>
            ) : (
              <p className="text-center text-xs leading-snug text-warning">
                A mi juez no le convence ({faceVeredicto.score}/10)
                {faceVeredicto.problema ? `: ${faceVeredicto.problema}` : ""}. Prueba un
                ajuste abajo o cambia la foto.
              </p>
            )
          ) : null}

          <button
            type="button"
            onClick={() => setStep("cuerpo")}
            className="flex min-h-12 items-center justify-center gap-2 rounded-sm bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            <Icon name="check" size={16} />
            Sí, soy yo — sigamos
          </button>

          {/* Ajustes dirigidos: un tap = una corrección, sin rehacer a ciegas. */}
          <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
            <p className="text-xs font-semibold text-ink">¿Algo no cuadra? Corrígelo:</p>
            <div className="flex flex-wrap gap-1.5">
              {[...AJUSTES_BASE, ...(gender === "hombre" ? AJUSTES_HOMBRE : [])].map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => generateFace(a)}
                  className="rounded-sm border border-line bg-bg px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink"
                >
                  {a}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={ajusteLibre}
                onChange={(e) => setAjusteLibre(e.target.value)}
                placeholder="o dime tú — “sin lentes”, “pelo rizado”…"
                maxLength={140}
                className="min-h-10 min-w-0 flex-1 rounded-sm border border-line bg-bg px-3 text-sm text-ink placeholder:text-faint focus:border-ink focus:outline-none"
              />
              <button
                type="button"
                disabled={!ajusteLibre.trim()}
                onClick={() => generateFace(ajusteLibre.trim())}
                className="min-h-10 shrink-0 rounded-sm border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:border-ink disabled:opacity-50"
              >
                Corregir
              </button>
            </div>
            <button
              type="button"
              onClick={() => generateFace()}
              className="flex items-center justify-center gap-1.5 self-center text-xs font-medium text-muted hover:text-ink"
            >
              <Icon name="repetir" size={13} /> Rehacer desde tus fotos
            </button>
          </div>
        </div>
      )}

      {step === "cuerpo" && (
        <div className="mt-2 flex flex-col gap-5">
          <button
            type="button"
            onClick={() => setStep("cara")}
            className="self-start text-sm font-medium text-muted hover:text-ink"
          >
            ← Tu retrato
          </button>
          {/* Elección de MÉTODO: excluyente. Antes se mostraban la galería y
              los slots de foto juntos y no quedaba claro qué hacer. */}
          {metodo === null ? (
            <>
              <div className="flex flex-col gap-1">
                <h1 className="text-h1 font-semibold text-ink">Ahora, tu cuerpo</h1>
                <p className="text-sm text-muted">
                  Para que la ropa te quede fiel. Elige cómo prefieres:
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setMetodo("referencia")}
                  className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-ink"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                    <Icon name="gancho" size={20} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-ink">
                      Elegir un cuerpo parecido
                    </span>
                    <span className="text-xs text-muted">
                      Escoges de {builds(gender).length} siluetas. Rápido y sin fotos.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMetodo("foto")}
                  className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-ink"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                    <Icon name="camara" size={20} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-ink">
                      Usar una foto mía
                    </span>
                    <span className="text-xs text-muted">
                      Súbeme fotos de tu cuerpo. Más fiel a tus proporciones.
                    </span>
                  </span>
                </button>
              </div>
            </>
          ) : metodo === "referencia" ? (
            <div className="flex flex-col gap-1">
              <h1 className="text-h1 font-semibold text-ink">
                ¿Cuál se parece más a tu cuerpo?
              </h1>
              <p className="text-sm text-muted">
                {siluetaBuild
                  ? `Ya tenías ${buildLabel(siluetaBuild)} en tu silueta — cámbiala aquí si quieres.`
                  : "Es para que la ropa te quede fiel."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <h1 className="text-h1 font-semibold text-ink">Súbeme tu cuerpo</h1>
              <p className="text-sm text-muted">
                De pie y de frente. Con una basta; más ángulos, más fiel.
              </p>
            </div>
          )}
          {metodo === "referencia" ? (
            // Galería VISUAL de complexiones (A3): las MISMAS imágenes y
            // taxonomía que Perfil → Mi silueta — una sola pregunta de
            // morfología en todo el producto, con ejemplos reales.
            <div
              className={`grid gap-3 ${
                builds(gender).length === 3 ? "grid-cols-3" : "grid-cols-2"
              }`}
            >
              {builds(gender).map((b) => {
                const selected = build === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBuild(b.id)}
                    aria-pressed={selected}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors ${
                      selected
                        ? "border-accent bg-accent-soft"
                        : "border-line bg-surface hover:border-ink"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.img} alt="" className="h-28 w-auto" />
                    <span
                      className={`text-center text-sm font-medium leading-tight ${
                        selected ? "text-accent" : "text-ink"
                      }`}
                    >
                      {b.label}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Fotos de cuerpo: SOLO en el método por foto (antes salían siempre,
              junto a la galería). La primera es la que importa; las otras dos
              suman ángulos. */}
          {metodo === "foto" ? (
            <div className="flex flex-col gap-3">
              <UploadTile
                label="Foto de tu cuerpo"
                hint="De pie y de frente"
                preview={previews.body1}
                onPick={(f) => setSlot("body1", f)}
              />
              <UploadTile
                variant="sutil"
                label="Sumar otro ángulo"
                hint="De lado o 3/4"
                preview={previews.body2}
                onPick={(f) => setSlot("body2", f)}
              />
              <UploadTile
                variant="sutil"
                label="Sumar una más"
                hint="Otro ángulo o con otra ropa"
                preview={previews.body3}
                onPick={(f) => setSlot("body3", f)}
              />

              {/* Complexión deducida de la foto: se muestra para que la pueda
                  corregir (nunca se guarda a ciegas). Si la IA dudó, el copy
                  lo dice en vez de afirmarlo con seguridad falsa. */}
              {deteccion?.estado === "cargando" ? (
                <p className="flex items-center gap-2 px-1 text-xs text-muted">
                  <Spinner className="h-3 w-3" />
                  Viendo tu complexión…
                </p>
              ) : deteccion?.estado === "listo" && build ? (
                <p className="px-1 text-xs text-muted">
                  {deteccion.confianza === "baja"
                    ? "No la vi del todo bien; puse "
                    : "Por tu foto diría que tu complexión es "}
                  <span className="font-medium text-ink">{buildLabel(build)}</span>. Así
                  afino los consejos de estilo.{" "}
                  <button
                    type="button"
                    onClick={() => setMetodo("referencia")}
                    className="font-medium text-ink underline underline-offset-2"
                  >
                    Cambiar
                  </button>
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Altura + CTA: solo una vez elegido el método (en la pantalla de
              elección estorbarían). La altura aplica a los dos caminos. */}
          {metodo !== null ? (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3">
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-ink">¿Cuánto mides?</span>
                  <span className="text-xs text-muted">Opcional — afina tus proporciones</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={100}
                    max={230}
                    value={alturaTxt}
                    onChange={(e) => setAlturaTxt(e.target.value)}
                    placeholder="170"
                    className="min-h-10 w-20 rounded-sm border border-line bg-bg px-2 text-center text-sm text-ink placeholder:text-faint focus:border-ink focus:outline-none"
                  />
                  <span className="text-xs text-muted">cm</span>
                </span>
              </div>

              <button
                type="button"
                disabled={!puedeGenerar}
                onClick={generateBody}
                className="flex min-h-12 items-center justify-center gap-2 rounded-sm bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-50"
              >
                <Icon name="destello" size={16} />
                Generar mi avatar
              </button>

              <button
                type="button"
                onClick={() => setMetodo(null)}
                className="self-center text-sm font-medium text-muted hover:text-ink"
              >
                ← Cambiar forma
              </button>
            </>
          ) : null}
        </div>
      )}

      {step === "generando" && (
        <div className="mt-2 flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-line border-t-accent" />
          <p className="text-sm font-medium text-ink">{genMsg}</p>
          <p className="text-xs text-muted">Tarda unos segundos.</p>
        </div>
      )}

      {step === "preview" && generated && (
        <div className="mt-2 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-h1 font-semibold text-ink">¿Quedó?</h1>
            <p className="text-sm text-muted">
              Si no se te parece, rehazlo. Si te gusta, lo guardo como tu avatar.
            </p>
          </div>
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[280px] overflow-hidden rounded-lg border border-line bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${generated}`}
              alt="Tu avatar generado"
              className="h-full w-full object-cover"
            />
          </div>

          {/* Las 3 vistas (A2): se generan en paralelo y aparecen cuando están. */}
          {sheetState === "gen" ? (
            <p className="flex items-center justify-center gap-2 text-xs text-muted">
              <span className="h-3 w-3 animate-spin rounded-full border border-line border-t-accent" />
              Generando tus vistas de perfil y espalda…
            </p>
          ) : null}
          {sheetState === "done" && sheetGen ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                Tus vistas — frente · perfil · espalda
              </p>
              <div className="overflow-hidden rounded-lg border border-line bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/jpeg;base64,${sheetGen}`}
                  alt="Tus tres vistas: frente, perfil y espalda"
                  className="w-full object-cover"
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={confirm}
              className="flex min-h-12 items-center justify-center gap-2 rounded-sm bg-accent px-5 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Quedó, usar este"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={generateBody}
              className="flex min-h-11 items-center justify-center gap-2 rounded-sm border border-line bg-surface px-5 text-sm font-medium text-ink transition-colors duration-200 hover:border-ink disabled:opacity-60"
            >
              <Icon name="repetir" size={16} />
              Rehacer el cuerpo
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setStep("cara")}
              className="flex min-h-10 items-center justify-center text-xs font-medium text-muted transition-colors hover:text-ink"
            >
              La cara no quedó — volver a ajustarla
            </button>
          </div>
        </div>
      )}

      {step === "error" && (
        <div className="mt-2 flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon name="prohibido" size={22} />
          </span>
          <p className="text-sm font-medium text-ink">
            {permisoMsg ??
              (fails >= 2
                ? "No está saliendo ahorita. Inténtalo más tarde."
                : "No pude generar tu avatar.")}
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => (genKind === "cara" ? generateFace() : generateBody())}
              className="flex min-h-11 items-center justify-center rounded-sm bg-accent px-6 text-sm font-medium text-on-accent transition-colors duration-200 hover:bg-accent-deep"
            >
              Reintentar
            </button>
            <Link
              href={returnTo}
              className="flex min-h-11 items-center justify-center rounded-sm border border-line bg-surface px-6 text-sm font-medium text-muted transition-colors duration-200 hover:border-ink hover:text-ink"
            >
              Salir
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// variant "card" = acción principal (tarjeta completa). "sutil" = extra
// opcional: fila discreta SIN tarjeta, para que la jerarquía visual diga lo que
// el copy quiere decir. Dos tarjetas idénticas se leen como "dos pasos
// obligatorios" por más que una diga "Opcional" — el diseño le gana al texto.
function UploadTile({
  label,
  hint,
  preview,
  onPick,
  variant = "card",
}: {
  label: string;
  hint: string;
  preview: string | null;
  onPick: (file: File | null) => void;
  variant?: "card" | "sutil";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  if (variant === "sutil") {
    return (
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group flex items-center gap-2.5 px-1 py-1 text-left"
      >
        <span className="relative flex h-9 w-8 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-dashed border-line text-muted">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon name="mas" size={14} />
          )}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[13px] font-medium text-muted underline decoration-line underline-offset-2 group-hover:text-ink">
            {preview ? "Tocar para cambiar" : label}
          </span>
          <span className="text-[11px] leading-tight text-faint">{hint}</span>
        </span>
        {preview ? (
          <Icon name="check" size={15} className="ml-auto shrink-0 text-success" />
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-ink"
    >
      <span className="relative flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-line bg-bg text-muted">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon name="camara" size={20} />
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="text-xs text-muted">{preview ? "Tocar para cambiar" : hint}</span>
      </span>
      {preview ? (
        <Icon name="check" size={18} className="ml-auto shrink-0 text-success" />
      ) : (
        <Icon name="mas" size={18} className="ml-auto shrink-0 text-muted" />
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (inputRef.current) inputRef.current.value = "";
          onPick(f);
        }}
        className="hidden"
      />
    </button>
  );
}
