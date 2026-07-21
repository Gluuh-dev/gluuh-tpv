import { useRef, useState } from "react";
import { Camera, Trash2, Ban } from "lucide-react";
import { Modal, BarraVentana } from "../../../ui";
import { NOMBRES_ICONOS, ICONOS, iconoPorNombre } from "../../../lib/iconos";
import { fotoReducida } from "../../../lib/imagen";
import { PALETA } from "./ClasificacionUI";

// ────────────────────────────────────────────────────────────────────────────
// ASPECTO EN EL TPV — foto, color e icono del botón de una familia o categoría.
//
// La misma ventana que «Aspecto del artículo», con dos diferencias: la muestra
// NO lleva precio (una familia no se cobra) y la familia no tiene icono (no hay
// columna). Lo que se queda en la ficha es la MUESTRA (`PreviaClasificacion`).
// ────────────────────────────────────────────────────────────────────────────

/**
 * El tile tal cual se verá en la botonera: color de fondo, foto a pantalla con
 * su velo, icono (solo sin foto) y el nombre. Sin precio, a diferencia del
 * artículo. Mismo marcado que `BotonProducto` para que la previa no mienta.
 */
export function PreviaClasificacion({ nombre, color, foto, icono }: Readonly<{
  nombre: string; color: string; foto?: string; icono?: string;
}>) {
  const Icono = iconoPorNombre(icono);
  return (
    <div aria-hidden
      className="relative flex min-h-[78px] flex-col justify-end overflow-hidden rounded-[9px] p-2 text-left shadow-[0_2px_0_rgba(0,0,0,.28)]"
      style={{ background: color, color: "#fff" }}>
      {foto && (
        <>
          <img src={foto} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5" />
        </>
      )}
      {Icono && !foto && <Icono size={26} strokeWidth={1.6} className="absolute right-1.5 top-1.5 opacity-30" />}
      <span className="relative text-[11px] font-bold uppercase leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,.45)]">
        {nombre || "Sin nombre"}
      </span>
    </div>
  );
}

export function AspectoClasificacion({
  titulo, nombre, color, foto, icono, conIcono, onCambiar, onCerrar,
}: Readonly<{
  titulo: string;
  nombre: string;
  color: string;
  /** URL o data URL; vacío = sin foto. */
  foto: string;
  /** Nombre de icono; vacío = ninguno. Se ignora si `conIcono` es false. */
  icono: string;
  /** La familia no tiene icono; la categoría sí. */
  conIcono: boolean;
  onCambiar: (campo: "foto" | "color" | "icono", valor: string) => void;
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
      setError("No he podido leer esa imagen. Prueba con un JPG o un PNG.");
    }
  };

  return (
    <Modal onCerrar={onCerrar} ancho="lg" className="overflow-hidden">
      <BarraVentana titulo={titulo} onCerrar={onCerrar} />

      <div className="flex gap-4 p-4">
        {/* ── Muestra ── */}
        <div className="flex w-45 flex-none flex-col gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Así se verá</p>
          <div className="rounded-[6px] border border-line bg-background p-2.5">
            <PreviaClasificacion nombre={nombre} color={color} foto={foto || undefined}
              icono={conIcono ? icono || undefined : undefined} />
          </div>

          <input ref={fichero} type="file" accept="image/*" className="hidden"
            onChange={(e) => { void elegirFoto(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" onClick={() => fichero.current?.click()}
            className="flex min-h-11 items-center justify-center gap-2 rounded-[5px] border border-mint/40 bg-mint/10 px-3 text-[12.5px] font-semibold text-mint transition-transform active:scale-[.98]">
            <Camera size={15} /> {foto ? "Cambiar foto" : "Subir foto"}
          </button>
          {foto && (
            <button type="button" onClick={() => onCambiar("foto", "")}
              className="flex min-h-10 items-center justify-center gap-2 rounded-[5px] border border-line px-3 text-[12.5px] font-medium text-muted transition-transform active:scale-[.98]">
              <Trash2 size={14} /> Quitar foto
            </button>
          )}
          {error && <p className="text-[12px] font-medium leading-snug text-rose">{error}</p>}
        </div>

        {/* ── Color e icono ── */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Color del botón</p>
            <div className="flex flex-wrap gap-2">
              {PALETA.map((c) => (
                <button key={c} type="button" onClick={() => onCambiar("color", c)}
                  aria-label={`Color ${c}`} aria-pressed={color.toLowerCase() === c}
                  className={`h-11 w-11 rounded-[5px] border-2 transition-transform active:scale-90 ${
                    color.toLowerCase() === c ? "border-paper" : "border-transparent"
                  }`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          {conIcono && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                Icono {foto && <span className="normal-case text-muted/80">— tapado por la foto</span>}
              </p>
              <div className={`flex flex-wrap gap-1.5 ${foto ? "opacity-40" : ""}`}>
                <button type="button" onClick={() => onCambiar("icono", "")}
                  aria-label="Sin icono" aria-pressed={!icono}
                  className={`grid h-11 w-11 place-items-center rounded-[5px] border transition-transform active:scale-90 ${
                    icono ? "border-line text-muted" : "border-brand-lit bg-accent-soft text-brand-lit"
                  }`}>
                  <Ban size={17} />
                </button>
                {NOMBRES_ICONOS.map((n) => {
                  const Icono = ICONOS[n]!;
                  const on = icono === n;
                  return (
                    <button key={n} type="button" onClick={() => onCambiar("icono", n)}
                      aria-label={n} aria-pressed={on}
                      className={`grid h-11 w-11 place-items-center rounded-[5px] border transition-transform active:scale-90 ${
                        on ? "border-brand-lit bg-accent-soft text-brand-lit" : "border-line text-paper/70"
                      }`}>
                      <Icono size={19} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
