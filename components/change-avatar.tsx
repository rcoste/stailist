import Link from "next/link";

// Acceso al wizard de avatar desde el Perfil. Si ya hay avatar, es una
// invitación opcional a mejorarlo (siempre disponible, ignorable); si no, a
// crearlo. La subida real vive en el wizard (/perfil/avatar).
export function ChangeAvatar({ hasAvatar }: { hasAvatar: boolean }) {
  return (
    <Link
      href="/perfil/avatar"
      className="flex min-h-10 items-center justify-center self-start rounded-sm border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors duration-200 hover:border-ink"
    >
      {hasAvatar ? "Mejorar mi avatar" : "Crear mi avatar"}
    </Link>
  );
}
