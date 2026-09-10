import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

// LOS TÉRMINOS, CORTOS. Lo que hace falta decir para que usar stailist tenga
// reglas claras — sin veinte páginas que nadie lee. Página pública (proxy.ts).
// Va de la mano del aviso de privacidad: ahí está todo lo de datos.
//
// 2026-09-10: Roberto pidió dejarlos "suficientemente robustos para estar
// cubierto". Se agregó lo que faltaba de verdad (precio, qué NO es una
// recomendación de la IA, de quién es qué, cambios, responsable) y se corrigió
// la frase que limitaba lo que subes a sólo darte el servicio, que contradecía
// al aviso (también se usa para mejorar la app y para el catálogo). Nada de cláusulas que digan
// "podemos todo": en México una cláusula abusiva no vale y sí espanta.

export const metadata: Metadata = {
  title: "términos de uso — stailist",
  description: "Las reglas para usar stailist, en corto.",
};

const ACTUALIZADO = "10 de septiembre de 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-h2 font-semibold text-ink">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-base leading-relaxed text-ink2">{children}</p>;
}

export default function TerminosPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col gap-6 bg-bg px-5 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <Link href="/" aria-label="Ir al inicio">
          <Logo className="h-7" />
        </Link>
        <Link href="/privacidad" className="text-sm font-medium text-muted hover:text-ink">
          privacidad
        </Link>
      </header>

      <div>
        <h1 className="text-display font-semibold text-ink">términos de uso</h1>
        <p className="mt-2 text-sm text-muted">actualizado el {ACTUALIZADO}</p>
      </div>

      <P>
        Al usar stailist aceptas esto. Es corto a propósito: si algo no queda
        claro, escríbenos a{" "}
        <a href="mailto:hola@stailist.co" className="font-medium text-ink underline">
          hola@stailist.co
        </a>
        . Usar la app es decisión tuya: si no estás de acuerdo, no la uses.
      </P>

      <H2>quién la opera</H2>
      <P>
        stailist la opera <b>FREIGHTNOW SA DE CV</b>, con domicilio en Av.
        Insurgentes Sur 1824, int. 302, col. Florida, C.P. 01030, Ciudad de
        México.
      </P>

      <H2>qué es stailist</H2>
      <P>
        Un stylist personal con inteligencia artificial: te arma looks con la
        ropa que ya tienes, según tus gustos, tus colores y el clima. Es una
        recomendación de estilo, no una orden ni una asesoría profesional — tú
        decides qué te pones. Los looks pueden fallar, el clima puede cambiar, y
        los dibujos de prendas y el avatar son imágenes generadas con IA: son
        aproximaciones, no fotos reales, y no garantizan cómo te va a quedar una
        prenda ni su talla.
      </P>

      <H2>cuánto cuesta</H2>
      <P>
        Hoy stailist es gratis y no te pedimos tarjeta ni ningún método de pago.
        Si algún día agregamos funciones de pago, te avisamos antes, y nunca te
        vamos a cobrar nada que no aceptes ni sin que tú agregues un método de
        pago.
      </P>

      <H2>tu cuenta</H2>
      <P>
        Entras con tu correo y un código; no hay contraseña. Tu cuenta es tuya
        y no se comparte, y eres responsable de lo que se haga desde ella. Si
        tienes entre 13 y 17 años necesitas el permiso de tu tutor para subir
        fotos (ver el aviso de privacidad); con menos de 13 no puedes usar la
        app.
      </P>

      <H2>lo que subes</H2>
      <P>
        Sube solo fotos tuyas o de tu ropa, o de alguien que te haya dado
        permiso. Lo que subes sigue siendo tuyo. Nos das permiso para guardarlo
        y procesarlo con los servicios que la app usa para darte el servicio,
        cuidar la seguridad y mejorar stailist, como explica el aviso de
        privacidad — incluido que el dibujo de una prenda que nos digas que no
        es tuya pueda proponerse para el catálogo. Puedes borrarlo cuando
        quieras; el aviso de privacidad explica qué pasa al borrar.
      </P>

      <H2>lo que es nuestro</H2>
      <P>
        La marca stailist, la app, su diseño, el catálogo de prendas y las
        imágenes que no subiste tú son de quien la opera. Los looks que la app
        te arma son para tu uso personal: compártelos si quieres.
      </P>

      <H2>uso razonable</H2>
      <P>
        Cada cuenta tiene un tope diario de looks, pruebas de ropa, avatares y
        fotos analizadas. Está muy por encima de lo que una persona usa en un
        día; existe para que nadie pueda gastar el servicio con un programa. Si
        lo tocas, la app te lo dice y al rato sigues.
      </P>
      <P>
        No uses stailist para nada ilegal, para hacerle daño a alguien, para
        subir fotos de otras personas sin su permiso, ni para intentar saltarte
        las protecciones o copiar la app. Podemos suspender o cerrar una cuenta
        que lo haga.
      </P>

      <H2>la app cambia</H2>
      <P>
        stailist está en construcción y se actualiza seguido. Funciones pueden
        cambiar o desaparecer, y podemos dejar de ofrecer la app. Si un cambio
        te afecta de verdad, te lo decimos en la app o por correo.
      </P>

      <H2>hasta dónde respondemos</H2>
      <P>
        Hacemos stailist con cuidado, pero se ofrece tal cual: no garantizamos
        que esté disponible siempre ni que cada look sea perfecto. En la medida
        que la ley lo permite, no respondemos por decisiones que tomes con base
        en una recomendación de la app, ni por fallas de los servicios de
        terceros que usa.
      </P>

      <H2>borrar tu cuenta</H2>
      <P>
        Cuando quieras, desde <b>Perfil › cuenta</b>. Se borra de la app todo lo
        tuyo y no hay vuelta atrás; el aviso de privacidad explica lo poco que
        puede quedar fuera de ella.
      </P>

      <H2>cambios a estos términos</H2>
      <P>
        Si los cambiamos, actualizamos la fecha de arriba y, si el cambio es
        importante, te lo decimos. Seguir usando stailist después significa que
        aceptas la versión nueva.
      </P>

      <H2>ley aplicable</H2>
      <P>
        Estos términos se rigen por las leyes de México.
      </P>

      <footer className="mt-10 border-t border-line pt-6 text-sm text-muted">
        <Link href="/" className="font-medium text-ink underline">
          volver a stailist
        </Link>
      </footer>
    </div>
  );
}
