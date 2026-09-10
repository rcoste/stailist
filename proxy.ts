import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_ORIGEN,
  ORIGEN_MAX_AGE_S,
  decidirOrigen,
  leerOrigen,
  parseOrigen,
  serializarOrigen,
} from "@/lib/origen";

// El "portero" de la app: refresca la sesión en cada request y manda a /login
// a quien no esté autenticado. La lógica fina de onboarding (¿en qué paso vas?)
// vive en lib/auth.ts — aquí solo se decide autenticado vs no.
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() valida el token contra Supabase (no confía en la cookie a ciegas)
  // y de paso lo refresca si ya expiró.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Modo "ver como" (admin viendo la app de otro usuario) es SOLO LECTURA:
  // con la cookie puesta se rechaza toda mutación — los server actions y las
  // APIs de la app viajan como POST. Entrar/salir del modo son GETs
  // (/admin/ver-como/*), así que no necesitan excepción. Esto garantiza que
  // mirar la cuenta de una usuaria jamás le contamina sus datos.
  if (
    request.cookies.get("admin_view_as") &&
    request.method !== "GET" &&
    request.method !== "HEAD"
  ) {
    return NextResponse.json(
      { error: "solo_lectura", message: "Estás en modo 'ver como' (solo lectura). Sal del modo para hacer cambios." },
      { status: 403 }
    );
  }

  const { pathname } = request.nextUrl;

  // DE DÓNDE LLEGÓ (lib/origen.ts). Se evalúa en cada visita (qué visita gana lo
  // decide decidirOrigen) y aquí porque es el único punto que ve la URL del
  // anuncio antes de cualquier redirección;
  // /onboarding/genero la copia al perfil. Cookie de primera parte y httpOnly:
  // la lee el servidor, no hace falta que la vea el JavaScript de nadie.
  const origen =
    request.method === "GET" && !pathname.startsWith("/api")
      ? decidirOrigen(
          parseOrigen(request.cookies.get(COOKIE_ORIGEN)?.value),
          leerOrigen(request.nextUrl, request.headers.get("referer"), new Date())
        )
      : null;
  const conOrigen = (res: NextResponse) => {
    if (origen) {
      res.cookies.set(COOKIE_ORIGEN, serializarOrigen(origen), {
        path: "/",
        maxAge: ORIGEN_MAX_AGE_S,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }
    return res;
  };
  // La raíz "/" es pública: muestra la landing a deslogueados (la propia page
  // redirige a la app si SÍ hay sesión). Login/auth también públicos.
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    // Cron (auth por CRON_SECRET) y baja de correo (auth por token) llegan SIN
    // sesión — no deben redirigir a /login.
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/email/baja") ||
    // Permiso parental (menores): el tutor llega desde su correo, sin cuenta.
    pathname.startsWith("/api/permiso") ||
    // Legales: se leen sin cuenta (y antes de crearla).
    pathname === "/privacidad" ||
    pathname === "/terminos" ||
    // Lo que leen los buscadores y los previews de links (B5). Sin esto, el
    // proxy los mandaba a /login y WhatsApp mostraba el login como imagen.
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    // El resumen para asistentes de IA (app/llms.txt/route.ts): sin esto el
    // proxy lo mandaba a /login, igual que le pasaba antes a robots.txt.
    pathname === "/llms.txt" ||
    pathname.startsWith("/opengraph-image") ||
    // La versión desplegada: un número, nada más — el mismo que ya va horneado
    // en el JavaScript que cualquiera puede leer. Pedirle sesión lo volvería
    // inútil justo donde más sirve (la pantalla de entrar), y además el aviso
    // de "hay versión nueva" leería el HTML del login como si fuera JSON.
    pathname === "/api/version";

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return conOrigen(NextResponse.redirect(url));
  }

  if (user && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return conOrigen(NextResponse.redirect(url));
  }

  return conOrigen(response);
}

export const config = {
  // Todo menos estáticos: el portero no necesita revisar imágenes ni íconos.
  // sw.js y manifest.webmanifest van EXCLUIDOS: el navegador los pide sin
  // sesión (incluso en /login), y si el proxy los redirige a /login el service
  // worker no registra ("script behind a redirect") y la PWA no es instalable.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff2?)$).*)",
  ],
};
