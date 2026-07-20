import { useEffect, useState } from "react";
import { Info, Tags } from "lucide-react";
import { eur } from "../../../lib/dinero";
import { Caja, claseEntrada } from "./Marco";
import {
  cargarTarifas, cargarPreciosDeArticulo, fijarPrecioTarifa,
  type TarifaCatalogo, type PrecioTarifa,
} from "./catalogo";

// ────────────────────────────────────────────────────────────────────────────
// PRECIOS POR TARIFA de un artículo.
//
// Esto sustituye a las columnas «Barra / Salón / Terraza» que había en la tabla
// de formatos y que eran mentira: la BD guarda UN precio por formato, y el
// precio distinto por sala vive en las TARIFAS (`product_price`), que son por
// ARTÍCULO. Salón y terraza se tecleaban y se perdían al guardar.
//
// La regla que hay que dejar clarísima en pantalla: una tarifa EN BLANCO no
// regala nada — se cobra el precio normal. Es la misma regla que aplica el
// servidor al cobrar (`precio_de_venta`, migración 0131).
// ────────────────────────────────────────────────────────────────────────────

const mensaje = (e: unknown) => (e instanceof Error ? e.message : "fallo desconocido");

export function TarifasArticulo({ articuloId, precioNormal, soloLectura, real, onAviso }: Readonly<{
  articuloId: string;
  /** El precio del primer formato: lo que se cobra si la tarifa no dice nada. */
  precioNormal: number;
  soloLectura: boolean;
  real: boolean;
  onAviso: (t: string) => void;
}>) {
  const [tarifas, setTarifas] = useState<TarifaCatalogo[]>([]);
  const [precios, setPrecios] = useState<PrecioTarifa[]>([]);
  const [borrador, setBorrador] = useState<Record<string, string>>({});

  useEffect(() => {
    let vivo = true;
    void Promise.all([cargarTarifas(), cargarPreciosDeArticulo(articuloId)]).then(([t, p]) => {
      if (!vivo) return;
      setTarifas(t ?? []);
      setPrecios(p ?? []);
      setBorrador(Object.fromEntries((p ?? []).map((x) => [x.tarifaId, String(x.precio)])));
    });
    return () => { vivo = false; };
  }, [articuloId]);

  if (!real) {
    return (
      <Caja titulo="Precios por tarifa">
        <p className="p-4 text-[12.5px] leading-relaxed text-muted">
          Las tarifas salen del nodo y este terminal no está emparejado.
        </p>
      </Caja>
    );
  }

  const guardar = (tarifaId: string) => {
    const texto = (borrador[tarifaId] ?? "").trim();
    const valor = texto === "" ? null : Number(texto);
    if (valor !== null && !Number.isFinite(valor)) return;
    void fijarPrecioTarifa(articuloId, tarifaId, valor)
      .then(() => {
        setPrecios((ps) => [
          ...ps.filter((x) => x.tarifaId !== tarifaId),
          ...(valor === null ? [] : [{ tarifaId, precio: valor }]),
        ]);
        onAviso(valor === null ? "Esa tarifa vuelve al precio normal." : "Precio de tarifa guardado.");
      })
      .catch((e: unknown) => onAviso(mensaje(e)));
  };

  return (
    <Caja titulo="Precios por tarifa" contador={`${precios.length} de ${tarifas.length}`}>
      <p className="flex flex-none items-start gap-2 border-b border-line bg-panel-2 px-3.5 py-2 text-[12px] leading-snug text-muted">
        <Info size={15} className="mt-0.5 flex-none" />
        <span>
          La <b>sala</b> elige tarifa (por ejemplo, la terraza), y la tarifa cambia el precio
          de este artículo. <b>En blanco se cobra el precio normal</b>: una tarifa a medio
          rellenar nunca regala el género.
        </span>
      </p>

      <div className="p-3.5">
        {tarifas.length === 0 ? (
          <p className="flex items-center gap-2.5 text-[13px] text-muted">
            <Tags size={16} className="flex-none" />
            Este bar no tiene ninguna tarifa. Se crean en Precios → Tarifas.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {tarifas.map((t) => {
              const puesto = precios.find((p) => p.tarifaId === t.id);
              return (
                <label key={t.id} className="flex flex-col gap-1 rounded-[6px] border border-line bg-panel-2 p-2.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <b className="truncate text-[13px] font-bold">{t.nombre}</b>
                    <span className={`flex-none text-[11px] font-semibold ${puesto ? "text-cobro" : "text-muted"}`}>
                      {puesto ? "precio propio" : `normal ${eur(precioNormal)}`}
                    </span>
                  </span>
                  <input
                    type="number" step="0.05" min="0" readOnly={soloLectura}
                    value={borrador[t.id] ?? ""}
                    placeholder={`sin cambio · ${precioNormal.toFixed(2)}`}
                    onChange={(e) => setBorrador((b) => ({ ...b, [t.id]: e.target.value }))}
                    onBlur={() => !soloLectura && guardar(t.id)}
                    className={claseEntrada(soloLectura, "text-right font-mono")}
                  />
                </label>
              );
            })}
          </div>
        )}
      </div>
    </Caja>
  );
}
