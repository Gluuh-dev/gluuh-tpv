import { Plus, X, Layers, LayoutGrid, Package, Info } from "lucide-react";
import { Desplazable } from "../../../ui";
import { eur } from "../../../lib/dinero";
import { Caja, claseEntrada, Selector } from "./Marco";
import type { GrupoEfectivo, GrupoModificador, Origen, TipoGrupo } from "./modificadores";

// ────────────────────────────────────────────────────────────────────────────
// EXTRAS Y COMENTARIOS de un artículo.
//
// Lo importante de esta pantalla no es la lista: es que se VEA DE DÓNDE VIENE
// cada grupo. «Punto de la carne» no se pone artículo por artículo — se dice una
// vez en la familia y todas las hamburguesas lo heredan. Si la ficha no lo
// contase, el dueño lo borraría aquí pensando que solo afecta a este artículo, o
// lo repetiría veinte veces sin saber que ya lo tenía.
//
// Un grupo HEREDADO no se edita aquí (se cambia donde vive, en la biblioteca);
// lo único que se puede hacer es QUITÁRSELO a este artículo.
// ────────────────────────────────────────────────────────────────────────────

const ORIGEN: Record<Origen, { texto: string; Icono: typeof Layers; clase: string }> = {
  propio: { texto: "Solo de este artículo", Icono: Package, clase: "border-line bg-panel-2 text-muted" },
  familia: { texto: "De su familia", Icono: Layers, clase: "border-brand-lit/40 bg-accent-soft text-brand-lit" },
  categoria: { texto: "De una categoría", Icono: LayoutGrid, clase: "border-brand-lit/40 bg-accent-soft text-brand-lit" },
  articulo: { texto: "Añadido a este artículo", Icono: Package, clase: "border-mint/40 bg-mint/10 text-mint" },
};

function Chapa({ origen }: Readonly<{ origen: Origen }>) {
  const o = ORIGEN[origen];
  return (
    <span className={`flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${o.clase}`}>
      <o.Icono size={12} /> {o.texto}
    </span>
  );
}

