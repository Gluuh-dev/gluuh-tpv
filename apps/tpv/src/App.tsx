import { useEffect, useState, type ReactNode } from "react";
import { MonitorSmartphone, Settings2, BarChart3, Users, Share2 } from "lucide-react";
import { Inicio } from "./pantallas/Inicio";
import { Seccion } from "./pantallas/Seccion";
import { PinModal } from "./pantallas/PinModal";
import { AyudaModal } from "./pantallas/AyudaModal";
import { TECLA_A_VISTA, type Vista, type Rol } from "./nav";

type Apartado = Exclude<Vista, "inicio">;

const DEMO = {
  local: { nombre: "BAR LA ALAMEDA", terminal: "TERMINAL 01" },
  turno: { mesasAbiertas: 12, mesasTotal: 24, ventas: "486,30 €", comandas: 3 },
};

const SECCIONES: Record<Apartado, { titulo: string; desc: string; icono: ReactNode; color: string; requiere: Rol }> = {
  tpv:      { titulo: "Abrir TPV",     desc: "Mesas, barra, comandas y cobros del turno.",            icono: <MonitorSmartphone size={22} />, color: "linear-gradient(150deg,var(--brand-lit),var(--brand))", requiere: "operario" },
  config:   { titulo: "Configuración", desc: "Carta, precios, salas, impresoras, pagos, impuestos.",  icono: <Settings2 size={22} />,          color: "linear-gradient(150deg,var(--brand-lit),var(--brand))", requiere: "admin" },
  analisis: { titulo: "Análisis",      desc: "Ventas, platos más vendidos, tickets medios, caja.",    icono: <BarChart3 size={22} />,          color: "linear-gradient(150deg,var(--brand-lit),var(--brand))", requiere: "admin" },
  admin:    { titulo: "Administrador", desc: "Empleados, turnos, permisos, licencias.",               icono: <Users size={22} />,              color: "linear-gradient(150deg,#E3B7FF,#9A5BBE)", requiere: "admin" },
  nodo:     { titulo: "Visor Node",    desc: "Servidor, dispositivos, colas de impresión, registro.", icono: <Share2 size={22} />,             color: "linear-gradient(150deg,#54E3B1,#159C6E)", requiere: "tecnico" },
};

export function App() {
  const [vista, setVista] = useState<Vista>("inicio");
  // Apartado que se quiere abrir pero AÚN no autorizado: mientras esté aquí, se
  // muestra el PIN. No guardamos "autorizado" a propósito: salir y volver a entrar
  // SIEMPRE vuelve a pedir credencial (control de acceso del bar).
  const [pendiente, setPendiente] = useState<Apartado | null>(null);
  const [ayuda, setAyuda] = useState(false);

  // «Abrir TPV» entra DIRECTO (el login por operario ocurre dentro del TPV, por
  // acción); el resto pide PIN/pulsera CADA vez.
  const abrir = (v: Apartado) => (v === "tpv" ? setVista("tpv") : setPendiente(v));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (pendiente || ayuda) return; // el modal gestiona su propio teclado
      if (e.key === "Escape") { setVista("inicio"); return; }
      const v = TECLA_A_VISTA[e.key];
      if (v) { e.preventDefault(); abrir(v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendiente, ayuda]);

  return (
    <>
      {vista === "inicio" ? (
        <Inicio
          local={DEMO.local}
          turno={DEMO.turno}
          onNavegar={abrir}
          onSalir={() => setVista("inicio")}
          onAyuda={() => setAyuda(true)}
        />
      ) : (
        <Seccion {...SECCIONES[vista]} onVolver={() => setVista("inicio")} />
      )}

      {pendiente && (
        <PinModal
          titulo={SECCIONES[pendiente].titulo}
          icono={SECCIONES[pendiente].icono}
          color={SECCIONES[pendiente].color}
          requiere={SECCIONES[pendiente].requiere}
          onOk={() => { setVista(pendiente); setPendiente(null); }}
          onCancelar={() => setPendiente(null)}
        />
      )}

      {ayuda && (
        <AyudaModal licencia="LA-ALAMEDA-0417" terminal="T01" version="v3.2.0" onCerrar={() => setAyuda(false)} />
      )}
    </>
  );
}
