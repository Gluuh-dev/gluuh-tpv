import { useEffect, useState } from "react";
import { Info, TriangleAlert, PackageCheck, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Desplazable } from "../../../ui";
import { eur } from "../../../lib/dinero";
import { Caja, Campo, claseEntrada } from "./Marco";
import {
  cargarStock, ajustarStock, fijarMinimo, bajoMinimo, costeMedio, type StockArticulo as Datos,
} from "./stock";

// ────────────────────────────────────────────────────────────────────────────
// STOCK Y COMPRAS de un artículo.
//
// Las dos cosas juntas a propósito: el stock sin las compras no explica NADA
// —«pone 12, ¿de dónde salen?»— y las compras son de donde sale el coste real,
// que es lo que hace que el margen de la carta sea verdad o mentira.
//
// El ajuste manual pide MOTIVO y deja movimiento. Un stock que cambia sin dejar
// rastro es un stock en el que nadie confía: al tercer descuadre, el dueño deja
// de mirarlo y el módulo entero sobra.
// ────────────────────────────────────────────────────────────────────────────

const mensaje = (e: unknown) => (e instanceof Error ? e.message : "fallo desconocido");

const ICONO_MOV: Record<string, typeof ArrowDownToLine> = {
  ENTRADA: ArrowDownToLine, AJUSTE: PackageCheck,
  SALIDA: ArrowUpFromLine, MERMA: TriangleAlert,
};

