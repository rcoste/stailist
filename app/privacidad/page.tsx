import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

// EL AVISO DE PRIVACIDAD.
//
// Hasta el 2026-09-06 el único link que decía "Aviso de privacidad" apuntaba a
// "#". Para una beta de 27 invitadas pasaba; para registro abierto en México,
// con fotos de cara y cuerpo y un flujo de menores, no.
//
// Está escrito en la voz de la casa y dice lo que la app HACE, no lo que un
// formulario genérico diría. Cada afirmación de aquí tiene que seguir siendo
// cierta: si algo cambia (un modelo nuevo, un proveedor nuevo, otra retención),
// se cambia aquí en el mismo commit. Es una página pública (proxy.ts).
//
// El responsable es la razón social que opera stailist (confirmada por Roberto
// el 2026-09-06); nunca un nombre de persona.

export const metadata: Metadata = {
  title: "aviso de privacidad — stailist",
  description: "Qué datos guarda stailist, para qué, y cómo borrarlos.",
};

const ACTUALIZADO = "6 de septiembre de 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-h2 font-semibold text-ink">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-base leading-relaxed text-ink2">{children}</p>;
}
function Li({ children }: { children: React.ReactNode }) {
  return <li className="text-base leading-relaxed text-ink2">{children}</li>;
}

