/**
 * Traduce los mensajes de error de Supabase Auth a español legible.
 * Se mantiene aquí (fuera de las páginas) para reutilizar en login/registro/admin.
 */
export function traducirErrorAuth(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "Email o contraseña incorrectos.";
  if (/email not confirmed/i.test(msg)) return "La cuenta no está confirmada todavía.";
  if (/rate limit/i.test(msg)) return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  if (/user already registered/i.test(msg)) return "Ese email ya tiene cuenta.";
  if (/password should be at least/i.test(msg)) return "La contraseña es demasiado corta.";
  if (/network|fetch|failed to fetch/i.test(msg)) return "No se pudo conectar con el servidor. Revisa tu conexión.";
  return msg;
}
