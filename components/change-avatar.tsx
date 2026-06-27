import Link from "next/link";
import { Icon } from "@/components/icon";

// Acceso al wizard de avatar desde el Perfil (hero de la pestaña Cuenta). Si ya
// hay avatar, es una invitación opcional a mejorarlo; si no, a crearlo. Estilo
// linkrow: link de acento con destello, no botón. La subida real vive en el
// wizard (/perfil/avatar).
export function ChangeAvatar({ hasAvatar }: { hasAvatar: boolean }) {
  return (
    <Link
      href="/perfil/avatar"
      className="mt-2 inline-flex items-center gap-1.5 self-start text-xs font-medium text-accent transition-colors duration-200 hover:text-accent-deep"
    >
      <Icon name="destello" size={13} />
      {hasAvatar ? "cambiar mi foto" : "crear mi avatar"}
    </Link>
  );
}
