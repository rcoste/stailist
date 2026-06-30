"use client";
/* eslint-disable @next/next/no-img-element */
// Landing pública (deslogueados) — v3 "Gen-Z monocromo". Toggle Mujer/Hombre:
// las imágenes de hombre viven en public/landing/h/ con los mismos nombres; el
// helper img() escoge la carpeta según el género. Set completo para ambos géneros
// (hero, pasos, paso 4, galería, sección 04, cápsula, viaje). Modelo de hombre M-1
// = el modelo consistente de public/looks/*-hombre.
import { useEffect, useState } from "react";
import { WaitlistForm } from "./waitlist-form";
import { TryDemo } from "./try-demo";
import styles from "./landing.module.css";

// Isotipo "gancho-destello": percha que se vuelve destello. Color por
// currentColor (= var(--c-accent) vía la clase .iso); cero hex aquí.
function Isotipo({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d="M26 8l.9 2.5 2.5.9-2.5.9L26 14.8l-.9-2.5-2.5-.9 2.5-.9z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M24 17c0-.9-.3-1.7-.9-2.3" />
      <path d="M24 17 7 30.5a1.4 1.4 0 0 0 .9 2.5h32.2a1.4 1.4 0 0 0 .9-2.5L24 17z" />
    </svg>
  );
}

function Wordmark() {
  return (
    <span className={styles.wm}>
      st<em className={styles.s}>ai</em>list
    </span>
  );
}

