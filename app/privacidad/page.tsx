import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { InterruptorMedicion } from "@/components/interruptor-medicion";

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
// "ROBUSTO" = EXACTO, NO AMPLIO (2026-09-10). Roberto pidió dejarlo "suficiente-
// mente robusto para estar cubierto". Lo que cubre es que no haya huecos entre
// lo que dice y lo que pasa; una cláusula que dice "podemos hacer cualquier
// cosa" no cubre a nadie. Ese día una revisión cruzó CADA frase con el código y
// cazó frases falsas (el admin sí abre fotos, migración 0070; Open-Meteo recibe
// coordenadas exactas y BigDataCloud no aparecía, lib/weather/index.ts; borrar
// una prenda es borrado suave, lib/delete-actions.ts) y omisiones (IP del
// login, reportes, datos del cuerpo, fotos de referencia, correos de gente sin
// cuenta). app/privacidad/aviso.test.ts vigila que no regresen. Antes de tocar
// datos, releer esto.
//
// El responsable es la razón social que opera stailist (confirmada por Roberto
// el 2026-09-06); nunca un nombre de persona.

export const metadata: Metadata = {
  title: "aviso de privacidad — stailist",
  description: "Qué datos guarda stailist, para qué, quién los ve y cómo borrarlos.",
};

