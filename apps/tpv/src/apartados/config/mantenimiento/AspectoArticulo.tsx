import { useRef, useState } from "react";
import { Camera, Trash2, Ban } from "lucide-react";
import { Modal, BarraVentana } from "../../../ui";
import { NOMBRES_ICONOS, ICONOS } from "../../../lib/iconos";
import { fotoReducida } from "../../../lib/imagen";
import { galeriaProductos } from "../../../lib/galeria";
import { GaleriaImagenes } from "./GaleriaImagenes";
import { BotonProducto } from "../../tpv/venta/BotonProducto";

// ────────────────────────────────────────────────────────────────────────────
// ASPECTO EN EL TPV — foto, color e icono del botón del artículo.
//
// Va en su propia ventana, como «Parámetros del artículo»: son tres decisiones
// visuales que se toman de una vez y que no tienen por qué ocupar sitio en la
// ficha el resto del tiempo. Lo que sí se queda en la ficha es la MUESTRA.
//
// La muestra usa `BotonProducto`, el mismo componente que pinta la botonera de
// venta. No es un dibujo parecido: es el botón.
// ────────────────────────────────────────────────────────────────────────────

// Paleta de la botonera (los mismos tonos oscuros que aguantan texto blanco).
// Colores claros a propósito NO: el texto del tile es blanco y desaparecerían.
const PALETA = [
  "#2f7fd0", "#1f6fb2", "#2ea06a", "#1d7d52", "#c0553f", "#a13b2a",
  "#7c3d9b", "#5b3a8e", "#b8801f", "#8a6014", "#3b414d", "#22262e",
];

export function AspectoArticulo({
  nombre, precio, colorFamilia, foto, color, icono, onCambiar, onCerrar,
}: Readonly<{
  nombre: string;
  precio: number;
  /** El color que se usa cuando el artículo no tiene el suyo. */
  colorFamilia: string;
  foto?: string;
  color?: string;
  icono?: string;
  onCambiar: (campo: "foto" | "color" | "icono", valor: string | undefined) => void;
  onCerrar: () => void;
}>) {
  const fichero = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const elegirFoto = async (f: File | undefined) => {
    if (!f) return;
    setError("");
    try {
      onCambiar("foto", await fotoReducida(f));
    } catch {
      // Un HEIC del iPhone o un fichero corrupto: lo dice y no rompe la ficha.
      setError("No he podido leer esa imagen. Prueba con un JPG o un PNG.");
    }
  };

  return (
    <Modal onCerrar={onCerrar} ancho="xl" className="overflow-hidden">
      <BarraVentana titulo="Aspecto en el TPV" onCerrar={onCerrar} />

      <div className="flex h-[68vh] gap-4 p-4">
        {/* ── Controles (izquierda): muestra, foto propia, color e icono ── */}
        <div className="no-scrollbar flex w-56 flex-none flex-col gap-3 overflow-y-auto">
          <div>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">Así se verá</p>
            <div className="rounded-[6px] border border-line bg-background p-2.5">
              <BotonProducto comoPrevia nombre={nombre || "Sin nombre"} precio={precio}
                color={color ?? colorFamilia} foto={foto} icono={icono} />
            </div>
          </div>

          <input ref={fichero} type="file" accept="image/*" className="hidden"
            onChange={(e) => { void elegirFoto(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" onClick={() => fichero.current?.click()}
            className="flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-mint/40 bg-mint/10 px-3 text-[12.5px] font-semibold text-mint transition-transform active:scale-[.98]">
            <Camera size={15} /> {foto ? "Cambiar foto" : "Subir una propia"}
          </button>
          {foto && (
            <button type="button" onClick={() => onCambiar("foto", undefined)}
              className="flex min-h-9 items-center justify-center gap-2 rounded-[5px] border border-line px-3 text-[12px] font-medium text-muted transition-transform active:scale-[.98]">
              <Trash2 size={14} /> Quitar foto
            </button>
          )}
          {error && <p className="text-[12px] font-medium leading-snug text-rose">{error}</p>}

          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Color del botón</p>
            <div className="flex flex-wrap gap-1.5">
              {/* Heredar va la PRIMERA: cambiar el color de la familia arrastra a sus artículos. */}
              <button type="button" onClick={() => onCambiar("color", undefined)}
                className={`flex min-h-9 w-full items-center gap-2 rounded-[5px] border px-3 text-[12px] font-semibold transition-transform active:scale-95 ${
                  color === undefined ? "border-brand-lit bg-accent-soft text-brand-lit" : "border-line text-paper/70"
                }`}>
                <span className="h-4 w-4 rounded-[3px]" style={{ background: colorFamilia }} />
                El de su familia
              </button>
              {PALETA.map((c) => (
                <button key={c} type="button" onClick={() => onCambiar("color", c)}
                  aria-label={`Color ${c}`} aria-pressed={color === c}
                  className={`h-9 w-9 rounded-[5px] border-2 transition-transform active:scale-90 ${
                    color === c ? "border-paper" : "border-transparent"
                  }`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Icono {foto && <span className="normal-case text-muted/80">— tapado por la foto</span>}
            </p>
            <div className={`flex flex-wrap gap-1.5 ${foto ? "opacity-40" : ""}`}>
              <button type="button" onClick={() => onCambiar("icono", undefined)}
                aria-label="Sin icono" aria-pressed={!icono}
                className={`grid h-9 w-9 place-items-center rounded-[5px] border transition-transform active:scale-90 ${
                  icono ? "border-line text-muted" : "border-brand-lit bg-accent-soft text-brand-lit"
                }`}>
                <Ban size={16} />
              </button>
              {NOMBRES_ICONOS.map((n) => {
                const Icono = ICONOS[n]!;
                const on = icono === n;
                return (
                  <button key={n} type="button" onClick={() => onCambiar("icono", n)}
                    aria-label={n} aria-pressed={on}
                    className={`grid h-9 w-9 place-items-center rounded-[5px] border transition-transform active:scale-90 ${
                      on ? "border-brand-lit bg-accent-soft text-brand-lit" : "border-line text-paper/70"
                    }`}>
                    <Icono size={17} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Galería (derecha): elegir una de las fotos que trae la app ── */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          <p className="flex-none text-[11px] font-medium uppercase tracking-wide text-muted">Elegir una foto de la galería</p>
          <GaleriaImagenes fotos={galeriaProductos} actual={foto} onElegir={(ref) => onCambiar("foto", ref)} />
        </div>
      </div>

      <div className="flex justify-end border-t border-line bg-panel-2 px-4 py-3">
        <button type="button" onClick={onCerrar}
          className="min-h-11 rounded-[5px] bg-brand px-6 text-[13px] font-semibold text-white transition-transform active:scale-95">
          Listo
        </button>
      </div>
    </Modal>
  );
}
