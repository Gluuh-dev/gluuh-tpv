import { eur } from "../../../lib/dinero";
import { urlFoto } from "../../../lib/galeria";

// EL tile de artículo del TPV. Vive aparte porque lo pintan DOS sitios: la
// botonera de venta y la vista previa de la ficha del artículo. Duplicar el
// marcado era garantizar que la previa acabara mintiendo sobre lo que verá el
// camarero — que es justo lo único que la previa tiene que hacer bien.
export function BotonProducto({
  nombre, precio, color, foto, onClick, comoPrevia = false,
}: Readonly<{
  nombre: string;
  precio: number;
  /** Color propio del artículo; si no tiene, el de su familia. */
  color: string;
  foto?: string | null;
  onClick?: () => void;
  /** En la ficha es una MUESTRA, no un botón: ni se pulsa ni entra al tabulador. */
  comoPrevia?: boolean;
}>) {
  // `foto` puede ser una referencia a la galería (`galeria:…`), una URL subida
  // al nodo o un data URL: `urlFoto` lo resuelve a algo pintable (o nada).
  const src = urlFoto(foto);
  return (
    <button
      type="button" onClick={onClick}
      {...(comoPrevia ? { disabled: true, tabIndex: -1, "aria-hidden": true } : {})}
      className={`relative flex min-h-[78px] flex-col justify-end overflow-hidden rounded-[9px] p-2 text-left shadow-[0_2px_0_rgba(0,0,0,.28)] ${
        comoPrevia ? "w-full disabled:opacity-100" : "transition-transform active:translate-y-px active:scale-[.98]"
      }`}
      style={{ background: color, color: "#fff" }}
    >
      {src && (
        <>
          <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
          {/* Velo: sobre una foto de un plato bien iluminado, el nombre en blanco
              desaparece. El degradado deja la foto arriba y salva el texto abajo. */}
          <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        </>
      )}
      {/* Nombre a la izquierda y PRECIO a la derecha, abajo y SIEMPRE visibles:
          el precio con su propia sombra para que no se pierda sobre una foto. */}
      <div className="relative flex items-end justify-between gap-1.5">
        <span className="line-clamp-2 text-[11px] font-bold uppercase leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,.55)]">{nombre}</span>
        <span className="flex-none text-[13px] font-extrabold tabular-nums [text-shadow:0_1px_3px_rgba(0,0,0,.7)]">{eur(precio)}</span>
      </div>
    </button>
  );
}
