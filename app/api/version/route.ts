import { readFileSync } from "node:fs";
import { NextResponse } from "next/server";

// QUÉ VERSIÓN TIENE EL SERVIDOR AHORA MISMO.
//
// Su único cliente compara esto con la versión horneada en SU bundle. Si no
// coinciden, el JavaScript que está corriendo el navegador es de antes del
// último despliegue — que es exactamente lo que costó dos investigaciones el
// 2026-08-08: un arreglo desplegado y probado desde un teléfono que seguía
// sirviendo el código anterior.
//
// SIN AUTENTICACIÓN a propósito: es un número de versión público, lo mismo que
// ya va horneado en el JavaScript que cualquiera puede leer. Pedirle sesión lo
// volvería inútil justo cuando más sirve (la pantalla de entrar).
export const dynamic = "force-dynamic";

// Se lee UNA vez por instancia: el archivo no cambia sin un despliegue nuevo, y
// un despliegue nuevo es un proceso nuevo.
const VERSION = (() => {
  try {
    return readFileSync("VERSION", "utf8").trim();
  } catch {
    // El bundle del servidor puede no llevar el archivo. La versión horneada en
    // build sirve igual: viene del mismo despliegue.
    return process.env.NEXT_PUBLIC_APP_VERSION ?? "desconocida";
  }
})();

export function GET() {
  return NextResponse.json(
    { version: VERSION },
    // Sin caché en ningún lado: una respuesta guardada diría "estás al día"
    // para siempre, que es peor que no tener esto.
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
