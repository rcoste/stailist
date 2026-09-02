import Link from "next/link";
import { Logo } from "@/components/logo";

// EL 404 EN ESPAÑOL.
//
// Hasta 2026-09-01 una ruta inexistente mostraba el 404 de fábrica de Next:
// "404 · This page could not be found.", en inglés, sin logo y sin salida. La
// primera pantalla rota que ve una desconocida no puede estar en otro idioma.
//
// Nada de disculpas largas: se dice qué pasó en una línea y se le da la puerta.
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center justify-center gap-8 bg-bg px-6 text-center">
      <Logo className="h-8" />
      <div className="flex flex-col gap-3">
        <h1 className="text-display font-semibold text-ink">
          Esta página no existe.
        </h1>
        <p className="text-base text-muted">
          O se movió de lugar. Te regreso a donde están tus looks.
        </p>
      </div>
      <Link
        href="/hoy"
        className="flex min-h-12 items-center justify-center rounded-sm bg-accent px-8 text-base font-bold text-on-accent transition-colors duration-200 hover:bg-accent-deep"
      >
        ir a mis looks
      </Link>
    </div>
  );
}