export function Landing() {
  const [gender, setGender] = useState<"mujer" | "hombre">("mujer");
  useEffect(() => {
    // Lectura única de la preferencia guardada al montar (no es cascada real).
    const g = localStorage.getItem("landing-gender");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (g === "hombre" || g === "mujer") setGender(g);
  }, []);
  const choose = (g: "mujer" | "hombre") => {
    setGender(g);
    localStorage.setItem("landing-gender", g);
  };
  const men = gender === "hombre";
  // Imágenes gender-aware: hombre → /landing/h/<name>.png (Fase 1: solo los names
  // con set de hombre — hero, prop, gal-*; el resto vive en secciones ocultas).
  const img = (n: string) => (men ? `/landing/h/${n}.png` : `/landing/${n}.png`);

  // Look "wow" del hero (ejemplo real), por género. La foto puesta vive en
  // hero-worn y las 4 prendas en hero-p1..p4 (ambas gender-aware vía img()).
  const heroLook = men
    ? {
        name: "Saco, pero ",
        em: "sin esfuerzo",
        why: "El saco sobre playera sube el look. Jeans oscuros y loafers café lo aterrizan.",
        pieces: ["Saco azul marino", "Playera gris", "Jeans", "Loafers café"],
      }
    : {
        name: "Print, ",
        em: "con cabeza",
        why: "El animal print manda, pero oliva y cafés lo aterrizan: atrevido sin gritar.",
        pieces: ["Cardigan animal print", "Jeans oliva", "Botas", "Bolsa"],
      };

  return (
    <div className={styles.page}>
      {/* Toggle Mujer/Hombre: el contenido se adapta al género. */}
      <div className={styles.genderToggle}>
        <div aria-label="Ver contenido para">
          <button type="button" aria-pressed={!men} onClick={() => choose("mujer")}>
            mujer
          </button>
          <button type="button" aria-pressed={men} onClick={() => choose("hombre")}>
            hombre
          </button>
        </div>
      </div>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={`${styles.wrap} ${styles.hrow}`}>
          <a className={styles.brand} href="#top" aria-label="stailist inicio">
            <Isotipo className={styles.iso} />
            <Wordmark />
          </a>
          <div className={styles.headerRight}>
            <a className={styles.hlogin} href="/login">
              Entrar
            </a>
            <a className={styles.hcta} href="#sumarme">
              Armar mi look
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* HERO */}
        <section className={styles.hero}>
          <div className={`${styles.wrap} ${styles.heroGrid}`}>
            <div>
              <div className={styles.eyebrow}>Tu estilista personal con IA</div>
              <h1 className={styles.h1}>
                Tu clóset está lleno. Y aun así, no sabes qué{" "}
                <em className={styles.s}>ponerte</em>.
              </h1>
              <p className={styles.sub}>
                Te armo outfits con la ropa que <b>ya tienes</b> — tu primer
                look en <b>menos de 2 minutos</b>. Sin subir tu clóset, sin
                complicarte.
              </p>

              <div id="sumarme">
                <WaitlistForm source="landing-hero" trust />
              </div>
            </div>

            {/* DEMO OUTFIT */}
            <div className={styles.demo} aria-label="Ejemplo de outfit">
              <div className={styles.demoTop}>
                <span className={styles.lbl}>Un ejemplo real</span>
                <span className={styles.pill}>tu lunes, resuelto</span>
              </div>
              <div className={styles.demoStage}>
                <div className={styles.demoShot}>
                  <img src={img("hero-worn")} alt="El outfit puesto" />
                </div>
                <div className={styles.demoCol}>
                  <div className={styles.tiles}>
                    <div className={styles.tile}>
                      <span className={styles.tnum}>01</span>
                      <img src={img("hero-p1")} alt={heroLook.pieces[0]} />
                    </div>
                    <div className={styles.tile}>
                      <span className={styles.tnum}>02</span>
                      <img src={img("hero-p2")} alt={heroLook.pieces[1]} />
                    </div>
                    <div className={styles.tile}>
                      <span className={styles.tnum}>03</span>
                      <img src={img("hero-p3")} alt={heroLook.pieces[2]} />
                    </div>
                    <div className={styles.tile}>
                      <span className={styles.tnum}>04</span>
                      <img src={img("hero-p4")} alt={heroLook.pieces[3]} />
                    </div>
                  </div>
                  <div className={styles.demoWhy}>
                    <div className={styles.name}>
                      {heroLook.name}
                      <em>{heroLook.em}</em>
                    </div>
                    <p>{heroLook.why}</p>
                  </div>
                </div>
              </div>
              <div className={styles.demoFoot}>
                <span>Armado en 1 min 50 s · con 4 prendas que ya tenías</span>
              </div>
            </div>
          </div>
        </section>

        {/* 01 · REFRAME */}
        <section className={`${styles.blk} ${styles.reframe}`}>
          <div className={styles.wrap}>
            <div className={styles.kicker}>
              <span className={styles.n}>01</span> El verdadero problema
            </div>
            <h2 className={styles.h2}>
              No es que no tengas ropa. Es que <em className={styles.s}>decidir</em>,
              cada mañana, agota.
            </h2>
            <p className={styles.lead}>
              Las otras apps te piden fotografiar prenda por prenda hasta que te
              rindes. Esta no. Empiezas en segundos y yo hago la parte pesada:
              mirar lo que tienes, pensar qué combina, y dejártelo listo.{" "}
              <b>Tú solo eliges.</b>
            </p>
          </div>
        </section>

        {/* 02 · CÓMO FUNCIONA */}
        <section className={styles.blk}>
          <div className={styles.wrap}>
            <div className={styles.kicker}>
              <span className={styles.n}>02</span> Cómo funciona
            </div>
            <h2 className={styles.h2}>
              De tu clóset a tu outfit, en <em className={styles.s}>minutos</em>.
            </h2>
            <div className={styles.steps}>
              {/* 1 · Quién eres: estilo (likes) + colorimetría */}
              <div className={styles.step}>
                <span className={styles.sn}>1</span>
                <div className={styles.stepText}>
                  <h3>Me dices quién eres.</h3>
                  <p>
                    Unos likes de estilo y un quiz corto de color. Aprendo tu
                    gusto y los tonos que te quedan — de una vez, no te lo vuelvo
                    a preguntar.
                  </p>
                  <span className={styles.once}>Una sola vez · ~90 s</span>
                </div>
                <div className={styles.stepVisual}>
                  <div className={styles.swipes} aria-hidden="true">
                    <div className={styles.swipe}>
                      <img src={img("swipe-si-1")} alt="" />
                      <span className={`${styles.mk} ${styles.y}`}>sí</span>
                    </div>
                    <div className={styles.swipe}>
                      <img src={img("swipe-si-2")} alt="" />
                      <span className={`${styles.mk} ${styles.y}`}>sí</span>
                    </div>
                    <div className={styles.swipe}>
                      <img src={img("swipe-no")} alt="" />
                      <span className={`${styles.mk} ${styles.n}`}>no</span>
                    </div>
                  </div>
                  <div className={styles.palette} aria-hidden="true">
                    <span className={`${styles.sw} ${styles.sw1}`} />
                    <span className={`${styles.sw} ${styles.sw2}`} />
                    <span className={`${styles.sw} ${styles.sw3}`} />
                    <span className={`${styles.sw} ${styles.sw4}`} />
                    <span className={`${styles.sw} ${styles.sw5}`} />
                    <span className={styles.cap}>
                      <b>Tu paleta</b> · los tonos que te encienden la cara
                    </span>
                  </div>
                </div>
              </div>

              {/* 2 · Tu clóset: marcas lo que ya tienes */}
              <div className={styles.step}>
                <span className={styles.sn}>2</span>
                <div className={styles.stepText}>
                  <h3>Marcas lo que ya tienes.</h3>
                  <p>
                    Eliges tus básicos del clóset con un toque — sin fotografiar
                    prenda por prenda. Y si quieres, le tomas una foto a esa
                    prenda especial.
                  </p>
                </div>
                <div className={styles.stepVisual}>
                  <div className={styles.closet} aria-hidden="true">
                    <div className={styles.closetItem}>
                      <img src={img("camiseta-blanca")} alt="" />
                      <span className={styles.closetCheck}>&#10003;</span>
                    </div>
                    <div className={styles.closetItem}>
                      <img src={img("hero-top")} alt="" />
                      <span className={styles.closetCheck}>&#10003;</span>
                    </div>
                    <div className={styles.closetItem}>
                      <img src={img("cap-top")} alt="" />
                    </div>
                    <div className={styles.closetItem}>
                      <img src={img("maleta-flat-1")} alt="" />
                      <span className={styles.closetCheck}>&#10003;</span>
                    </div>
                    <div className={styles.closetItem}>
                      <img src={img("jeans-claros")} alt="" />
                      <span className={styles.closetCheck}>&#10003;</span>
                    </div>
                    <div className={styles.closetItem}>
                      <img src={img("cap-bottom")} alt="" />
                      <span className={styles.closetCheck}>&#10003;</span>
                    </div>
                    <div className={styles.closetItem}>
                      <img src={img("tenis-blancos-urbanos")} alt="" />
                    </div>
                    <div className={styles.closetItem}>
                      <img src={img("cap-shoe")} alt="" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 · Qué necesitas hoy: chips de ocasión */}
              <div className={styles.step}>
                <span className={styles.sn}>3</span>
                <div className={styles.stepText}>
                  <h3>Me dices qué necesitas hoy.</h3>
                  <p>
                    ¿Día normal? ¿Junta? ¿Una cita? Un toque y ya. Lo único que
                    cambia cada día.
                  </p>
                </div>
                <div className={styles.stepVisual}>
                  <div className={styles.chips} aria-hidden="true">
                    <span className={`${styles.chip} ${styles.on}`}>oficina</span>
                    <span className={styles.chip}>de día</span>
                    <span className={styles.chip}>un evento</span>
                    <span className={styles.chip}>una cita</span>
                  </div>
                </div>
              </div>

              {/* 4 · Te armo los looks y te los pruebo */}
              <div className={styles.step}>
                <span className={styles.sn}>4</span>
                <div className={styles.stepText}>
                  <h3>
                    Te armo tus looks — y te los <em>pruebo</em>.
                  </h3>
                  <p>
                    Dos o tres outfits con tu ropa, te explico por qué cada uno
                    funciona, y los ves puestos en ti antes de salir de casa.
                  </p>
                </div>
                <div className={styles.stepVisual}>
                  <div className={styles.stepTry}>
                    <div className={styles.tryCard}>
                      <div className={styles.tryHd}>te propongo</div>
                      <div className={styles.tryMini} aria-hidden="true">
                        <span className={styles.tCell}>
                          <img src={img("prop-tee")} alt="" />
                          <span className={styles.tn}>01</span>
                        </span>
                        <span className={styles.tCell}>
                          <img src={img("prop-jeans")} alt="" />
                          <span className={styles.tn}>02</span>
                        </span>
                        <span className={styles.tCell}>
                          <img src={img("prop-cinturon")} alt="" />
                          <span className={styles.tn}>03</span>
                        </span>
                        <span className={styles.tCell}>
                          <img src={img("prop-flats")} alt="" />
                          <span className={styles.tn}>04</span>
                        </span>
                      </div>
                    </div>
                    <TryDemo gender={gender} />
                  </div>
                </div>
              </div>
            </div>
            <p className={styles.stepsClose}>
              La primera vez, en menos de 2 minutos.
            </p>
          </div>
        </section>

        {/* 03 · POR QUÉ TE QUEDAN */}
        <section className={styles.blk}>
          <div className={styles.wrap}>
            <div className={styles.kicker}>
              <span className={styles.n}>03</span> Por qué te quedan
            </div>
            <h2 className={styles.h2}>
              Ningún outfit es <em className={styles.s}>al azar</em>.
            </h2>
            <p className={styles.lead}>
              No son combinaciones genéricas sacadas de internet. Cada look sale
              de tres cosas que stailist ya sabe de ti — por eso te quedan a{" "}
              <b>ti</b>.
            </p>
            <div className={styles.featList}>
              <div className={styles.fl}>
                <span className={styles.fn}>A</span>
                <div>
                  <h3>Tu gusto.</h3>
                  <p>
                    Los estilos que marcaste con like al arrancar. Me inclino a
                    lo que te late y me alejo de lo que no.
                  </p>
                </div>
              </div>
              <div className={styles.fl}>
                <span className={styles.fn}>B</span>
                <div>
                  <h3>Tu colorimetría.</h3>
                  <p>
                    Los tonos que te encienden la cara — los priorizo cerca del
                    rostro. Sin “eres temporada tal”.
                  </p>
                </div>
              </div>
              <div className={styles.fl}>
                <span className={styles.fn}>C</span>
                <div>
                  <h3>Tu silueta.</h3>
                  <p>
                    Lo que le sienta bien a tu cuerpo: los cortes y proporciones
                    que te favorecen, no los que lucen en un maniquí.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 04 · TRY-ON */}
        <section className={styles.blk}>
          <div className={styles.wrap}>
            <div className={styles.kicker}>
              <span className={styles.n}>04</span> No solo te lo armo
            </div>
            <div className={styles.tryonGrid}>
              <div className={styles.tryonCopy}>
                <h2 className={styles.h2}>
                  Te lo <em className={styles.s}>pruebo</em> antes de que salgas.
                </h2>
                <p className={styles.lead}>
                  No te quedas con la duda de “¿y cómo se me verá?”. Creo tu
                  avatar una vez y le pongo encima las prendas reales de cada
                  outfit — lo ves puesto en ti, no en una modelo.
                </p>
                <div className={styles.tryonNote}>
                  <div>
                    <span className={styles.nbull}>·</span>
                    <p>
                      Tu avatar se arma <b>una sola vez</b>; después vistes
                      cualquier outfit en segundos.
                    </p>
                  </div>
                  <div>
                    <span className={styles.nbull}>·</span>
                    <p>
                      Son <b>tus prendas reales</b>, no parecidos de catálogo.
                    </p>
                  </div>
                </div>
              </div>
              <div className={styles.steps2}>
                <div className={styles.s2col}>
                  <div className={styles.s2head}>
                    <span className={styles.d}>1</span> te propongo
                  </div>
                  <div className={styles.s2card}>
                    <div className={styles.p1top}>
                      <div className={styles.nm}>
                        Limpio y sin <em>esfuerzo</em>
                      </div>
                    </div>
                    <div className={styles.grid2}>
                      <div className={styles.t}>
                        <span className={styles.n}>01</span>
                        <img src={img("clasico-abrigo")} alt="Abrigo" />
                      </div>
                      <div className={styles.t}>
                        <span className={styles.n}>02</span>
                        <img src={img("clasico-pantalon")} alt="Pantalón" />
                      </div>
                      <div className={styles.t}>
                        <span className={styles.n}>03</span>
                        <img src={img("clasico-loafers")} alt="Zapatos" />
                      </div>
                      <div className={`${styles.t} ${styles.meta}`}>
                        <b>Tu día, resuelto</b>
                        <span>3 prendas</span>
                      </div>
                    </div>
                    <div className={styles.p1btn}>
                      Ver cómo me queda &rarr;
                    </div>
                  </div>
                </div>
                <div className={styles.s2col}>
                  <div className={styles.s2head}>
                    <span className={styles.d}>2</span> en ti
                  </div>
                  <div className={`${styles.s2card} ${styles.p2card}`}>
                    <span className={styles.tag}>probado en ti</span>
                    <div className={styles.p2fill}>
                      <img src={img("en-ti-clasico")} alt="El outfit puesto en ti" />
                    </div>
                    <div className={styles.p2foot}>
                      <b>Así te queda</b>
                      <span>tus prendas</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* GALERÍA DE ESTILOS */}
        <section className={styles.blk}>
          <div className={styles.wrap}>
            <h2 className={styles.h2}>
              Los looks que te armo, <em className={styles.s}>puestos en ti</em>.
            </h2>
            <p className={styles.lead}>
              Una probadita: tu ropa y tu estilo, sin que tengas que
              imaginártelo.
            </p>
            <div className={styles.gallery}>
              {[
                "gal-1",
                "gal-6",
                "gal-11",
                "gal-3",
                "gal-9",
                "gal-12",
                "gal-2",
                "gal-14",
                "gal-10",
                "gal-7",
                "gal-13",
                "gal-8",
              ].map((g) => (
                <div key={g} className={styles.galItem}>
                  <img src={img(g)} alt="" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* OBJECIÓN */}
        <section className={styles.blk}>
          <div className={styles.wrap}>
            <div className={styles.obj}>
              <div className={styles.objQ}>
                “¿Tengo que subir <em>foto</em> de cada prenda?”
              </div>
              <p className={styles.objA}>
                <span className={styles.no}>No.</span> Arrancas con unos básicos
                que casi todo el mundo tiene — los marcas con un toque y ya
                tienes con qué empezar. ¿Quieres meter esa chamarra que amas?
                Tómale una foto cuando quieras. <b>Opcional, nunca obligatorio.</b>
              </p>
            </div>
          </div>
        </section>

        {/* 05 · CÁPSULA */}
        <section className={styles.blk}>
          <div className={styles.wrap}>
            <div className={styles.kicker}>
              <span className={styles.n}>05</span> Clóset cápsula
            </div>
            <div className={styles.banner}>
              <div className={styles.bannerCopy}>
                <h2 className={styles.h2}>
                  Menos ropa. Más <em className={styles.s}>outfits</em>.
                </h2>
                <p className={styles.lead}>
                  Una cápsula es un puñado de prendas que combinan entre sí.
                  stailist te ayuda a armar la tuya con lo que ya tienes — y te
                  enseña cuánto rinde de verdad cada pieza.
                </p>
                <ul className={styles.bpoints}>
                  <li>
                    <span className={styles.bk}>01</span>
                    <div>
                      <b>Ves cuánto rinde cada prenda. </b>
                      <span>
                        Esa chamarra que dudabas desbloquea 8 looks; la que nunca
                        usas, casi ninguno.
                      </span>
                    </div>
                  </li>
                  <li>
                    <span className={styles.bk}>02</span>
                    <div>
                      <b>Te dice qué te falta — y qué no. </b>
                      <span>
                        La pieza exacta que cierra más combinaciones, para que
                        compres con cabeza y no por impulso.
                      </span>
                    </div>
                  </li>
                  <li>
                    <span className={styles.bk}>03</span>
                    <div>
                      <b>Nada de prendas huérfanas. </b>
                      <span>
                        Todo lo que entra a tu cápsula combina con el resto. Sin
                        esa blusa que solo va con una cosa.
                      </span>
                    </div>
                  </li>
                </ul>
              </div>
              <div className={styles.bannerMedia}>
                <div className={styles.capsuleVis} aria-hidden="true">
                  <div className={styles.grid}>
                    <div className={styles.cell}>
                      <img src={img("cap-top")} alt="" />
                    </div>
                    <div className={styles.cell}>
                      <img src={img("cap-bottom")} alt="" />
                    </div>
                    <div className={styles.cell}>
                      <img src={img("cap-shoe")} alt="" />
                    </div>
                    <div className={`${styles.cell} ${styles.count}`}>
                      <span className={styles.num}>12</span>
                      <span className={styles.lbl}>outfits</span>
                    </div>
                  </div>
                  <div className={styles.cap}>
                    3 básicos de tu clóset · 12 combinaciones posibles
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 06 · VIAJE */}
        <section className={styles.blk}>
          <div className={styles.wrap}>
            <div className={styles.kicker}>
              <span className={styles.n}>06</span> Modo viaje
            </div>
            <div className={`${styles.banner} ${styles.rev}`}>
              <div className={styles.bannerCopy}>
                <h2 className={styles.h2}>
                  Tu maleta, <em className={styles.s}>resuelta</em>.
                </h2>
                <p className={styles.lead}>
                  Dime a dónde vas y cuántos días. Te armo una cápsula que cabe
                  en carry-on y te la reparto en outfits por día — con el clima
                  real de cada parada.
                </p>
                <ul className={styles.bpoints}>
                  <li>
                    <span className={styles.bk}>01</span>
                    <div>
                      <b>Una cápsula que rinde. </b>
                      <span>
                        Pocas prendas, todos los días cubiertos. Empacas ligero
                        sin repetir el mismo look.
                      </span>
                    </div>
                  </li>
                  <li>
                    <span className={styles.bk}>02</span>
                    <div>
                      <b>Outfits por día, ya combinados. </b>
                      <span>
                        Abres la maleta y ya sabes qué ponerte cada mañana del
                        viaje.
                      </span>
                    </div>
                  </li>
                  <li>
                    <span className={styles.bk}>03</span>
                    <div>
                      <b>Con el clima de cada parada. </b>
                      <span>
                        Varias ciudades, varios climas — lo considera por
                        destino, no a ojo.
                      </span>
                    </div>
                  </li>
                </ul>
              </div>
              <div className={styles.bannerMedia}>
                <div className={styles.caseWrap}>
                  <div className={styles.handle} />
                  <div className={styles.case}>
                    <div className={styles.caseTop}>
                      <span className={styles.l}>1 maleta · carry-on</span>
                      <span className={styles.belt}>
                        <i />
                        <i />
                        <i />
                      </span>
                    </div>
                    <div className={styles.caseGrid}>
                      <div className={styles.pk}>
                        <img src={img("maleta-flat-1")} alt="" />
                      </div>
                      <div className={styles.pk}>
                        <img src={img("maleta-flat-2")} alt="" />
                      </div>
                      <div className={styles.pk}>
                        <img src={img("maleta-flat-3")} alt="" />
                      </div>
                      <div className={styles.pk}>
                        <img className={styles.worn} src={img("maleta-look-1")} alt="" />
                      </div>
                      <div className={styles.pk}>
                        <img className={styles.worn} src={img("maleta-look-2")} alt="" />
                      </div>
                      <div className={`${styles.pk} ${styles.cnt}`}>
                        <span className={styles.num}>6</span>
                        <span className={styles.lbl}>outfits</span>
                      </div>
                    </div>
                    <div className={styles.caseBot}>
                      <span>
                        <b>8 prendas</b> que combinan entre sí
                      </span>
                      <span>rinden 6 looks</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 07 · Y SE QUEDA CONTIGO */}
        <section className={styles.blk}>
          <div className={styles.wrap}>
            <div className={styles.kicker}>
              <span className={styles.n}>07</span> Y se queda contigo
            </div>
            <h2 className={styles.h2}>No es de un solo uso.</h2>
            <div className={`${styles.featList} ${styles.two}`}>
              <div className={styles.fl}>
                <span className={styles.fn}>A</span>
                <div>
                  <h3>Tu look de hoy.</h3>
                  <p>
                    Abres la app y ya te tengo un outfit para tu día —
                    considerando hasta el clima.
                  </p>
                </div>
              </div>
              <div className={styles.fl}>
                <span className={styles.fn}>B</span>
                <div>
                  <h3>Aprendo de ti.</h3>
                  <p>
                    Cada sí y cada no afina lo que te propongo. Mientras más la
                    usas, más le atina.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 08 · PARA QUIÉN */}
        <section className={styles.blk}>
          <div className={styles.wrap}>
            <div className={styles.kicker}>
              <span className={styles.n}>08</span> Para quién es
            </div>
            <h2 className={styles.h2}>
              ¿Te suena <em className={styles.s}>familiar</em>?
            </h2>
            <div className={styles.biglist}>
              <div className={styles.bi}>
                <span className={styles.bn}>01</span>
                <p>
                  Tienes el clóset lleno y aun así{" "}
                  <b>“no tienes qué ponerte”.</b>
                </p>
              </div>
              <div className={styles.bi}>
                <span className={styles.bn}>02</span>
                <p>
                  Compras cosas que luego <b>no sabes con qué combinar.</b>
                </p>
              </div>
              <div className={styles.bi}>
                <span className={styles.bn}>03</span>
                <p>
                  Te estresan los eventos y <b>las mañanas con prisa.</b>
                </p>
              </div>
            </div>
            <p className={styles.closeline}>
              Si dijiste que sí a una sola, esto es para ti.
            </p>
          </div>
        </section>

        {/* 09 · CTA FINAL */}
        <section className={`${styles.blk} ${styles.final}`}>
          <div className={styles.wrap}>
            <div className={styles.inner}>
              <div className={styles.kicker}>
                <span className={styles.n}>09</span> Tu turno
              </div>
              <h2 className={styles.h2}>
                ¿Lista para abrir el clóset sin{" "}
                <em className={styles.s}>pelearte</em> con él?
              </h2>
              <WaitlistForm
                source="landing-cta"
                fineline="Beta privada. Si aún no tienes invitación, te anoto en la lista."
              />
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={`${styles.wrap} ${styles.frow}`}>
          <div className={styles.fbrand}>
            <Isotipo className={styles.iso} />
            <Wordmark />
          </div>
          <p className={styles.fvoice}>Tu amiga cool que se viste increíble.</p>
          <p className={styles.fmeta}>
            © 2026 stailist · <a href="#">Aviso de privacidad</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
