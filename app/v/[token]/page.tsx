import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { leerInvitacion, tokenValido, vistaPreviaDeInvitacion, yaPaso } from "@/lib/viaje-invitacion";
import { imagenDestino } from "@/lib/destino-imagen";
import { diaEnZona } from "@/lib/admin/adquisicion";
import { OCCASIONS, textoDeClima } from "@/lib/trip";

// LA PÁGINA DEL LINK DE INVITACIÓN (2026-10-16). Pública: la abre quien
// recibió el link por WhatsApp, con o sin cuenta. Enseña algo concreto ANTES
// de pedir nada (la ruta, las noches y el clima de cada parada) y un solo
// botón. Lo que se lee aquí sale de `viaje_por_invitacion` (migración 0176):
// nunca la maleta, los looks, el texto libre ni quién invitó — quien manda el
// link ya dice quién es en su propio mensaje.

export const dynamic = "force-dynamic";

// La vista previa en WhatsApp: con el destino y las fechas. Sin esto heredaba
// la de la landing y no decía que era un viaje (QA 2026-10-16).
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = tokenValido(token) ? await supabase.rpc("viaje_por_invitacion", { p_token: token }) : { data: null };
  const { titulo, descripcion } = vistaPreviaDeInvitacion(leerInvitacion(data));
  return {
    title: titulo,
    description: descripcion,
    // La imagen se declara a mano: un `openGraph` propio deja de heredar la del
    // layout, y sin imagen WhatsApp enseña la vista previa vacía.
    openGraph: {
      title: titulo,
      description: descripcion,
      url: `/v/${token}`,
      type: "website",
      siteName: "stailist",
      locale: "es_MX",
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "stailist" }],
    },
  };
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const dm = (d: string) => `${Number(d.slice(8, 10))} ${MESES[Number(d.slice(5, 7)) - 1]}`;

export default async function InvitacionViaje({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = tokenValido(token) ? await supabase.rpc("viaje_por_invitacion", { p_token: token }) : { data: null };
  const viaje = leerInvitacion(data);
  const hoy = diaEnZona(new Date());

  if (!viaje || yaPaso(viaje, hoy)) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 bg-bg px-6 text-ink">
        <span className="text-[20px] font-bold tracking-[-0.045em]">
          st<i className="font-display font-normal italic tracking-normal">ai</i>list
        </span>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.03em]">
          {viaje ? "este viaje ya pasó." : "esta invitación ya no existe."}
        </h1>
        <p className="text-[15px] leading-snug text-muted">igual puedes armar tus looks con la ropa que ya tienes.</p>
        <Link href="/" className="flex min-h-[50px] items-center justify-center rounded-sm bg-accent text-[15px] font-semibold text-on-accent">
          conocer stailist
        </Link>
      </main>
    );
  }

  const noches = viaje.paradas.reduce((s, p) => s + p.noches, 0);
  const actos = OCCASIONS.filter((o) => viaje.ocasiones.includes(o.value));
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg text-ink">
      <div className="relative h-[34dvh] min-h-56 overflow-hidden bg-tile">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imagenDestino(viaje.paradas[0]?.lugar ?? viaje.lugar, viaje.ocasiones)} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent" />
        <span className="absolute left-5 top-5 text-[20px] font-bold tracking-[-0.045em] text-white">
          st<i className="font-display font-normal italic tracking-normal">ai</i>list
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-4 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
          {dm(viaje.fechaInicio)} – {dm(viaje.fechaFin)} · {noches} {noches === 1 ? "noche" : "noches"}
        </span>
        <h1 className="text-[30px] font-bold leading-[1.05] tracking-[-0.03em]">
          te invitaron a este <em className="font-display font-normal italic">viaje</em>
        </h1>
        <div className="flex flex-col rounded-md border border-line bg-surface">
          {viaje.paradas.map((p, i) => (
            <div key={i} className={`flex items-center justify-between px-4 py-3 text-[14.5px] ${i > 0 ? "border-t border-line" : ""}`}>
              <span>
                {p.lugar.split(",")[0]} · {p.noches} {p.noches === 1 ? "noche" : "noches"}
              </span>
              {p.weather ? (
                <span className="text-muted">
                  {textoDeClima(p.weather)}
                  {p.weather.condition && !p.weather.estimated ? ` ${p.weather.condition}` : ""}
                </span>
              ) : null}
            </div>
          ))}
        </div>
        {actos.length > 0 ? (
          <p className="text-[13.5px] text-muted">van a: {actos.map((o) => o.label.toLowerCase()).join(" · ")}</p>
        ) : null}
        <div className="flex-1" />
        {/* POST, no un link: entrar crea una sesión (ver entrar/route.ts) y un
            GET que crea cuentas lo dispara la vista previa del chat. */}
        <form action={`/v/${token}/entrar`} method="post">
          <button type="submit" className="flex min-h-[52px] w-full items-center justify-center rounded-sm bg-accent text-[15px] font-semibold text-on-accent">
            armar mi maleta
          </button>
        </form>
        <p className="text-center text-[12.5px] text-muted">gratis · con tu propia ropa · nadie ve tu maleta</p>
      </div>
    </main>
  );
}
