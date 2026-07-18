import { logoSrc, MARCA_DEFECTO, type Marca as TMarca } from "../lib/branding";
import { useTema } from "../lib/tema";

// Logo de marca: por defecto el de Gluuh según el tema (claro → color, oscuro →
// monocolor blanco); cuando el cliente suba el suyo, sale el del cliente en ambos.
// ÚNICO sitio donde se pinta el logo, para que el cambio del dueño se refleje en
// toda la app de una vez.
export function Marca({
  marca = MARCA_DEFECTO,
  className,
  alt = "Logo",
}: Readonly<{ marca?: TMarca; className?: string; alt?: string }>) {
  const { oscuro } = useTema();
  return <img src={logoSrc(marca, oscuro)} alt={alt} className={className} draggable={false} />;
}
