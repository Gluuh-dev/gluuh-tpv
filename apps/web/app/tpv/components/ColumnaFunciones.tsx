"use client";

// Rail vertical de acciones del TPV (entre el ticket y la carta), estilo Glop:
// acciones de CUENTA (cliente, aparcar, pasar mesa, invitar…) y de FLUJO
// (preparar / marchar). Las acciones de LÍNEA (anular / com. y extra / comp. menú)
// viven en la fila horizontal bajo los totales; imprimir vive en el teclado.
// El orden es configurable (setting `tpv.funciones.orden`). docs/implementacion/05 §5.2.
import {
  ParkingSquare, ArrowRightLeft, Coffee, SplitSquareHorizontal, UserPlus,
  Printer, Trash2, UserCog, ChefHat, Send, Settings2, ArchiveRestore, Lock, type LucideIcon,
} from "lucide-react";
import { BotonAccionTPV } from "./BotonAccionTPV";

interface Props {
  hayLineas: boolean;
  hayCuenta: boolean;
  tipoOperacion: "VENTA" | "INVITACION" | "AUTOCONSUMO";
  nAparcados: number;
  hayUltimoDoc: boolean;
  /** Orden de los botones por id; los que falten van al final. */
  orden?: string[];
  /** Ids resaltados como "favoritos" (acento de marca). P. ej. ["aparcar","marchar"]. */
  favoritos?: readonly string[];
  onAparcar(): void;
  onAparcados(): void;
  onLlevarBarra(): void;
  onPasarMesa(): void;
  onConsumoPropio(): void;
  onDividir(): void;
  onBorrarCuenta(): void;
  onUltimoDoc(): void;
  onCliente(): void;
  onCamarero(): void;
  onPreparar(): void;
  onMarchar(): void;
  /** Utilidades ancladas al final del rail (antes en el teclado). */
  onAbrirCajon(): void;
  onUtilidades(): void;
  onImprimir(): void;
  /** Imprimir deshabilitado (nada que imprimir): `!ticket && !unidades`. */
  imprimirDisabled: boolean;
  /** Bloquear el terminal (velo). Antes vivía en el rail de salas. */
  onBloquear(): void;
}

// Catálogo de botones (id + etiqueta) del RAIL VERTICAL para la pantalla de
// configuración de orden: acciones de cuenta + flujo (preparar / marchar).
export const BOTONES_TPV: { id: string; label: string }[] = [
  { id: "cliente", label: "Cliente" },
  { id: "aparcar", label: "Aparcar" },
  { id: "pasarMesa", label: "Pasar mesa" },
  { id: "consumoPropio", label: "Cons. propio" },
  { id: "dividir", label: "Dividir" },
  { id: "borrarCuenta", label: "Borrar cuenta" },
  { id: "camarero", label: "Camarero" },
  { id: "ultimoDoc", label: "Último doc" },
  { id: "preparar", label: "Preparar" },
  { id: "marchar", label: "Marchar" },
];

// Devuelve los ids de acciones en el orden configurado (los que falten, al final).
export function ordenarAcciones(orden?: string[]): string[] {
  const base = BOTONES_TPV.map((b) => b.id);
  const r = (orden?.length ? orden : base).filter((id) => base.includes(id));
  for (const id of base) if (!r.includes(id)) r.push(id);
  return r;
}

export function ColumnaFunciones(p: Props) {
  const defs: Record<string, { icon: LucideIcon; label: string; onClick(): void; disabled?: boolean; activo?: boolean; badge?: number }> = {
    cliente: { icon: UserPlus, label: "Cliente", onClick: p.onCliente },
    aparcar: { icon: ParkingSquare, label: "Aparcar", onClick: p.onAparcar, disabled: !p.hayLineas },
    pasarMesa: { icon: ArrowRightLeft, label: "Pasar mesa", onClick: p.onPasarMesa, disabled: !p.hayLineas && !p.hayCuenta },
    consumoPropio: { icon: Coffee, label: "Cons. propio", onClick: p.onConsumoPropio, activo: p.tipoOperacion === "AUTOCONSUMO", disabled: !p.hayLineas },
    dividir: { icon: SplitSquareHorizontal, label: "Dividir", onClick: p.onDividir, disabled: !p.hayLineas },
    borrarCuenta: { icon: Trash2, label: "Borrar cuenta", onClick: p.onBorrarCuenta, disabled: !p.hayLineas && !p.hayCuenta },
    camarero: { icon: UserCog, label: "Camarero", onClick: p.onCamarero },
    ultimoDoc: { icon: Printer, label: "Último doc", onClick: p.onUltimoDoc, disabled: !p.hayUltimoDoc },
    preparar: { icon: ChefHat, label: "Preparar", onClick: p.onPreparar, disabled: !p.hayLineas },
    marchar: { icon: Send, label: "Marchar", onClick: p.onMarchar, disabled: !p.hayLineas },
  };
  const ids = ordenarAcciones(p.orden).filter((id) => defs[id]);
  const favs = new Set(p.favoritos ?? []);

  // Rail vertical de acciones de CUENTA: desde arriba hasta encima del teclado.
  // SIN border-l: el divisor con el ticket lo pinta el border-r de la parte superior.
  return (
    <div className="flex w-[88px] flex-none flex-col gap-[.28rem] overflow-y-auto bg-surface px-[.3rem] py-[.4rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ids.map((id) => <BotonAccionTPV key={id} {...defs[id]!} favorito={favs.has(id)} className="w-full flex-none" />)}
      {/* Utilidades ancladas al fondo del rail, con el gris del teclado (tono "utilidad") */}
      <div className="mt-auto flex flex-col gap-[.28rem] pt-[.28rem]">
        <BotonAccionTPV icon={ArchiveRestore} label="Abrir cajón" onClick={p.onAbrirCajon} tono="utilidad" className="w-full flex-none" />
        <BotonAccionTPV icon={Settings2} label="Utilidades" onClick={p.onUtilidades} tono="utilidad" className="w-full flex-none" />
        <BotonAccionTPV icon={Printer} label="Imprimir" onClick={p.onImprimir} disabled={p.imprimirDisabled} tono="utilidad" className="w-full flex-none" />
        <BotonAccionTPV icon={Lock} label="Bloquear" onClick={p.onBloquear} tono="utilidad" className="w-full flex-none" />
      </div>
    </div>
  );
}
