// Cosechador de Instagram — se pega en la consola de la pestaña del perfil.
//
// POR QUÉ VIVE COMO ARCHIVO Y NO SUELTO EN EL NAVEGADOR
// Se re-escribía a mano en cada cuenta y cada vez salía distinto: una versión
// olvidó el fallback del id, otra saltaba los carruseles. Aquí queda una sola
// versión, revisable en el repo como cualquier otro código.
//
// CÓMO VIAJA LA IMAGEN
// Con Pinterest basta el hash: la URL de i.pinimg se deriva de él y curl la
// baja. Instagram firma cada URL de su CDN con el token de sesión de quien
// mira, así que esas URLs son credenciales y no deben salir del navegador — el
// entorno las bloquea, y hace bien. Y descargar desde la página tampoco sirve:
// Chrome bloquea las descargas programáticas en lote.
//
// Así que la foto se baja y se recomprime DENTRO de la página, con la sesión ya
// activa, y sale por el portapapeles como píxeles. Lo que cruza es la imagen,
// nunca la credencial. Del otro lado la recoge scripts/pegar-cosecha-ig.mjs.
//
// OJO con el portapapeles: Chrome revoca el permiso de escritura tras muchos
// usos seguidos en un mismo sitio. Se restablece solo tras un rato; no hay
// forma de forzarlo desde la página (execCommand y el teclado sintético
// tampoco alcanzan el portapapeles del sistema).
//
// Uso en la consola de instagram.com/<cuenta>/ :
//   await ig.cargar()            → cuántas fotos cosechables hay
//   await ig.cargar({portadas:true})  → incluye portadas de reel
//   await ig.lote(0, 6)          → deja 6 en el portapapeles
// y en la terminal, por cada lote:
//   node scripts/pegar-cosecha-ig.mjs <cuenta> <indice>

window.ig = {
  /**
   * @param portadas incluye la portada de los reels. Por defecto NO: casi
   *   siempre llevan el titular del video encima ("THIS IS KILLING YOUR
   *   STYLE"), y una foto con texto no deja leer el outfit. Se activa para
   *   cuentas que solo publican video, donde es eso o nada — el filtro de
   *   cosecha decide después cuáles sobreviven.
   */
  async cargar({ portadas = false } = {}) {
    // El id sale del HTML de la página. El endpoint web_profile_info devuelve
    // 400 en algunas cuentas por un fallo interno de Instagram que no tiene que
    // ver con el usuario, así que no se depende de él.
    const m = document.documentElement.innerHTML.match(
      /"profile_id":"(\d+)"|"user_id":"(\d+)"|"owner":\{"id":"(\d+)"/
    );
    const uid = m && (m[1] || m[2] || m[3]);
    if (!uid) return { error: "no encontré el id del perfil" };

    const f = await fetch(`/api/v1/feed/user/${uid}/?count=50`, {
      headers: { "x-ig-app-id": "936619743392459" },
    }).then((r) => r.json());

    this.urls = [];
    let saltados = 0;
    for (const it of f.items ?? []) {
      // Los carruseles importan: una cuenta que en el grid solo enseña portadas
      // con texto suele traer adentro las láminas limpias del mismo look.
      for (const md of it.carousel_media ?? [it]) {
        if (md.video_versions && !portadas) {
          saltados++;
          continue;
        }
        const c = md.image_versions2?.candidates?.[0];
        // Vertical y con altura suficiente: una referencia de outfit necesita el
        // cuerpo, y lo cuadrado del grid viene recortado.
        if (c && c.height >= 900 && c.width / c.height <= 0.9) this.urls.push(c.url);
      }
    }
    return { cosechables: this.urls.length, videosSaltados: saltados };
  },

  async lote(desde, n) {
    const partes = [];
    for (const u of this.urls.slice(desde, desde + n)) {
      try {
        const bmp = await createImageBitmap(await fetch(u).then((r) => r.blob()));
        // ~1000px de alto: suficiente para juzgar corte y caída, y hace que
        // quepan varias fotos en un portapapeles sin reventarlo.
        const esc = Math.min(1, 1000 / bmp.height);
        const cv = document.createElement("canvas");
        cv.width = Math.round(bmp.width * esc);
        cv.height = Math.round(bmp.height * esc);
        cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
        partes.push(cv.toDataURL("image/jpeg", 0.78).split(",")[1]);
      } catch {
        // Una foto que falla no tumba el lote; se nota en el conteo de vuelta.
      }
    }
    await navigator.clipboard.writeText(partes.join("\n@@@\n"));
    return partes.length;
  },
};