const ACTUALIZADO = "10 de septiembre de 2026";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-h2 font-semibold text-ink">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-base leading-relaxed text-ink2">{children}</p>;
}
function Li({ children }: { children: React.ReactNode }) {
  return <li className="text-base leading-relaxed text-ink2">{children}</li>;
}
function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="mt-3 list-disc space-y-2 pl-5">{children}</ul>;
}
function Enlace({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="font-medium text-ink underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
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
      <Ul>
        <Li>
          <b>Tu correo.</b> Es tu forma de entrar (te mandamos un código, no hay
          contraseña) y la única forma que tenemos de escribirte.
        </Li>
        <Li>
          <b>Cuando pides el código para entrar:</b> tu correo y la dirección IP
          desde la que lo pides, para frenar a quien intente abusar del
          formulario. Se borran en uno o dos días.
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
          selfie y una foto de cuerpo entero; con ellas generamos una imagen tuya
          para probarte los looks, y la IA lee la de cuerpo entero para calcular
          tu complexión, que guardamos junto con tu estatura si nos la das. Para
          el fit check subes una foto con la ropa puesta, y en tu estilo puedes
          subir fotos de looks que te inspiran. Nada de esto es obligatorio: la
          app funciona sin fotos.
        </Li>
        <Li>
          <b>Lo que haces en la app:</b> los looks que te armamos, tus votos,
          tus favoritos, tus viajes, tu wishlist, y cuándo pasa cada cosa. Lo
          usamos para que el stylist aprenda de ti y para entender qué funciona.
        </Li>
        <Li>
          <b>Registros del uso de la inteligencia artificial:</b> qué función se
          usó, cuánto tardó y cuánto costó, para vigilar fallas y gastos. En
          algunas funciones, como el clóset cápsula, guardamos también la
          instrucción que se le mandó a la IA y su explicación, para revisar que
          esté funcionando bien.
        </Li>
        <Li>
          <b>Si nos reportas un problema:</b> lo que escribes, la pantalla en la
          que estabas, la versión de la app, lo último que hiciste en ella y las
          fallas recientes de la IA en tu cuenta. Nos llega también por correo,
          con tu dirección, para poder contestarte.
        </Li>
        <Li>
          <b>Tu ubicación, solo si la compartes.</b> Sirve para saber el clima y
          el nombre de tu ciudad. La usamos en el momento y no la guardamos como
          historial.
        </Li>
        <Li>
          <b>Por dónde llegaste.</b> Si entraste desde un anuncio o un link con
          etiquetas de campaña, guardamos esas etiquetas (qué campaña, qué
          anuncio, el identificador del clic), la primera página de stailist que
          abriste y el sitio del que venías, sin su página exacta. Sirve para
          saber qué anuncios traen a gente a la que stailist le sirve de verdad,
          y se borra con tu cuenta.
        </Li>
        <Li>
          <b>Si alguien te invitó o te anotaste en la lista de espera</b>,
          guardamos tu correo aunque todavía no tengas cuenta. Si quieres que lo
          borremos, escríbenos.
        </Li>
      </Ul>

      <H2>para qué</H2>
      <P>
        Para armarte looks que te queden: con tu ropa, tus gustos, tus colores y
        el clima. Para probártelos en tu avatar. Para escribirte, solo si nos
        dices que sí. Para darte soporte, cuidar la seguridad de la app y evitar
        abusos. Y para mejorar stailist mirando qué se usa y qué no.
      </P>
      <P>
        <b>Para entrenar y mejorar nuestra inteligencia artificial</b>, y solo si
        no te opones: usamos los datos y los dibujos de tus prendas, tus looks,
        tus votos y cómo usas la app — sin tu nombre ni tu correo — para
        entrenar y mejorar los modelos de stailist y el catálogo compartido.
        Nunca usamos para eso ninguna de tus fotos ni los datos de menores de
        edad. Esto no hace falta para darte el servicio: si no quieres, escríbenos
        a hola@stailist.co y lo dejamos de hacer con lo tuyo, sin que cambie nada
        de la app.
      </P>
      <P>
        No vendemos tus datos y dentro de la app no hay anuncios. Lo que sí
        hacemos es anunciar stailist en Google y en TikTok, y para saber si esos
        anuncios funcionan usamos sus etiquetas de medición. Más abajo te
        contamos exactamente qué ven y cómo apagarlas.
      </P>

      <H2>quién más los ve</H2>
      <Ul>
        <Li>
          <b>El equipo de stailist.</b> Las personas que operamos la app podemos
          ver los datos de las cuentas, fotos incluidas, cuando hace falta para
          darte soporte, atender un problema que reportaste, cuidar la seguridad
          o mejorar la app. Tus fotos no son públicas: fuera de ti, de ese equipo
          y de los servicios de inteligencia artificial que las procesan, nadie
          puede abrirlas, y los links con los que la app te las muestra caducan
          en una hora o menos.
        </Li>
        <Li>
          <b>Supabase</b> guarda la base de datos y tus archivos.
        </Li>
        <Li>
          <b>Google (Gemini)</b> y <b>Anthropic (Claude)</b> son los modelos de
          inteligencia artificial que leen tus prendas, arman los looks y generan
          tu avatar y las pruebas de ropa. Les mandamos las fotos y los datos
          necesarios para cada tarea. Lo que hagan con esos datos, incluido si
          los usan para mejorar sus propios modelos, se rige por sus términos.
        </Li>
        <Li>
          <b>Postmark</b> manda los correos: el código de entrada, el aviso al
          tutor si eres menor, las invitaciones, el correo semanal y el de “te
          extrañamos” si están activos para ti, y los reportes y alertas que nos
          llegan a nosotros.
        </Li>
        <Li>
          <b>Open-Meteo</b> nos da el clima y <b>BigDataCloud</b> le pone nombre
          a tu ciudad. Si compartes tu ubicación, tu navegador les manda tus
          coordenadas (a BigDataCloud, redondeadas a como 1 km) y, como pasa con
          cualquier sitio, tu dirección IP. Si escribes una ciudad, a Open-Meteo
          le llega lo que escribes. No les mandamos tu correo ni nada de tu
          cuenta.
        </Li>
        <Li>
          <b>Vercel</b> aloja la app y, como cualquier servidor, ve tu dirección
          IP.
        </Li>
        <Li>
          <b>Google (Google Ads y Google Analytics)</b> y <b>TikTok</b> miden
          nuestros anuncios, como te explicamos aquí abajo.
        </Li>
        <Li>
          <b>Autoridades</b>, solo si una ley o una orden nos obliga.
        </Li>
      </Ul>
      <P>
        Cada servicio ve solo lo que necesita para su parte, y varios de ellos
        guardan o procesan datos fuera de México, por ejemplo en Estados Unidos.
        Si algún día stailist pasa a manos de otra empresa (una venta o una
        fusión), tus datos pasarían con ella y seguirían protegidos por este
        aviso; te lo diríamos antes.
      </P>

      <H2>el catálogo de prendas</H2>
      <P>
        Cuando la IA dibuja una prenda a partir de tu foto y nos dices que no es
        tuya, ese dibujo — nunca tu foto — puede quedar en revisión para el
        catálogo de prendas de stailist. Solo entraría si lo aprobamos, y ya en
        el catálogo no llevaría nada que te identifique. Si borras tu cuenta
        antes, se borra con ella.
      </P>

      <H2>anuncios y etiquetas de medición</H2>
      <P>
        En la página de inicio y en dos pantallas del arranque — justo antes de
        tus primeros looks y cuando llegan — cargamos etiquetas de Google y de
        TikTok: pedacitos de código suyos que guardan cookies en tu navegador.
      </P>
      <Ul>
        <Li>
          <b>Qué ven:</b> que visitaste esas páginas, desde qué anuncio
          llegaste, datos técnicos de tu navegador y tu dispositivo (incluida tu
          dirección IP), y dos momentos: cuando empiezas a usar stailist y
          cuando llega tu primer look.
        </Li>
        <Li>
          <b>Qué no ven:</b> tu correo, tus fotos, tu ropa, tus looks, lo que
          contestas sobre tus gustos y tus colores, ni nada de lo que haces
          dentro de la app. En esas pantallas no cargan, y cuando entras a la
          app se apagan.
        </Li>
        <Li>
          <b>Si nos dices que tienes entre 13 y 17 años</b>, dejamos de
          cargarlas y no les contamos nada más de ti.
        </Li>
        <Li>
          Lo que Google y TikTok hacen con esa información se rige por sus
          propios avisos:{" "}
          <Enlace href="https://policies.google.com/privacy?hl=es">Google</Enlace> y{" "}
          <Enlace href="https://www.tiktok.com/legal/page/row/privacy-policy/es">TikTok</Enlace>.
        </Li>
      </Ul>
      <P>
        <b>Cómo apagarlas.</b> Si tu navegador manda la señal Global Privacy
        Control, no las cargamos nunca. Siempre puedes borrar o bloquear las
        cookies desde los ajustes de tu navegador. Y puedes apagarlas aquí mismo,
        para este navegador:
      </P>
      <InterruptorMedicion />

      <H2>nuestras cookies</H2>
      <P>
        Además de las de Google y TikTok, la app guarda en tu navegador unas
        pocas cosas suyas:
      </P>
      <Ul>
        <Li>
          <b>Tu sesión</b>, para que no tengas que pedir un código cada vez.
          Dura hasta que cierres sesión (como máximo, unos 13 meses).
        </Li>
        <Li>
          <b>De dónde llegaste</b> (etiquetas de campaña y el sitio anterior),
          hasta 90 días, para poder guardarlo en tu cuenta cuando la abras.
        </Li>
        <Li>
          <b>Un aviso de un solo uso</b> para medir que empezaste a usar
          stailist; se borra en cuanto se lee, o al día.
        </Li>
        <Li>
          <b>Una marca que apaga las etiquetas</b> si una cuenta de 13 a 17
          años se usó en ese navegador; dura un año.
        </Li>
        <Li>
          <b>Preferencias y marcas pequeñas:</b> la versión de la página de
          inicio que elegiste, si apagaste la medición, si ya se midió un
          momento (para no contarlo dos veces) y, hasta que llegas a la pantalla
          de entrar, el correo que escribiste en la página de inicio.
        </Li>
      </Ul>

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
        Mientras tu cuenta exista. Al borrarla se borra de la app todo lo tuyo:
        tus fotos, tu avatar, tus prendas, tus looks, tus viajes, tus votos, tus
        reportes, los registros de uso de la IA y tu correo. Lo único que puede
        quedar fuera de la app es la copia en nuestro correo de los reportes y
        alertas que te mencionen y, si te invitamos, tu correo en la lista de
        invitaciones; si quieres que también lo borremos, escríbenos. Lo que ya
        forme parte del catálogo compartido o de mediciones sin nada que te
        identifique puede quedarse.
      </P>
      <P>
        Ojo: cuando borras una prenda, un look o un viaje sin borrar la cuenta,
        deja de verse, pero lo guardamos hasta que borres la cuenta y lo podemos
        seguir usando como explicamos en “para qué” (nunca sus fotos). Y si pides
        el código pero no pasas del primer paso, esa cuenta a medias se borra
        sola en una semana más o menos.
      </P>

      <H2>cómo los cuidamos</H2>
      <P>
        Tus datos viajan cifrados, las fotos viven en espacios privados y cada
        cuenta solo puede ver lo suyo. Ningún sistema es infalible: si pasa algo
        que afecte tus datos de forma importante, te lo decimos.
      </P>

      <H2>tus derechos y cómo borrar todo</H2>
      <P>
        Puedes ver tus datos, corregirlos, borrarlos u oponerte a que los usemos
        (lo que la ley llama derechos ARCO), y también retirar tu consentimiento
        o pedirnos que limitemos su uso. Lo más importante lo haces tú sola
        desde la app: en <b>Perfil › cuenta</b> hay un botón para borrar tu
        cuenta entera, y desde ahí también decides si quieres correos o no. Para
        cualquier otra cosa — o si prefieres que lo hagamos nosotros —
        escríbenos a hola@stailist.co desde el correo de tu cuenta, dinos qué
        necesitas, y lo resolvemos en menos de una semana.
      </P>

      <H2>correos</H2>
      <P>
        Solo te escribimos si nos dices que sí. Los únicos correos que llegan
        sin preguntar son el código para entrar y, si eres menor, el aviso a tu
        tutor. Todo lo demás se activa desde la app y se apaga con un clic en
        el propio correo o en Perfil.
      </P>

      <H2>tu consentimiento</H2>
      <P>
        Al crear tu cuenta y usar stailist aceptas este aviso. Usarla es
        decisión tuya: si no estás de acuerdo con algo, no la uses, o borra tu
        cuenta cuando quieras.
      </P>

      <H2>cambios a este aviso</H2>
      <P>
        Si cambiamos algo que te afecte — un proveedor nuevo, otro uso de tus
        datos — actualizamos la fecha de arriba y, si el cambio es importante,
        te lo decimos en la app o por correo.
      </P>

      <footer className="mt-10 border-t border-line pt-6 text-sm text-muted">
        <Link href="/" className="font-medium text-ink underline">
          volver a stailist
        </Link>
      </footer>
    </div>
  );
}
