// Validación de formato de correo, compartida por login, el alta de edad
// (correo del tutor) y su picker. Una sola fuente: cliente y server no pueden
// divergir en silencio.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmailValido = (v: string): boolean => EMAIL_RE.test(v.trim());
