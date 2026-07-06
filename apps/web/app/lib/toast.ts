// Notificaciones de la app con Sileo (https://sileo.aaryan.design/): pastilla
// que se expande con física de muelles — el aspecto elegido para el producto.
// Mantiene la API de sonner (toast.success("mensaje")) para no tocar los
// ~150 puntos de llamada; el montaje vive en components/app-toaster.tsx.
import { sileo, type SileoOptions } from "sileo";

type Extra = Pick<SileoOptions, "description" | "duration" | "button">;

// Notificación con TÍTULO corto y DETALLE en el contenido: si el mensaje trae un
// «Cabecera: detalle…», la cabecera va de título y el resto de descripción; si no,
// el mensaje entero es el título. `extra.description` siempre tiene prioridad.
const lanzar =
  (fn: (o: SileoOptions) => string) =>
  (mensaje: string, extra?: Extra) => {
    const i = mensaje.indexOf(": ");
    const parte = i > 0 && i <= 48;
    return fn({
      title: parte ? mensaje.slice(0, i) : mensaje,
      description: extra?.description ?? (parte ? mensaje.slice(i + 2) : undefined),
      duration: extra?.duration,
      button: extra?.button,
    });
  };

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
