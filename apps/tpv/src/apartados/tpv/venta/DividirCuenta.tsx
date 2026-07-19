import { useEffect, useRef, useState } from "react";
import { DividirCuentaModal, type ParteVista } from "./DividirCuentaModal";
import { CobrarModal } from "./CobrarModal";
import { imprimirTicket } from "../../../lib/impresion";
import { construirTicketPrueba, DISENO_DEMO } from "./ticket-impresion";
import { PRODUCTOS_DEMO } from "../datos";
import { useVenta } from "../store";

// CONTROLADOR de Dividir cuenta (el equivalente a page.tsx del Next): mantiene las
// partes en memoria (demo) y, para cobrar cada una, abre el CobrarModal ENCIMA con
// el importe de esa parte. Al saldar todo, avisa a Tpv para cerrar la mesa.
// Al cablear el nodo, las partes vendrán de `cuenta_parte` y el cobro será real.

const OPERARIO = "María Ruiz";
const r2 = (n: number) => Math.round(n * 100) / 100;
const nombreDe = (id: string) => PRODUCTOS_DEMO.find((p) => p.id === id.split("|")[0])?.nombre ?? "Producto";

function repartoIgual(total: number, n: number): number[] {
  const totalC = Math.round(total * 100);
  const baseC = Math.floor(totalC / n);
  const arr = Array.from({ length: n }, () => baseC / 100);
  arr[n - 1] = (totalC - baseC * (n - 1)) / 100;
  return arr;
}

interface Cobro { label: string; importe: number; onOk: () => void }

export function DividirCuenta({
  contexto, comensales, onCerrar, onSaldada,
}: Readonly<{ contexto: string; comensales: number; onCerrar: () => void; onSaldada: () => void }>) {
  const comanda = useVenta((s) => s.comanda);
  const total = useVenta((s) => s.total());
  const precioEfectivo = useVenta((s) => s.precioEfectivo);
  const descontarLineas = useVenta((s) => s.descontarLineas);

  const [partes, setPartes] = useState<ParteVista[]>([]);
  const [cobro, setCobro] = useState<Cobro | null>(null);
  const [tocado, setTocado] = useState(false);
  const seq = useRef(0);
  const saldado = useRef(false);
  const id = () => `p${seq.current++}`;

  const lineas = Object.entries(comanda).map(([lid, uds]) => ({ id: lid, nombre: nombreDe(lid), uds, precio: precioEfectivo(lid) }));
  const cobradoDinero = r2(partes.filter((p) => p.cobrada && p.tipo !== "PRODUCTOS").reduce((s, p) => s + p.importe, 0));
  const pendiente = r2(total - cobradoDinero);

  function saldar() {
    if (saldado.current) return;
    saldado.current = true;
    onSaldada();
  }
  // Cuando ya se cobró algo y no queda pendiente (ni hay un cobro en curso), la mesa está saldada.
  useEffect(() => {
    if (tocado && !cobro && pendiente <= 0.005) saldar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tocado, cobro, pendiente]);

  const marcarCobrada = (pid: string) => { setPartes((prev) => prev.map((p) => (p.id === pid ? { ...p, cobrada: true } : p))); setTocado(true); };

  function abrirCobro(label: string, importe: number, onOk: () => void) {
    setCobro({ label, importe, onOk });
  }

  function imprimirParte(label: string, importe: number) {
    const base = r2(importe / 1.1);
    const t = construirTicketPrueba({ contexto: label, operario: OPERARIO, baseImponible: base, impuesto: r2(importe - base), total: importe, descuento: 0, propina: 0, proforma: true });
    void imprimirTicket(t, DISENO_DEMO);
  }

  // ── Callbacks del modal ──────────────────────────────────────────────────
  function onCobrarIgual(n: number, pos: number) {
    let pend = partes.filter((p) => p.tipo === "IGUAL" && !p.cobrada);
    if (pend.length !== n) {
      const imps = repartoIgual(pendiente, n);
      pend = imps.map((im, i) => ({ id: id(), indice: i + 1, tipo: "IGUAL" as const, importe: im, cobrada: false }));
      setPartes((prev) => [...prev.filter((p) => !(p.tipo === "IGUAL" && !p.cobrada)), ...pend]);
    }
    const parte = pend[pos];
    if (parte) abrirCobro(`Parte ${parte.indice} de ${n}`, parte.importe, () => marcarCobrada(parte.id));
  }

  function onCobrarParte(p: ParteVista) {
    const label = p.tipo === "IMPORTE" ? `Importe ${p.indice}` : `Parte ${p.indice}`;
    abrirCobro(label, p.importe, () => marcarCobrada(p.id));
  }

  function onSepararImporte(importe: number) {
    const indice = partes.filter((p) => p.tipo === "IMPORTE").length + 1;
    setPartes((prev) => [...prev, { id: id(), indice, tipo: "IMPORTE", importe, cobrada: false }]);
  }

  function onCobrarResto(importe: number) {
    abrirCobro("Resto de la mesa", importe, () => {
      const indice = partes.filter((p) => p.tipo === "IMPORTE").length + 1;
      setPartes((prev) => [...prev, { id: id(), indice, tipo: "IMPORTE", importe, cobrada: true }]);
      setTocado(true);
    });
  }

  function onCobrarCuenta(sel: { id: string; uds: number }[]) {
    const importe = r2(sel.reduce((s, l) => s + l.uds * precioEfectivo(l.id), 0));
    if (importe <= 0) return;
    abrirCobro("Cuenta por productos", importe, () => {
      descontarLineas(sel);
      const indice = partes.filter((p) => p.tipo === "PRODUCTOS").length + 1;
      setPartes((prev) => [...prev, { id: id(), indice, tipo: "PRODUCTOS", importe, cobrada: true }]);
      setTocado(true);
    });
  }

  function onCobrarPendiente() {
    abrirCobro("Cuenta completa", pendiente, () => { setTocado(true); saldar(); });
  }

  function onQuitarDivision() {
    setPartes((prev) => prev.filter((p) => p.cobrada));
  }

  return (
    <>
      <DividirCuentaModal
        lineas={lineas}
        total={total}
        pendiente={pendiente}
        partes={partes}
        comensales={comensales}
        contexto={contexto}
        onCobrarIgual={onCobrarIgual}
        onSepararImporte={onSepararImporte}
        onCobrarParte={onCobrarParte}
        onCobrarResto={onCobrarResto}
        onCobrarCuenta={onCobrarCuenta}
        onCobrarPendiente={onCobrarPendiente}
        onQuitarDivision={onQuitarDivision}
        onImprimirParte={imprimirParte}
        onCerrar={onCerrar}
      />

      {cobro && (
        <CobrarModal
          total={cobro.importe}
          contexto={cobro.label}
          onCerrar={() => setCobro(null)}
          onCobrado={() => { cobro.onOk(); setCobro(null); }}
          onDividir={() => setCobro(null)}
        />
      )}
    </>
  );
}
