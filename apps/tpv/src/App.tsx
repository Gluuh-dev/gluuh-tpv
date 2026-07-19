import { useEffect, useState, type ComponentType } from "react";
import { Inicio } from "./apartados/inicio/Inicio";
import { Tpv } from "./apartados/tpv/Tpv";
import { Configuracion } from "./apartados/config/Configuracion";
import { Analisis } from "./apartados/analisis/Analisis";
import { Administrador } from "./apartados/admin/Administrador";
import { VisorNode } from "./apartados/nodo/VisorNode";
import { CredencialModal } from "./apartados/acceso/CredencialModal";
import { AyudaModal } from "./apartados/ayuda/AyudaModal";
import { APARTADOS } from "./apartados/meta";
import { TecladoEnPantalla } from "./ui";
import { cargarOperarios, validarPin } from "./apartados/acceso/operarios";
import type { Usuario } from "./apartados/acceso/tipos";
import { cumpleRol, TECLA_A_VISTA, type Vista, type Apartado, type Rol } from "./lib/nav";

// Datos DEMO. Se reemplazan por los reales del nodo (identidad del local + jornada
// + operarios del terminal) al cablear la SPA; la forma no cambia.
const DEMO = {
  local: { nombre: "BAR LA ALAMEDA", terminal: "TERMINAL 01" },
  turno: { mesasAbiertas: 12, mesasTotal: 24, ventas: "486,30 €", comandas: 3 },
};
const USUARIOS_DEMO: Usuario[] = [
  { id: "1", nombre: "María Ruiz", rol: "admin" },
  { id: "2", nombre: "Berto Sanz", rol: "operario" },
  { id: "3", nombre: "Lucía Gil", rol: "operario" },
  { id: "4", nombre: "Soporte Gluuh", rol: "tecnico", color: "linear-gradient(150deg,#54E3B1,#159C6E)" },
];

// Una pantalla por apartado (feature-first). Añadir un apartado = un archivo aquí.
const PANTALLAS: Record<Apartado, ComponentType<{ onVolver: () => void }>> = {
  tpv: Tpv,
  config: Configuracion,
  analisis: Analisis,
  admin: Administrador,
  nodo: VisorNode,
};

export function App() {
  const [vista, setVista] = useState<Vista>("inicio");
  // Apartado que se quiere abrir pero AÚN no autorizado: mientras esté aquí se
  // muestra la credencial. No guardamos "autorizado" a propósito: salir y volver
  // a entrar SIEMPRE vuelve a pedir PIN/pulsera (control de acceso del bar).
  const [pendiente, setPendiente] = useState<Apartado | null>(null);
  const [ayuda, setAyuda] = useState(false);

  // El equipo del terminal: el REAL del nodo si hay sesión de dispositivo;
  // si no (sin emparejar), la demo marcada como ejemplo.
  const [equipo, setEquipo] = useState<{ usuarios: Usuario[]; demo: boolean }>({ usuarios: USUARIOS_DEMO, demo: true });
  useEffect(() => {
    cargarOperarios().then((reales) => {
      if (reales?.length) setEquipo({ usuarios: reales, demo: false });
    });
  }, []);

  // La validación de verdad: el PIN identifica en el nodo (con backoff), y aquí
  // se comprueba el rol de la puerta y, si se eligió usuario, que sea él.
  async function validar(pin: string, ctx: { usuario?: Usuario; requiere: Rol }): Promise<boolean> {
    if (equipo.demo) return pin.length === 4; // demo: enseña el flujo, no da acceso real a nada
    const op = await validarPin(pin);
    return !!op && cumpleRol(op.rol, ctx.requiere) && (!ctx.usuario || ctx.usuario.id === op.id);
  }

  // «Abrir TPV» entra DIRECTO (el login por operario ocurre dentro del TPV, por
  // acción); el resto pide credencial CADA vez.
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

  const Pantalla = vista === "inicio" ? null : PANTALLAS[vista];
  const meta = pendiente ? APARTADOS[pendiente] : null;

  return (
    <>
      {Pantalla
        ? <Pantalla onVolver={() => setVista("inicio")} />
        : (
          <Inicio
            local={DEMO.local}
            turno={DEMO.turno}
            onNavegar={abrir}
            onSalir={() => setVista("inicio")}
            onAyuda={() => setAyuda(true)}
          />
        )}

      {pendiente && meta && (
        <CredencialModal
          titulo={meta.titulo}
          icono={<meta.Icono size={22} />}
          color={meta.color}
          requiere={meta.requiere}
          usuarios={equipo.usuarios}
          demo={equipo.demo}
          onValidar={validar}
          onOk={() => { setVista(pendiente); setPendiente(null); }}
          onCancelar={() => setPendiente(null)}
        />
      )}

      {ayuda && (
        <AyudaModal licencia="LA-ALAMEDA-0417" terminal="T01" version="v3.2.0" onCerrar={() => setAyuda(false)} />
      )}

      {/* Teclado en pantalla global (flotante, arrastrable). Se abre por evento
          desde cualquier botón de teclado (abrirTeclado); escribe en el campo enfocado. */}
      <TecladoEnPantalla />
    </>
  );
}
