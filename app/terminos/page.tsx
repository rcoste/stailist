import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

// LOS TÉRMINOS, CORTOS. Lo que hace falta decir para que usar stailist tenga
// reglas claras — sin veinte páginas que nadie lee. Página pública (proxy.ts).
// Va de la mano del aviso de privacidad: ahí está todo lo de datos.

export const metadata: Metadata = {
  title: "términos de uso — stailist",
  description: "Las reglas para usar stailist, en corto.",
};

const ACTUALIZADO = "6 de septiembre de 2026";

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
        .
      </P>

      <H2>qué es stailist</H2>
      <P>
        Un stylist personal con inteligencia artificial: te arma looks con la
        ropa que ya tienes, según tus gustos, tus colores y el clima. Es una
        recomendación, no una orden — tú decides qué te pones. Los looks pueden
        fallar, y los dibujos y el avatar son aproximaciones, no fotos reales.
      </P>

      <H2>tu cuenta</H2>
      <P>
        Entras con tu correo y un código; no hay contraseña. Tu cuenta es tuya
        y no se comparte. Si tienes entre 13 y 17 años necesitas el permiso de
        tu tutor para subir fotos (ver el aviso de privacidad); con menos de 13
        no puedes usar la app.
      </P>

      <H2>lo que subes</H2>
      <P>
        Sube solo fotos tuyas o de tu ropa, o de alguien que te haya dado
        permiso. Lo que subes sigue siendo tuyo; nos das permiso para procesarlo
        con los servicios que la app usa (están en el aviso de privacidad) con
        el único fin de darte el servicio. Puedes borrarlo cuando quieras.
      </P>

      <H2>uso razonable</H2>
      <P>
        Cada cuenta tiene un tope diario de looks, pruebas de ropa, avatares y
        fotos analizadas. Está muy por encima de lo que una persona usa en un
        día; existe para que nadie pueda gastar el servicio con un programa. Si
        lo tocas, la app te lo dice y al día siguiente sigues.
      </P>
      <P>
        No uses stailist para nada ilegal, para hacerle daño a alguien, ni para
        intentar saltarte las protecciones. Podemos cerrar una cuenta que lo
        haga.
      </P>

      <H2>la app cambia</H2>
      <P>
        stailist está en construcción y se actualiza seguido. Funciones pueden
        cambiar o desaparecer. Si un cambio te afecta de verdad, te lo decimos
        en la app.
      </P>

      <H2>hasta dónde respondemos</H2>
      <P>
        Hacemos stailist con cuidado, pero se ofrece tal cual: no garantizamos
        que esté disponible siempre ni que cada look sea perfecto. No respondemos
        por decisiones que tomes con base en una recomendación de la app.
      </P>

      <H2>borrar tu cuenta</H2>
      <P>
        Cuando quieras, desde <b>Perfil › cuenta</b>. Se borra todo y no hay
        vuelta atrás.
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
