import { MonitorSmartphone, Settings2, BarChart3, Users, Share2, type LucideIcon } from "lucide-react";
import type { Apartado, Rol } from "../lib/nav";

// Metadatos de cada apartado del hub — la ÚNICA fuente: título, descripción,
// icono, color de la placa y rol que exige. Los usan el Inicio (tarjetas), la
// puerta de credencial y la cabecera de cada apartado. Cambiar aquí = cambiar
// en todos los sitios.
export interface MetaApartado {
  titulo: string;
  desc: string;
  Icono: LucideIcon;
  /** Fondo de la placa (escudo). Morado de marca salvo Admin (rosa) y Nodo (verde). */
  color: string;
  requiere: Rol;
}

const MARCA = "linear-gradient(150deg,var(--brand-lit),var(--brand))";

export const APARTADOS: Record<Apartado, MetaApartado> = {
  tpv:      { titulo: "Abrir TPV",     desc: "Mesas, barra, comandas y cobros del turno.",            Icono: MonitorSmartphone, color: MARCA, requiere: "operario" },
  config:   { titulo: "Configuración", desc: "Carta, precios, salas y mesas, impresoras, pagos e impuestos.", Icono: Settings2, color: MARCA, requiere: "admin" },
  analisis: { titulo: "Análisis",      desc: "Ventas por hora, platos más vendidos, tickets medios y cierres de caja.", Icono: BarChart3, color: MARCA, requiere: "admin" },
  admin:    { titulo: "Administrador", desc: "Empleados, turnos, permisos, licencias y ajustes avanzados del local.", Icono: Users, color: "linear-gradient(150deg,#E3B7FF,#9A5BBE)", requiere: "admin" },
  nodo:     { titulo: "Visor Node",    desc: "Estado del servidor, dispositivos conectados, colas de impresión y registro.", Icono: Share2, color: "linear-gradient(150deg,#54E3B1,#159C6E)", requiere: "tecnico" },
};
