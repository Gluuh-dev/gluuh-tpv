import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { Inicio } from "./apartados/inicio/Inicio";

// Los apartados bajan CUANDO SE ABREN. Inicio es lo único del arranque: el TPV de
// un bar arranca en un mini-PC debajo de la barra, no en un portátil de
// desarrollo, y ahí se nota bajar Configuración entera para no mirarla.
const Tpv = lazy(() => import("./apartados/tpv/Tpv").then((m) => ({ default: m.Tpv })));
const Configuracion = lazy(() => import("./apartados/config/Configuracion").then((m) => ({ default: m.Configuracion })));
const Analisis = lazy(() => import("./apartados/analisis/Analisis").then((m) => ({ default: m.Analisis })));
const Administrador = lazy(() => import("./apartados/admin/Administrador").then((m) => ({ default: m.Administrador })));
const VisorNode = lazy(() => import("./apartados/nodo/VisorNode").then((m) => ({ default: m.VisorNode })));
import { CredencialModal } from "./apartados/acceso/CredencialModal";
import { AyudaModal } from "./apartados/ayuda/AyudaModal";
import { APARTADOS } from "./apartados/meta";
import { TecladoEnPantalla } from "./ui";
import { cargarOperarios, validarPin } from "./apartados/acceso/operarios";
import { EQUIPO_DEMO } from "./apartados/acceso/demo";
import type { Usuario } from "./apartados/acceso/tipos";
import { cumpleRol, TECLA_A_VISTA, type Vista, type Apartado, type Rol } from "./lib/nav";
import { useRuta, navegar, rutaDeUrl } from "./lib/rutas";

// Datos DEMO. Se reemplazan por los reales del nodo (identidad del local + jornada
// + operarios del terminal) al cablear la SPA; la forma no cambia.
const DEMO = {
  local: { nombre: "BAR LA ALAMEDA", terminal: "TERMINAL 01" },
  turno: { mesasAbiertas: 12, mesasTotal: 24, ventas: "486,30 €", comandas: 3 },
};
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
  const ruta = useRuta();
  // Apartado que se quiere abrir pero AÚN no autorizado: mientras esté aquí se
  // muestra la credencial. No guardamos "autorizado" a propósito: salir y volver
  // a entrar SIEMPRE vuelve a pedir PIN/pulsera (control de acceso del bar).
  const [pendiente, setPendiente] = useState<Apartado | null>(null);
  const [ayuda, setAyuda] = useState(false);

  // El equipo del terminal: el REAL del nodo si hay sesión de dispositivo;
  // si no (sin emparejar), la demo marcada como ejemplo.
  const [equipo, setEquipo] = useState<{ usuarios: Usuario[]; demo: boolean }>({ usuarios: EQUIPO_DEMO, demo: true });
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

  // ── La URL manda para PEDIR, nunca para entrar ────────────────────────────
  // Escribir /admin o recargar allí pide la credencial igual que pulsar el
  // botón. Si la URL fuera la que abre, un acceso directo se saltaría el PIN
  // del bar: por eso lo que se renderiza sigue siendo `vista`, que solo cambia
  // tras validar.
  useEffect(() => {
    if (ruta.vista === vista) return;
    if (ruta.vista === "inicio") { setVista("inicio"); setPendiente(null); return; }
    abrir(ruta.vista);
    // `abrir` se recrea cada render y meterlo aquí relanzaría el efecto en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta.vista]);

  // Y al revés: lo que se está viendo se refleja en la barra de direcciones.
  useEffect(() => {
    if (rutaDeUrl(window.location.pathname).vista !== vista) navegar({ vista });
  }, [vista]);

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
        ? (
          // Sin pantalla de carga: el fallback es el fondo del apartado. Un
          // "Cargando…" que parpadea 80 ms es más ruido que información.
          <Suspense fallback={<div className="min-h-dvh bg-background" />}>
            <Pantalla onVolver={() => setVista("inicio")} />
          </Suspense>
        )
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
          Icono={meta.Icono}
          color={meta.color}
          requiere={meta.requiere}
          modo="pasos"
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