export default function PrivacidadPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col gap-6 bg-bg px-5 pb-16 pt-8">
      <header className="flex items-center justify-between">
        <Link href="/" aria-label="Ir al inicio">
          <Logo className="h-7" />
        </Link>
        <Link href="/terminos" className="text-sm font-medium text-muted hover:text-ink">
          términos
        </Link>
      </header>

      <div>
        <h1 className="text-display font-semibold text-ink">aviso de privacidad</h1>
        <p className="mt-2 text-sm text-muted">actualizado el {ACTUALIZADO}</p>
      </div>

      <P>
        stailist arma looks con la ropa que ya tienes. Para hacerlo guarda cosas
        tuyas — algunas muy personales, como fotos. Aquí está, sin rodeos, qué
        guardamos, para qué, quién lo ve y cómo lo borras.
      </P>

      <H2>quién es responsable</H2>
      <P>
        <b>FREIGHTNOW SA DE CV</b>, con domicilio en Av. Insurgentes Sur 1824,
        int. 302, col. Florida, C.P. 01030, Ciudad de México, es quien opera
        stailist y responde por tus datos. Para cualquier cosa sobre ellos
        escríbenos a{" "}
        <a href="mailto:hola@stailist.co" className="font-medium text-ink underline">
          hola@stailist.co
        </a>
        .
      </P>

      <H2>qué guardamos</H2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <Li>
          <b>Tu correo.</b> Es tu forma de entrar (te mandamos un código, no hay
          contraseña) y la única forma que tenemos de escribirte.
        </Li>
        <Li>
          <b>Lo que nos cuentas al arrancar:</b> qué ropa usas (mujer u hombre),
          tu rango de edad (nunca la fecha exacta), qué looks te gustan y cuáles
          no, las respuestas del quiz de color, y cómo prefieres que te quede la
          ropa.
        </Li>
        <Li>
          <b>Tu clóset:</b> las prendas que marcas de nuestro catálogo y las que
          subes en foto. De cada foto de ropa sacamos color, tipo, corte y
          material, y podemos generar un dibujo de la prenda.
        </Li>
        <Li>
          <b>Tus fotos, si decides subirlas.</b> Para el avatar te pedimos una
          foto de tu cara y una de cuerpo entero; con ellas generamos una imagen
          tuya para probarte los looks. Para el fit check subes una foto con la
          ropa puesta. Nada de esto es obligatorio: la app funciona sin fotos.
        </Li>
        <Li>
          <b>Lo que haces en la app:</b> los looks que te armamos, tus votos,
          tus favoritos, tus viajes, tu wishlist, y cuándo pasa cada cosa. Lo
          usamos para que el stylist aprenda de ti y para entender qué funciona.
        </Li>
        <Li>
          <b>Tu ubicación aproximada, solo si la das.</b> Sirve para saber el
          clima de tu ciudad. La usamos en el momento y no la guardamos como
          historial.
        </Li>
      </ul>

      <H2>para qué</H2>
      <P>
        Para armarte looks que te queden: con tu ropa, tus gustos, tus colores y
        el clima. Para probártelos en tu avatar. Para escribirte, solo si nos
        dices que sí. Y para mejorar la app mirando qué se usa y qué no.
      </P>
      <P>
        No vendemos tus datos. No los compartimos con anunciantes. No hay
        publicidad.
      </P>

      <H2>quién más los ve</H2>
      <P>
        Para funcionar, la app usa servicios de terceros. Cada uno ve solo lo
        que necesita para su parte:
      </P>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <Li>
          <b>Supabase</b> guarda la base de datos y tus archivos. Tus fotos viven
          en un espacio privado: nadie puede abrirlas sin una sesión tuya, y los
          links que la app genera para mostrártelas caducan en una hora.
        </Li>
        <Li>
          <b>Google (Gemini)</b> y <b>Anthropic (Claude)</b> son los modelos de
          inteligencia artificial que leen tus prendas, arman los looks y generan
          tu avatar y las pruebas de ropa. Les mandamos las fotos y los datos
          necesarios para cada tarea. Usamos sus servicios de pago para
          empresas, cuyos términos establecen que lo que les mandamos no se usa
          para entrenar sus modelos.
        </Li>
        <Li>
          <b>Postmark</b> manda los correos (el código de entrada, el aviso al
          tutor si eres menor, y el correo semanal si lo pediste).
        </Li>
        <Li>
          <b>Vercel</b> aloja la app. <b>Open-Meteo</b> nos da el clima; a ellos
          solo les llegan coordenadas aproximadas, sin nada tuyo.
        </Li>
      </ul>

      <H2>si tienes entre 13 y 17 años</H2>
      <P>
        Puedes usar stailist, pero para subir fotos (de tu cara, tu cuerpo o tu
        ropa) necesitamos el permiso de tu papá, mamá o tutor. Te pedimos su
        correo, le mandamos un link que explica qué guardamos, y hasta que no
        confirme, la app funciona sin fotos. Si tu tutor quiere retirar el
        permiso o borrar tus datos, basta con escribirnos. Si tienes menos de
        13 años, no puedes usar stailist.
      </P>

      <H2>cuánto tiempo</H2>
      <P>
        Mientras tu cuenta exista. Al borrarla se borra todo: tus fotos, tu
        avatar, tus prendas, tus looks, tus viajes, tus votos y tu correo. No
        hay papelera ni copia que se quede.
      </P>

      <H2>tus derechos y cómo borrar todo</H2>
      <P>
        Puedes ver, corregir y borrar tus datos, y oponerte a que los usemos.
        Lo más importante lo haces tú sola desde la app: en{" "}
        <b>Perfil › cuenta</b> hay un botón para borrar tu cuenta entera, y
        desde ahí también decides si quieres correos o no. Para cualquier otra
        cosa — o si prefieres que lo hagamos nosotros — escríbenos a
        hola@stailist.co y lo resolvemos en menos de una semana.
      </P>

      <H2>correos</H2>
      <P>
        Solo te escribimos si nos dices que sí. Los únicos correos que llegan
        sin preguntar son el código para entrar y, si eres menor, el aviso a tu
        tutor. Todo lo demás se activa desde la app y se apaga con un clic en
        el propio correo o en Perfil.
      </P>

      <H2>cambios a este aviso</H2>
      <P>
        Si cambiamos algo que te afecte — un proveedor nuevo, otro uso de tus
        datos — actualizamos la fecha de arriba y te lo decimos en la app antes
        de que entre en vigor.
      </P>

      <footer className="mt-10 border-t border-line pt-6 text-sm text-muted">
        <Link href="/" className="font-medium text-ink underline">
          volver a stailist
        </Link>
      </footer>
    </div>
  );
}
