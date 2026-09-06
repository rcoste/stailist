import { Spinner } from "@/components/spinner";

// El clóset firma una URL por prenda antes de pintar: con 40+ prendas la espera
// se nota. Misma señal quieta que el home (ver app/hoy/loading.tsx).
export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg text-muted">
      <Spinner className="h-6 w-6" />
    </div>
  );
}
