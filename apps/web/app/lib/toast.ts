// Notificaciones de la app con Sileo (https://sileo.aaryan.design/): pastilla
// que se expande con física de muelles — el aspecto elegido para el producto.
// Mantiene la API de sonner (toast.success("mensaje")) para no tocar los
// ~150 puntos de llamada; el montaje vive en components/app-toaster.tsx.
import { sileo, type SileoOptions } from "sileo";

type Extra = Pick<SileoOptions, "description" | "duration" | "button">;

const lanzar =
  (fn: (o: SileoOptions) => string) =>
  (mensaje: string, extra?: Extra) =>
    fn({ title: mensaje, ...extra });

// Invocable a pelo (toast("mensaje")) como sonner, con los métodos colgados.
export const toast = Object.assign(lanzar(sileo.show), {
  success: lanzar(sileo.success),
  error: lanzar(sileo.error),
  warning: lanzar(sileo.warning),
  info: lanzar(sileo.info),
  /** Con botón de acción: toast.accion("Guardado", { title: "Deshacer", onClick }). */
  accion: (mensaje: string, button: { title: string; onClick: () => void }, extra?: Extra) =>
    sileo.action({ title: mensaje, button, ...extra }),
  dismiss: sileo.dismiss,
});