export function ExtrasArticulo({
  grupos, soloLectura, onCambiar, onQuitarHeredado, onNuevo,
}: Readonly<{
  grupos: readonly GrupoEfectivo[];
  soloLectura: boolean;
  /** Cambia un grupo PROPIO (los heredados no se tocan desde aquí). */
  onCambiar: (id: string, cambio: (g: GrupoModificador) => GrupoModificador) => void;
  /** Quitar: borra el propio, o excluye el heredado de este artículo. */
  onQuitarHeredado: (g: GrupoEfectivo) => void;
  onNuevo: (tipo: TipoGrupo) => void;
}>) {
  const ro = soloLectura;

  return (
    <>
      <p className="flex flex-none items-center gap-2.5 rounded-[6px] border border-brand-lit/25 bg-accent-soft px-3.5 py-3 text-[13px] font-semibold leading-snug text-brand-lit">
        <Info size={18} className="flex-none" />
        Esto es lo que verá el camarero al vender. Lo que viene de la familia o de
        una categoría se cambia allí: aquí solo puedes quitárselo a este artículo.
      </p>

      <Caja crecer titulo="Extras y comentarios" contador={`${grupos.length} grupos`}
        acciones={!ro && (
          <>
            <button type="button" onClick={() => onNuevo("COMENTARIO")}
              className="flex min-h-8 items-center gap-1.5 rounded-[5px] border border-line bg-panel px-2.5 text-[12px] font-semibold text-paper/85 transition-transform active:scale-95">
              <Plus size={14} strokeWidth={3} /> Comentario
            </button>
            <button type="button" onClick={() => onNuevo("EXTRA")}
              className="flex min-h-8 items-center gap-1.5 rounded-[5px] bg-mint px-2.5 text-[12px] font-semibold text-white transition-transform active:scale-95">
              <Plus size={14} strokeWidth={3} /> Extra
            </button>
          </>
        )}>
        <Desplazable className="flex flex-col gap-2 p-2.5">
          {grupos.map((g) => {
            // Solo se edita lo que es de este artículo. Lo heredado se ve y se
            // puede quitar, pero cambiarlo aquí tocaría a todos sus hermanos.
            const editable = !ro && g.origen === "propio";
            return (
              <section key={g.id} className="rounded-[6px] border border-line bg-panel-2">
                <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
                  {editable ? (
                    <input value={g.nombre} aria-label="Nombre del grupo"
                      onChange={(e) => onCambiar(g.id, (x) => ({ ...x, nombre: e.target.value }))}
                      className={claseEntrada(false, "w-52", true)} />
                  ) : (
                    <b className="text-[13.5px] font-bold">{g.nombre}</b>
                  )}

                  <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    g.tipo === "EXTRA" ? "bg-cobro/15 text-cobro" : "bg-paper/8 text-muted"
                  }`}>
                    {g.tipo === "EXTRA" ? "Suma al ticket" : "Solo a cocina"}
                  </span>

                  <Chapa origen={g.origen} />

                  {editable && (
                    <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
                      Elegir
                      <Selector id={`min-${g.id}`} value={String(g.min)} extra="w-16"
                        onChange={(v) => onCambiar(g.id, (x) => ({ ...x, min: Number(v) }))}>
                        <option value="0">0</option><option value="1">1</option>
                      </Selector>
                      a
                      <Selector id={`max-${g.id}`} value={String(g.max)} extra="w-16"
                        onChange={(v) => onCambiar(g.id, (x) => ({ ...x, max: Number(v) }))}>
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                      </Selector>
                    </span>
                  )}

                  {!ro && (
                    <button type="button" onClick={() => onQuitarHeredado(g)}
                      aria-label={g.origen === "propio" ? `Borrar ${g.nombre}` : `Quitar ${g.nombre} de este artículo`}
                      className="ml-auto flex min-h-8 flex-none items-center gap-1.5 rounded-[5px] border border-line px-2.5 text-[12px] font-medium text-muted transition-transform active:scale-95 hover:text-danger">
                      <X size={14} strokeWidth={2.6} />
                      {g.origen === "propio" ? "Borrar" : "Quitar de este artículo"}
                    </button>
                  )}
                </header>

                <div className="flex flex-wrap gap-1.5 p-2.5">
                  {g.opciones.map((o) => (
                    <span key={o.id} className="flex items-center gap-2 rounded-[5px] border border-line bg-panel px-2.5 py-1.5">
                      {editable ? (
                        <input value={o.nombre} aria-label="Opción"
                          onChange={(e) => onCambiar(g.id, (x) => ({
                            ...x, opciones: x.opciones.map((y) => (y.id === o.id ? { ...y, nombre: e.target.value } : y)),
                          }))}
                          className={claseEntrada(false, "w-32", true)} />
                      ) : (
                        <span className="text-[13px] font-medium">{o.nombre}</span>
                      )}
                      {g.tipo === "EXTRA" && (editable ? (
                        <input type="number" step="0.05" min="0" value={o.precioExtra} aria-label="Precio del extra"
                          onChange={(e) => onCambiar(g.id, (x) => ({
                            ...x, opciones: x.opciones.map((y) => (y.id === o.id ? { ...y, precioExtra: Number(e.target.value) } : y)),
                          }))}
                          className={claseEntrada(false, "w-20 text-right font-mono", true)} />
                      ) : (
                        <span className={`font-mono text-[12.5px] font-bold ${o.precioExtra > 0 ? "text-cobro" : "text-mint"}`}>
                          {o.precioExtra > 0 ? eur(o.precioExtra) : "Gratis"}
                        </span>
                      ))}
                      {editable && (
                        <button type="button" aria-label={`Quitar ${o.nombre}`}
                          onClick={() => onCambiar(g.id, (x) => ({ ...x, opciones: x.opciones.filter((y) => y.id !== o.id) }))}
                          className="grid h-6 w-6 flex-none place-items-center rounded text-muted transition-transform active:scale-90 hover:text-danger">
                          <X size={13} strokeWidth={2.6} />
                        </button>
                      )}
                    </span>
                  ))}

                  {editable && (
                    <button type="button"
                      onClick={() => onCambiar(g.id, (x) => ({
                        ...x, opciones: [...x.opciones, { id: crypto.randomUUID(), nombre: "Nueva opción", precioExtra: 0 }],
                      }))}
                      className="flex min-h-9 items-center gap-1.5 rounded-[5px] border border-dashed border-brand-lit px-3 text-[12.5px] font-semibold text-brand-lit transition-transform active:scale-95">
                      <Plus size={14} /> Opción
                    </button>
                  )}

                  {g.opciones.length === 0 && !editable && (
                    <span className="px-1 py-1 text-[12.5px] text-muted">Este grupo no tiene opciones.</span>
                  )}
                </div>
              </section>
            );
          })}

          {grupos.length === 0 && (
            <p className="px-1 py-6 text-center text-[13px] text-muted">
              Este artículo no tiene extras ni comentarios, ni hereda ninguno.
            </p>
          )}
        </Desplazable>
      </Caja>
    </>
  );
}
