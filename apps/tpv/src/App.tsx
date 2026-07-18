import { useEffect, useState, type ReactNode } from "react";
import { MonitorSmartphone, Settings2, BarChart3, Users, Share2 } from "lucide-react";
import { Inicio } from "./pantallas/Inicio";
import { Seccion } from "./pantallas/Seccion";
import { PinModal } from "./pantallas/PinModal";
import { TECLA_A_VISTA, type Vista } from "./nav";

type Apartado = Exclude<Vista, "inicio">;

// Datos DEMO de la pantalla de inicio. Se reemplazan por los reales del nodo
// (sesión de operario + jornada) al cablear la SPA a los datos; la forma no cambia.
const DEMO = {
  operario: { nombre: "María Ruiz", rol: "Encargada" },
  local: { nombre: "BAR LA ALAMEDA", terminal: "TERMINAL 01" },
  turno: { mesasAbiertas: 12, mesasTotal: 24, ventas: "486,30 €", comandas: 3 },
};

const SECCIONES: Record<Apartado, { titulo: string; desc: string; icono: ReactNode; color: string }> = {
  tpv:      { titulo: "Abrir TPV",     desc: "Mesas, barra, comandas y cobros del turno.",            icono: <MonitorSmartphone size={22} />, color: "linear-gradient(160deg,#7c3d9b,#4a1e63)" },
  config:   { titulo: "Configuración", desc: "Carta, precios, salas, impresoras, pagos, impuestos.",  icono: <Settings2 size={22} />,          color: "linear-gradient(160deg,#7c3d9b,#57236f)" },
  analisis: { titulo: "Análisis",      desc: "Ventas, platos más vendidos, tickets medios, caja.",    icono: <BarChart3 size={22} />,          color: "linear-gradient(160deg,#7c3d9b,#57236f)" },
  admin:    { titulo: "Administrador", desc: "Empleados, turnos, permisos, licencias.",               icono: <Users size={22} />,              color: "linear-gradient(160deg,#7c3d9b,#57236f)" },
  nodo:     { titulo: "Visor Node",    desc: "Servidor, dispositivos, colas de impresión, registro.", icono: <Share2 size={22} />,             color: "linear-gradient(160deg,#34b476,#1f7a4e)" },
};

export function App() {
  const [vista, setVista] = useState<Vista>("inicio");
  // Apartado que se quiere abrir pero AÚN no autorizado: mientras esté aquí, se
  // muestra el PIN. No guardamos "autorizado" en ningún sitio a propósito: por eso
  // salir y volver a entrar SIEMPRE vuelve a pedir el PIN (control de acceso del bar).
  const [pendiente, setPendiente] = useState<Apartado | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (pendiente) return; // el PIN gestiona su propio teclado
      if (e.key === "Escape") { setVista("inicio"); return; }
      const v = TECLA_A_VISTA[e.key];
      if (v) { e.preventDefault(); setPendiente(v); } // pedir PIN, no entrar aún
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendiente]);

  return (
    <>
      {vista === "inicio" ? (
        <Inicio
          operario={DEMO.operario}
          local={DEMO.local}
          turno={DEMO.turno}
          onNavegar={setPendiente}
          onSalir={() => setVista("inicio")}
          onCambiarUsuario={() => setVista("inicio")}
        />
      ) : (
        <Seccion {...SECCIONES[vista]} onVolver={() => setVista("inicio")} />
      )}

      {pendiente && (
        <PinModal
          titulo={SECCIONES[pendiente].titulo}
          icono={SECCIONES[pendiente].icono}
          color={SECCIONES[pendiente].color}
          onOk={() => { setVista(pendiente); setPendiente(null); }}
          onCancelar={() => setPendiente(null)}
        />
      )}
    </>
  );
}
