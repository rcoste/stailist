"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/spinner";
import { ImageCrop } from "@/components/image-crop";
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

// El recortador (ImageCrop) devuelve un dataURL; el wizard trabaja con File.
async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
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
  // Ya NO hay pantalla de bifurcación: la retícula de siluetas es el default
  // ("referencia"); la foto de cuerpo sigue disponible como link, no como paso.
  const [metodo, setMetodo] = useState<"referencia" | "foto">("referencia");
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
  // Correcciones de la cara: arrancan COLAPSADAS (el camino feliz manda; los
  // ajustes no compiten con "sí, soy yo").
  const [ajustesOpen, setAjustesOpen] = useState(false);
  // Foto de cara en recorte (dataURL). Reusa ImageCrop (mismo del carrete de
  // prendas): sirve para aislarte si la foto trae más de una persona.
  const [cropFaceSrc, setCropFaceSrc] = useState<string | null>(null);
  // Qué etapa está generando/falló (para los mensajes y el retry del error).
  const [genKind, setGenKind] = useState<"cara" | "cuerpo">("cara");
  // Las caras comprimidas se cachean: los ajustes regeneran sin recomprimir.
  const facesRef = useRef<{ face: string; extra: string[] } | null>(null);
  // Character sheet (A2): 3 vistas en una imagen. Se genera EN PARALELO mientras
  // la persona contempla el avatar en el preview; confirm() lo espera vía
  // sheetPromiseRef si sigue en vuelo. Best-effort: si falla, el avatar se guarda
  // sin sheet. Ya NO se muestra en la UI (la tira se fue) — vive solo para el
  // try-on multi-ángulo, así que basta el promise; no necesita estado de render.
  const sheetPromiseRef = useRef<Promise<string | null> | null>(null);

  function startSheet(bodyImage: string, headshot: string) {
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
        return data.image;
      } catch {
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
      {/* Header único (back + progreso + "paso N de 3") en las cuatro pantallas
          reales. El back navega al paso anterior; en la primera, sale del wizard.
          En "generando"/"error" (transitorias) no va. */}
      {step === "fotos" || step === "cara" || step === "cuerpo" || step === "preview" ? (
        <ProgressHeader
          paso={step === "fotos" ? 1 : step === "cara" ? 2 : step === "cuerpo" ? 3 : "listo"}
          onBack={
            step === "fotos"
              ? () => router.push(returnTo)
              : step === "cara"
                ? () => setStep("fotos")
                : step === "cuerpo"
                  ? () => setStep("cara")
                  : () => setStep("cuerpo")
          }
        />
      ) : null}

      {step === "fotos" && (
        <div className="mt-2 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-h1 font-semibold text-ink">Una foto tuya</h1>
            <p className="font-display text-[18px] italic leading-[25px] text-muted">
              Con una me basta para armar tu avatar. No la guardo.
            </p>
          </div>

          {/* Un solo hueco: preview con retículo de encuadre, o el placeholder con
              la invitación de foto grupal (el recorte se resuelve dentro de la app,
              nunca sales a otra pantalla). */}
          <div className="relative aspect-[1/1.06] overflow-hidden rounded-lg border border-line bg-tile">
            {previews.face ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previews.face} alt="Tu foto" className="h-full w-full object-cover" />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-[16%] rounded-sm border-2 border-white/90"
                  style={{ boxShadow: "0 0 0 9999px rgb(20 20 20 / 0.34)" }}
                />
                <button
                  type="button"
                  onClick={() => setCropFaceSrc(previews.face)}
                  className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-3.5 py-3 text-left text-[12.5px] font-medium text-white"
                  style={{ backgroundColor: "rgb(20 20 20 / 0.78)" }}
                >
                  <span>¿sale alguien más? déjate solo a ti</span>
                  <span className="shrink-0 font-bold underline underline-offset-2">ajustar</span>
                </button>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2.5 px-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-muted">
                  <Icon name="camara" size={24} />
                </span>
                <span className="text-sm font-semibold text-ink">tu cara, de frente</span>
                <span className="text-xs leading-snug text-muted">
                  ¿sales con alguien más? súbela igual — recorto tu cara.
                </span>
              </div>
            )}
          </div>

          {/* Dos botones iguales: cámara (frontal en móvil) / carrete. */}
          <div className="grid grid-cols-2 gap-3">
            <PhotoButton label="cámara" icon="camara" capture="user" onPick={(f) => setSlot("face", f)} />
            <PhotoButton label="carrete" onPick={(f) => setSlot("face", f)} />
          </div>

          {/* Las cuatro reglas de la foto ideal, en dos columnas sobre hairline. */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-4">
            {["luz de día", "de frente", "sin lentes ni gorra", "sin filtros"].map((r) => (
              <span key={r} className="flex items-center gap-1.5 text-xs text-muted">
                <Icon name="check" size={14} className="shrink-0 text-success" />
                {r}
              </span>
            ))}
          </div>

          {/* Segundo ángulo: SOLO después de la primera foto, y como link (nunca
              un segundo hueco vacío esperando ser llenado). */}
          {previews.face ? (
            <PickLink
              label={
                previews.face2
                  ? "otro ángulo añadido — cambiar"
                  : "+ sumar otro ángulo — opcional, afina el parecido"
              }
              onPick={(f) => setSlot("face2", f)}
            />
          ) : null}

          <button
            type="button"
            disabled={!canContinue}
            onClick={() => generateFace()}
            className="flex min-h-[54px] items-center justify-center gap-2 rounded-sm bg-accent px-5 text-[15px] font-bold text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:bg-accent-soft disabled:text-faint"
          >
            <Icon name="destello" size={16} />
            ver mi retrato
          </button>
          {skipHref ? (
            <Link
              href={skipHref}
              className="flex min-h-11 items-center justify-center rounded-sm text-sm font-medium text-muted transition-colors duration-200 hover:text-ink"
            >
              ahora no, seguir sin avatar
            </Link>
          ) : null}
        </div>
      )}

      {step === "cara" && faceGen && (
        <div className="mt-2 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-h1 font-semibold text-ink">¿Te reconoces?</h1>
            <p className="font-display text-[18px] italic leading-[25px] text-muted">
              Primero clavamos tu cara — el cuerpo se arma sobre este retrato.
            </p>
          </div>

          {/* Retrato 4/5, ancho completo del contenido. */}
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg border border-line bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${faceGen}`}
              alt="Tu retrato generado"
              className="h-full w-full object-cover"
            />
          </div>

          {/* Juez de parecido, VISIBLE (decisión de Roberto: sí genera valor). */}
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

          {/* Camino feliz: siempre manda. */}
          <button
            type="button"
            onClick={() => setStep("cuerpo")}
            className="flex min-h-[54px] items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors duration-200 hover:bg-accent-deep"
          >
            <Icon name="check" size={16} />
            sí, soy yo — sigamos
          </button>

          {/* Correcciones COLAPSADAS tras "algo no cuadra": no compiten con el
              camino feliz. Al abrir, los chips (un tap = una corrección) + el texto
              libre + la salida a cambiar la foto. */}
          <div className="border-t border-line">
            <button
              type="button"
              onClick={() => setAjustesOpen((o) => !o)}
              aria-expanded={ajustesOpen}
              className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-[13px] font-semibold text-muted transition-colors hover:text-ink"
            >
              algo no cuadra
              <Icon
                name="chevron"
                size={16}
                className={`transition-transform duration-200 ${ajustesOpen ? "rotate-90" : ""}`}
              />
            </button>
            {ajustesOpen ? (
              <div className="flex flex-col gap-3 pb-1 pt-1">
                <div className="flex flex-wrap gap-1.5">
                  {[...AJUSTES_BASE, ...(gender === "hombre" ? AJUSTES_HOMBRE : [])].map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => generateFace(a)}
                      className="flex min-h-9 items-center rounded-sm border border-line bg-surface px-2.5 text-xs font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-on-accent"
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
                    corregir
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setStep("fotos")}
                  className="self-center text-xs font-semibold text-muted underline decoration-line underline-offset-2 transition-colors hover:text-ink"
                >
                  mejor cambio la foto
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {step === "cuerpo" && (
        <div className="mt-2 flex flex-col gap-5">
          {metodo === "foto" ? (
            // MÉTODO POR FOTO (sigue disponible, ya no como pantalla-bifurcación).
            <>
              <div className="flex flex-col gap-1">
                <h1 className="text-h1 font-semibold text-ink">Súbeme tu cuerpo</h1>
                <p className="font-display text-[18px] italic leading-[25px] text-muted">
                  De pie y de frente. Con una basta; más ángulos, más fiel.
                </p>
              </div>
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

                {/* Complexión deducida de la foto: corregible, nunca a ciegas. */}
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
            </>
          ) : (
            // MÉTODO SILUETA (default): la retícula 3×2 ES la pantalla.
            <>
              <div className="flex flex-col gap-1">
                <h1 className="text-h1 font-semibold text-ink">Tu silueta</h1>
                <p className="font-display text-[18px] italic leading-[25px] text-muted">
                  {siluetaBuild
                    ? `Ya tenías ${buildLabel(siluetaBuild)} — cámbiala si quieres.`
                    : "Elige la que más se te parezca — para que la ropa te quede fiel."}
                </p>
              </div>
              {/* Retícula: mismo fondo (bg-tile) en todas; selección = borde 2px
                  ink + surface. Los renders del producto van dentro sin cambiar. */}
              <div className="grid grid-cols-3 gap-2">
                {builds(gender).map((b) => {
                  const selected = build === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBuild(b.id)}
                      aria-pressed={selected}
                      className={`flex flex-col items-center gap-1.5 rounded-lg p-2 transition-colors ${
                        selected
                          ? "border-2 border-ink bg-surface"
                          : "border border-line bg-tile hover:border-ink"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.img} alt="" className="aspect-[3/4] w-full object-contain" />
                      <span
                        className={`text-center text-[12.5px] font-medium leading-tight ${
                          selected ? "text-ink" : "text-muted"
                        }`}
                      >
                        {b.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Estatura en una fila (no en tarjeta): aplica a los dos caminos. */}
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-ink">¿cuánto mides?</span>
              <span className="text-xs text-muted">opcional — afina las proporciones</span>
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
                className="min-h-11 w-[70px] rounded-sm border border-line bg-bg px-2 text-center text-sm text-ink placeholder:text-faint focus:border-ink focus:outline-none"
              />
              <span className="text-xs text-muted">cm</span>
            </span>
          </div>

          <button
            type="button"
            disabled={!puedeGenerar}
            onClick={generateBody}
            className="flex min-h-[54px] items-center justify-center gap-2 rounded-sm bg-accent px-5 text-[15px] font-bold text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:bg-accent-soft disabled:text-faint"
          >
            <Icon name="destello" size={16} />
            generar mi avatar
          </button>

          {/* La bifurcación, ahora como link (no como pantalla): sin costar un paso. */}
          {metodo === "foto" ? (
            <button
              type="button"
              onClick={() => setMetodo("referencia")}
              className="self-center text-[13px] font-semibold text-muted transition-colors hover:text-ink"
            >
              mejor elijo una silueta
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMetodo("foto")}
              className="self-center text-[13px] font-semibold text-muted underline decoration-line underline-offset-2 transition-colors hover:text-ink"
            >
              prefiero subir una foto de cuerpo
            </button>
          )}
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
        <div className="mt-2 flex flex-1 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-h1 font-semibold text-ink">¿Quedó?</h1>
            {/* Explica PARA QUÉ sirve (no repite las opciones que ya están abajo). */}
            <p className="font-display text-[18px] italic leading-[25px] text-muted">
              Este es tu avatar. Sobre él te voy a probar cada look.
            </p>
          </div>

          {/* Una sola vista: el cuerpo completo de frente, centrado en el aire
              libre. La imagen se ACOTA al espacio (max-h/max-w) y el borde va
              pegado a ella — nada de una caja blanca fija que deja un vacío debajo
              cuando la imagen no la llena. La tira de 3 vistas se fue; el sheet
              multi-ángulo se sigue generando en silencio (lo usa el try-on). */}
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${generated}`}
              alt="Tu avatar generado, cuerpo completo de frente"
              className="max-h-full max-w-full rounded-lg border border-line object-contain"
            />
          </div>

          {/* Footer: una acción primaria; las dos salidas en fila partida de links
              (mismo peso), con hairline superior y divisor central. */}
          <div className="flex flex-col gap-1 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={confirm}
              className="flex min-h-[54px] items-center justify-center gap-2 rounded-sm bg-accent text-[15px] font-bold text-on-accent transition-colors duration-200 hover:bg-accent-deep disabled:bg-accent-soft disabled:text-faint"
            >
              {saving ? "Guardando…" : "quedó, usar este"}
            </button>
            <div className="flex items-stretch border-t border-line">
              <button
                type="button"
                disabled={saving}
                onClick={generateBody}
                className="flex min-h-12 flex-1 items-center justify-center gap-1.5 text-[13px] font-semibold text-muted transition-colors hover:text-ink disabled:opacity-50"
              >
                <Icon name="repetir" size={14} /> rehacer el cuerpo
              </button>
              <span className="w-px shrink-0 bg-line" aria-hidden />
              <button
                type="button"
                disabled={saving}
                onClick={() => setStep("cara")}
                className="flex min-h-12 flex-1 items-center justify-center text-[13px] font-semibold text-muted transition-colors hover:text-ink disabled:opacity-50"
              >
                ajustar la cara
              </button>
            </div>
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
      {/* Recorte de la foto de cara (mismo ImageCrop del carrete de prendas):
          aislarte si en la foto sale más de una persona. */}
      {cropFaceSrc ? (
        <ImageCrop
          src={cropFaceSrc}
          title="recorta tu cara — déjate solo a ti"
          onCancel={() => setCropFaceSrc(null)}
          onDone={async (dataUrl) => {
            setCropFaceSrc(null);
            setSlot("face", await dataUrlToFile(dataUrl, "cara-recortada.jpg"));
          }}
        />
      ) : null}
    </div>
  );
}

// Enlace discreto para elegir del carrete (sin `capture`, o sea SÍ abre la
// galería) — el secundario del "tómate una foto" cámara-primero.
function PickLink({
  label,
  onPick,
}: {
  label: string;
  onPick: (file: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="text-[13px] font-medium text-muted underline decoration-line underline-offset-2 hover:text-ink"
      >
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (ref.current) ref.current.value = "";
          onPick(f);
        }}
      />
    </>
  );
}

// Botón de captura (cámara o carrete) para el "hueco único" de la pantalla 1.
// Los dos van iguales debajo del hueco; el de cámara abre la frontal en móvil.
function PhotoButton({
  label,
  icon,
  capture,
  onPick,
}: {
  label: string;
  icon?: "camara";
  capture?: "user" | "environment";
  onPick: (file: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="flex min-h-[50px] items-center justify-center gap-2 rounded-sm border border-line bg-surface text-sm font-semibold text-ink transition-colors hover:border-ink"
      >
        {icon ? <Icon name={icon} size={17} /> : null}
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*,.heic,.heif"
        capture={capture}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (ref.current) ref.current.value = "";
          onPick(f);
        }}
      />
    </>
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
  capture,
}: {
  label: string;
  hint: string;
  preview: string | null;
  onPick: (file: File | null) => void;
  variant?: "card" | "sutil";
  /** "user" → en móvil abre la cámara frontal directo (selfie), sin galería. */
  capture?: "user" | "environment";
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
        capture={capture}
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

// Header de navegación compartido: back de 36px + barra de 3 segmentos + "paso N
// de 3" (o "listo"). Uno solo en las cuatro pantallas — se acabaron los "← back"
// distintos por pantalla. Presentacional: el back lo decide quien lo renderiza.
function ProgressHeader({
  paso,
  onBack,
}: {
  paso: 1 | 2 | 3 | "listo";
  onBack: () => void;
}) {
  const activos = paso === "listo" ? 3 : paso;
  return (
    <div className="flex min-h-11 items-center gap-3 pb-4">
      <button
        type="button"
        onClick={onBack}
        aria-label="atrás"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-accent-soft"
      >
        <Icon name="flecha" size={18} className="rotate-180" />
      </button>
      <div className="flex flex-1 gap-1.5">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-[3px] flex-1 rounded-full ${i <= activos ? "bg-ink" : "bg-line"}`}
          />
        ))}
      </div>
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.1em] tabular-nums text-muted">
        {paso === "listo" ? "listo" : `paso ${paso} de 3`}
      </span>
    </div>
  );
}
