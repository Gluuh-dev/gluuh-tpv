import { Hammer } from "lucide-react";

// Cuerpo "en construcción" compartido: mientras un apartado no está diseñado,
// dice HONESTAMENTE que se hará aquí (nada de contenido fingido). Cada apartado
// lo sustituye por su contenido real cuando se construye.
export function EnObras({ titulo }: Readonly<{ titulo: string }>) {
  return (
    <div className="grid flex-1 place-items-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-paper/5 text-muted"><Hammer size={28} /></span>
        <p className="font-display text-lg font-semibold text-paper/80">«{titulo}» se diseña aquí</p>
        <p className="max-w-md text-sm text-muted">
          El marco y la navegación ya están. El contenido de esta sección se construye en
          las siguientes tandas, moviendo la operativa desde el TPV actual sin big-bang.
        </p>
      </div>
    </div>
  );
}