export function StockArticulo({ articuloId, nombre, real, controlaStock, onAviso }: Readonly<{
  articuloId: string;
  nombre: string;
  real: boolean;
  /** El flag de la ficha. Sin él, el TPV no descuenta al vender. */
  controlaStock: boolean;
  onAviso: (t: string) => void;
}>) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [ajuste, setAjuste] = useState("");
  const [motivo, setMotivo] = useState("");
  const [minimo, setMinimo] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void cargarStock(articuloId).then((d) => {
      if (!vivo) return;
      setDatos(d);
      setAjuste(d ? String(d.existencias) : "");
      setMinimo(d?.minimo === null || d === null ? "" : String(d.minimo));
    });
    return () => { vivo = false; };
  }, [articuloId]);

  if (!real || !datos) {
    return (
      <Caja crecer titulo="Stock y compras">
        <p className="grid flex-1 place-items-center p-8 text-center text-sm leading-relaxed text-muted">
          El stock sale del nodo, y este terminal no está emparejado.<br />
          Aquí se verán las existencias, los movimientos y de qué albarán vino cada entrada.
        </p>
      </Caja>
    );
  }

  const coste = costeMedio(datos.compras);
  const alerta = bajoMinimo(datos.existencias, datos.minimo);

  const guardarAjuste = () => {
    const n = Number(ajuste);
    if (!Number.isFinite(n) || ocupado) return;
    setOcupado(true);
    void ajustarStock(articuloId, n, datos.existencias, motivo)
      .then(() => {
        setDatos((d) => (d ? { ...d, existencias: n } : d));
        setMotivo("");
        onAviso("Stock ajustado.");
      })
      .catch((e: unknown) => onAviso(mensaje(e)))
      .finally(() => setOcupado(false));
  };

  const guardarMinimo = () => {
    const n = minimo.trim() === "" ? null : Number(minimo);
    if (n !== null && !Number.isFinite(n)) return;
    void fijarMinimo(articuloId, n)
      .then(() => { setDatos((d) => (d ? { ...d, minimo: n } : d)); onAviso("Aviso de reposición guardado."); })
      .catch((e: unknown) => onAviso(mensaje(e)));
  };

  return (
    <>
      {!controlaStock && (
        <p className="flex flex-none items-center gap-2.5 rounded-[6px] border border-amber/30 bg-amber/8 px-3.5 py-3 text-[13px] font-semibold leading-snug text-amber">
          <Info size={18} className="flex-none" />
          Este artículo tiene «Controla stock» apagado, así que <b>vender no descuenta</b>.
          Aquí puedes llevar la cuenta a mano, pero se te quedará vieja sola.
        </p>
      )}

      <div className="grid min-h-0 flex-1 gap-2.5 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-2.5">
          <Caja titulo="Existencias">
            <div className="p-3.5">
              <div className={`mb-3 rounded-[6px] border p-4 text-center ${
                alerta ? "border-danger/40 bg-danger/8" : "border-line bg-panel-2"
              }`}>
                <span className={`block font-mono text-[34px] font-extrabold leading-none ${alerta ? "text-danger" : "text-paper"}`}>
                  {datos.existencias}
                </span>
                <span className="mt-1 block text-[12px] text-muted">
                  {alerta ? `Por debajo del mínimo (${datos.minimo})` : "unidades"}
                </span>
              </div>

              <Campo etiqueta="Corregir a" htmlFor="s-aj">
                <input id="s-aj" type="number" step="0.001" value={ajuste}
                  onChange={(e) => setAjuste(e.target.value)} className={claseEntrada(false, "text-right font-mono")} />
              </Campo>
              <Campo etiqueta="Motivo del ajuste" htmlFor="s-mot">
                <input id="s-mot" value={motivo} onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Recuento, rotura, merma…" className={claseEntrada(false)} />
              </Campo>
              <button type="button" onClick={guardarAjuste}
                disabled={ocupado || Number(ajuste) === datos.existencias || !motivo.trim()}
                className="mt-1 flex min-h-11 w-full items-center justify-center gap-2 rounded-[5px] bg-brand px-3 text-[13px] font-semibold text-white transition-transform active:scale-[.98] disabled:opacity-40">
                Guardar ajuste
              </button>
              <p className="mt-1.5 text-[11.5px] leading-snug text-muted">
                El ajuste queda como movimiento, con su motivo. Un stock que cambia sin
                rastro no lo mira nadie.
              </p>
            </div>
          </Caja>

          <Caja titulo="Aviso de reposición">
            <div className="p-3.5">
              <Campo etiqueta="Avisar cuando baje de" htmlFor="s-min">
                <div className="flex gap-1.5">
                  <input id="s-min" type="number" step="0.001" value={minimo} placeholder="sin aviso"
                    onChange={(e) => setMinimo(e.target.value)}
                    className={claseEntrada(false, "min-w-0 flex-1 text-right font-mono")} />
                  <button type="button" onClick={guardarMinimo}
                    className="min-h-11 flex-none rounded-[5px] border border-line px-3 text-[12.5px] font-semibold text-paper/85 transition-transform active:scale-95">
                    Guardar
                  </button>
                </div>
              </Campo>
              <p className="text-[11.5px] leading-snug text-muted">
                En blanco, no avisa. Lo que no se repone (la tapa del día) no debería
                salir en rojo: acaba enseñando a ignorar los avisos.
              </p>
            </div>
          </Caja>

          <Caja titulo="Coste de compra">
            <div className="p-3.5">
              {coste === null ? (
                <p className="text-[12.5px] leading-snug text-muted">
                  Todavía no hay compras recibidas de «{nombre}». El coste de la ficha
                  es el que tecleaste a mano.
                </p>
              ) : (
                <>
                  <span className="block font-mono text-[24px] font-extrabold text-cobro">{eur(coste)}</span>
                  <p className="mt-1 text-[11.5px] leading-snug text-muted">
                    Media <b>ponderada por cantidad</b> de lo recibido. Si compras 100 a
                    0,50 € y 2 a 3 €, el coste real está cerca de 0,55 — no de 1,75.
                  </p>
                </>
              )}
            </div>
          </Caja>
        </div>

        <div className="flex min-h-0 flex-col gap-2.5">
          <Caja crecer titulo="De dónde ha venido" contador={`${datos.compras.length} compras`}>
            <Desplazable eje="ambos" className="border-t border-line">
              <table className="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:z-2 [&>th]:border-b [&>th]:border-line [&>th]:bg-panel [&>th]:px-2.5 [&>th]:py-2 [&>th]:text-left [&>th]:text-[11px] [&>th]:font-medium [&>th]:uppercase [&>th]:tracking-wide [&>th]:text-muted">
                    <th className="w-28">Fecha</th><th className="w-32">Documento</th><th>Proveedor</th>
                    <th className="w-24 text-right!">Cantidad</th><th className="w-28 text-right!">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.compras.map((c) => (
                    <tr key={c.lineaId} className={`border-b border-line text-[13px] ${c.estado !== "RECIBIDO" ? "opacity-50" : ""}`}>
                      <td className="px-2.5 py-2 font-mono text-muted">{c.fecha}</td>
                      <td className="px-2.5 py-2 font-mono">{c.numero || "—"}</td>
                      <td className="px-2.5 py-2">{c.proveedor}</td>
                      <td className="px-2.5 py-2 text-right font-mono">{c.cantidad}</td>
                      <td className="px-2.5 py-2 text-right font-mono">{eur(c.precioUnitario)}</td>
                    </tr>
                  ))}
                  {datos.compras.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-[13px] text-muted">
                      Nunca se ha comprado en un albarán.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </Desplazable>
          </Caja>

          <Caja crecer titulo="Movimientos" contador={`${datos.movimientos.length}`}>
            <Desplazable className="border-t border-line">
              <table className="w-full border-collapse">
                <tbody>
                  {datos.movimientos.map((m) => {
                    const Icono = ICONO_MOV[m.tipo] ?? PackageCheck;
                    const entra = m.tipo === "ENTRADA" || m.tipo === "AJUSTE";
                    return (
                      <tr key={m.id} className="border-b border-line text-[13px]">
                        <td className="w-10 px-2.5 py-2">
                          <Icono size={15} className={entra ? "text-mint" : "text-danger"} />
                        </td>
                        <td className="w-24 px-1 py-2 font-mono text-[12.5px] text-muted">{m.fecha}</td>
                        <td className={`w-20 px-2.5 py-2 text-right font-mono font-bold ${entra ? "text-mint" : "text-danger"}`}>
                          {entra ? "+" : "−"}{m.cantidad}
                        </td>
                        <td className="px-2.5 py-2 text-muted">{m.motivo || m.tipo}</td>
                      </tr>
                    );
                  })}
                  {datos.movimientos.length === 0 && (
                    <tr><td className="px-4 py-6 text-center text-[13px] text-muted">Sin movimientos.</td></tr>
                  )}
                </tbody>
              </table>
            </Desplazable>
          </Caja>
        </div>
      </div>
    </>
  );
}
