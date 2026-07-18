"use client";

import {
  ArchiveRestore,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  ContactRound,
  CookingPot,
  CreditCard,
  Gift,
  FileSearch,
  LogOut,
  Mail,
  Moon,
  PackagePlus,
  PackageOpen,
  Percent,
  ReceiptText,
  Scale,
  Settings2,
  SlidersHorizontal,
  Sun,
  Tag,
  Tags,
  UtensilsCrossed,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { ModalTPV } from "./ModalTPV";

type Utilidad = {
  id: string;
  etiqueta: string;
  icono: LucideIcon;
  tono?: "caja" | "alerta";
  deshabilitada?: boolean;
  accion?: () => void;
};

interface Props {
  hayUltimoDocumento: boolean;
  hayComanda: boolean;
  puedeCobrar: boolean;
  puedeAbrirCajon: boolean;
  temaOscuro: boolean;
  onAbrirCajon: () => void;
  onReimprimirCocina: () => void;
  onReimprimir: () => void;
  onCerrarDia: () => void;
  onResumenCaja: () => void;
  onCobrosPendientes: () => void;
  onAgenda: () => void;
  onModulos: () => void;
  onCambiarTema: () => void;
  onSalir: () => void;
  onNuevoArticulo: () => void;
  onInvitacion: () => void;
  onClose: () => void;
}

export function UtilidadesModal({
  hayUltimoDocumento,
  hayComanda,
  puedeCobrar,
  puedeAbrirCajon,
  temaOscuro,
  onAbrirCajon,
  onReimprimirCocina,
  onReimprimir,
  onCerrarDia,
  onResumenCaja,
  onCobrosPendientes,
  onAgenda,
  onModulos,
  onCambiarTema,
  onSalir,
  onNuevoArticulo,
  onInvitacion,
  onClose,
}: Readonly<Props>) {
  const utilidades: Utilidad[] = [
    { id: "reimprimir-cocina", etiqueta: "Re. cocina", icono: CookingPot, tono: "caja", accion: onReimprimirCocina, deshabilitada: !hayComanda },
    { id: "grupo-cocina", etiqueta: "Grupo cocina", icono: UsersRound, deshabilitada: true },
    { id: "zonas-impresion", etiqueta: "Zonas de impresión", icono: UtensilsCrossed, deshabilitada: true },
    { id: "buscador-articulos", etiqueta: "Buscador de artículos", icono: FileSearch, deshabilitada: true },
    { id: "cashkeeper", etiqueta: "Opciones CashKeeper", icono: Settings2, deshabilitada: true },
    { id: "buscar-documento", etiqueta: "Buscar documento", icono: ReceiptText, deshabilitada: true },
    { id: "apunte-caja", etiqueta: "Apunte de caja", icono: Banknote, tono: "caja", deshabilitada: true },
    { id: "cerrar-dia", etiqueta: "Cerrar turno / día", icono: ArchiveRestore, tono: "caja", accion: onCerrarDia, deshabilitada: !puedeCobrar },
    { id: "resumen-caja", etiqueta: "Resumen de caja", icono: CircleDollarSign, tono: "caja", accion: onResumenCaja },
    { id: "cashlogy", etiqueta: "Opciones CashLogy", icono: Settings2, deshabilitada: true },
    { id: "agenda", etiqueta: "Agenda", icono: CalendarDays, accion: onAgenda },
    { id: "tarifa", etiqueta: "Selección de tarifa", icono: Tag, deshabilitada: true },
    { id: "empleados", etiqueta: "Empleados", icono: ContactRound, accion: () => { window.location.assign("/tpv/config/empleados"); } },
    { id: "presencia", etiqueta: "Control de presencia", icono: ContactRound, deshabilitada: true },
    { id: "cobros-pendientes", etiqueta: "Cobros pendientes", icono: CircleDollarSign, tono: "caja", accion: onCobrosPendientes },
    { id: "safepay", etiqueta: "Opciones SafePay", icono: Settings2, deshabilitada: true },
    { id: "nuevo-articulo", etiqueta: "Nuevo artículo", icono: PackagePlus, accion: onNuevoArticulo },
    { id: "cambiar-usuario", etiqueta: "Cambiar de usuario", icono: LogOut, tono: "alerta", accion: onSalir },
    { id: "conversor", etiqueta: "Conversor de documentos", icono: ReceiptText, deshabilitada: true },
    { id: "canjeo", etiqueta: "Canjeo de regalos", icono: Gift, deshabilitada: true },
    { id: "bip", etiqueta: "Opciones Bip", icono: Settings2, deshabilitada: true },
    { id: "precio", etiqueta: "Cambio de precio", icono: Tags, tono: "alerta", deshabilitada: true },
    { id: "unidades", etiqueta: "Cambio de unidades", icono: SlidersHorizontal, deshabilitada: true },
    { id: "impresion-cocina", etiqueta: "Desactivar imp. cocina", icono: CookingPot, tono: "alerta", deshabilitada: true },
    // Abre "Invitaciones y descuentos" (ya cubre el descuento por línea y por cuenta).
    { id: "descuento", etiqueta: "Descuento de línea", icono: Percent, tono: "alerta", accion: onInvitacion },
    { id: "balanza", etiqueta: "Opciones balanza", icono: Scale, deshabilitada: true },
    { id: "forma-pago", etiqueta: "Selec. forma de pago", icono: CreditCard, deshabilitada: true },
    { id: "cajon", etiqueta: "Abrir cajón", icono: Banknote, tono: "caja", accion: onAbrirCajon, deshabilitada: !puedeAbrirCajon },
    { id: "email", etiqueta: "Enviar por email", icono: Mail, deshabilitada: true },
    { id: "invitacion", etiqueta: "Invitación", icono: Gift, tono: "alerta", accion: onInvitacion },
    // Página de ajustes locales (tema, zurdo…); el hub de config cuelga de ella.
    { id: "ajustes", etiqueta: "Ajustes del terminal", icono: Settings2, accion: () => { window.location.assign("/tpv/config"); } },
  ];

  return (
    <ModalTPV
      titulo="Utilidades"
      subtitulo="Terminal"
      ancho={980}
      alto={700}
      onClose={onClose}
    >
      <div className="flex h-full min-h-0 flex-col bg-surface">
        <div className="grid min-h-0 flex-1 grid-cols-5 grid-rows-7 gap-2 overflow-hidden p-3">
          {utilidades.map((utilidad) => {
            const Icono = utilidad.icono;
            const estilo = utilidad.deshabilitada
              ? "border-[#e1e5ea] bg-[#f7f8fa] text-[#b4bbc6] shadow-none [&>svg]:text-[#c7cdd6]"
              : utilidad.tono === "caja"
                ? "border-[#b9e6d4] bg-white text-[#1e2430] shadow-sm hover:border-[#0e9f6e] hover:bg-[#e7f7f1] [&>svg]:text-[#0e9f6e]"
                : utilidad.tono === "alerta"
                  ? "border-[#f0d9a8] bg-white text-[#1e2430] shadow-sm hover:border-[#f5a623] hover:bg-[#fdf1dc] [&>svg]:text-[#9a6a12]"
                  : "border-[#cfd5de] bg-white text-[#1e2430] shadow-sm hover:border-[#7c3d9b] hover:bg-[#f3edf7] [&>svg]:text-[#7c3d9b]";
            return (
              <button
                key={utilidad.id}
                type="button"
                onClick={utilidad.accion}
                disabled={utilidad.deshabilitada}
                className={`flex min-h-0 flex-col items-center justify-center gap-1.5 rounded-lg border px-2 text-center text-[11.5px] font-semibold leading-tight transition-colors disabled:cursor-not-allowed ${estilo}`}
              >
                <Icono size={21} strokeWidth={1.8} />
                <span className="leading-tight">{utilidad.etiqueta}</span>
              </button>
            );
          })}
        </div>
        <footer className="flex flex-none items-center gap-3 border-t border-[#e1e5ea] bg-[#f7f8fa] px-4 py-2">
          <p className="hidden text-xs text-muted-foreground sm:block">Las opciones atenuadas necesitan un módulo o una integración que aún no está activa.</p>
          <button type="button" onClick={onModulos} className="hidden h-10 items-center gap-2 rounded-md border border-[#cfd5de] bg-white px-4 text-sm font-semibold text-[#4a5262] hover:bg-[#f3edf7] md:flex"><PackageOpen size={16} /> Módulos</button>
          <button type="button" onClick={onReimprimir} disabled={!hayUltimoDocumento} className="hidden h-10 items-center gap-2 rounded-md border border-[#cfd5de] bg-white px-4 text-sm font-semibold text-[#4a5262] hover:bg-[#f3edf7] disabled:cursor-not-allowed disabled:opacity-40 md:flex"><ReceiptText size={16} /> Último ticket</button>
          <button type="button" onClick={onClose} className="ml-auto flex h-10 items-center gap-2 rounded-md bg-[#0e9f6e] px-5 text-sm font-bold text-white hover:brightness-95">
            Volver al TPV
          </button>
        </footer>
      </div>
    </ModalTPV>
  );
}