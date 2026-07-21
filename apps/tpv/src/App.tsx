import { lazy, Suspense, useEffect, useReducer, useState, type ComponentType, type ReactNode } from "react";
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
import { TecladoEnPantalla, Cargando } from "./ui";
import { cargarOperarios, validarPin } from "./apartados/acceso/operarios";
import { EQUIPO_DEMO } from "./apartados/acceso/demo";
import { cargarInicio, type DatosInicio } from "./apartados/inicio/datos";
import { reducirSesion, operarioActivo, DORMIDO } from "./apartados/tpv/sesion";
import type { Usuario } from "./apartados/acceso/tipos";
import { cumpleRol, TECLA_A_VISTA, type Vista, type Apartado, type Rol } from "./lib/nav";
import { useRuta, navegar } from "./lib/rutas";

// Datos DEMO. Se reemplazan por los reales del nodo (identidad del local + jornada
// + operarios del terminal) al cablear la SPA; la forma no cambia.
const DEMO = {
  local: { nombre: "BAR LA ALAMEDA", terminal: "TERMINAL 01" },
  turno: { mesasAbiertas: 12, mesasTotal: 24, ventas: "486,30 €", comandas: 3 },
};
// Una pantalla por apartado (feature-first). Añadir un apartado = un archivo aquí.
// El TPV se renderiza aparte (hereda el operario de la sesión), así que no va aquí.
const PANTALLAS: Record<Exclude<Apartado, "tpv">, ComponentType<{ onVolver: () => void }>> = {
  config: Configuracion,
  analisis: Analisis,
  admin: Administrador,
  nodo: VisorNode,
};

export function App() {
  const [vista, setVista] = useState<Vista>("inicio");
  const ruta = useRuta();

  // ── Sesión del terminal (el HUB) ──────────────────────────────────────────
  // Ya no se pide PIN en cada apartado: te identificas UNA vez y navegas lo que
  // tu rol permita; lo que no, sale atenuado. La sesión dura hasta "Cerrar
  // sesión" (a mano). El TPV es aparte: hereda quién eres, pero tiene su propio
  // velo automático (por cobro, por cuenta o por tiempo) — eso vive dentro del TPV.
  const [sesion, despachar] = useReducer(reducirSesion, DORMIDO);
  const usuario = operarioActivo(sesion);
  // Puerta abierta esperando identificación: `destino` es a dónde ir tras entrar
  // (null = solo identificarse y quedarse en el hub). El login es GENÉRICO: te
  // identificas con tu PIN aunque el sitio que pulsaste no sea para tu rol —
  // quedas logueado y el hub te enseña lo que SÍ puedes.
  const [login, setLogin] = useState<{ destino: Apartado | null } | null>(null);
  const [ayuda, setAyuda] = useState(false);

  // El equipo del terminal: el REAL del nodo si hay sesión de dispositivo;
  // si no (sin emparejar), la demo marcada como ejemplo.
  const [equipo, setEquipo] = useState<{ usuarios: Usuario[]; demo: boolean }>({ usuarios: EQUIPO_DEMO, demo: true });
  useEffect(() => {
    cargarOperarios().then((reales) => { if (reales?.length) setEquipo({ usuarios: reales, demo: false }); });
  }, []);

  // Identidad del local y KPIs del turno. Con terminal emparejado salen del nodo
  // (nombre real, ventas del día…); sin él, se queda la demo de abajo.
  const [inicio, setInicio] = useState<DatosInicio | null>(null);
  useEffect(() => { cargarInicio().then((d) => { if (d) setInicio(d); }); }, []);

  // La validación de verdad: el PIN identifica en el nodo (con backoff), y aquí
  // se comprueba el rol de la puerta y, si se eligió usuario, que sea él.
  async function validar(pin: string, ctx: { usuario?: Usuario; requiere: Rol }): Promise<boolean> {
    if (equipo.demo) return pin.length === 4; // demo: enseña el flujo, no da acceso real a nada
    const op = await validarPin(pin);
    return !!op && cumpleRol(op.rol, ctx.requiere) && (!ctx.usuario || ctx.usuario.id === op.id);
  }

  const irVista = (v: Vista) => { setVista(v); navegar({ vista: v }); };

  // Abrir un apartado. Sin sesión, pide identificarse (y recuerda a dónde iba).
  // Con sesión, entra directo si el rol llega; si no llega, no hace nada (la
  // tarjeta ya sale atenuada, pero por F-key o URL podría llegar aquí igualmente).
  const abrir = (v: Apartado) => {
    if (!usuario) { setLogin({ destino: v }); return; }
    if (cumpleRol(usuario.rol, APARTADOS[v].requiere)) irVista(v);
  };

  // ¿La tarjeta de un apartado se puede pulsar? Anónimo: sí (lleva al login).
  // Logueado: solo si el rol llega; si no, atenuada.
  const permitido = (v: Apartado) => !usuario || cumpleRol(usuario.rol, APARTADOS[v].requiere);

  const cerrarSesion = () => { despachar({ tipo: "salir" }); irVista("inicio"); };

  // ── La URL manda para PEDIR, nunca para entrar ────────────────────────────
  useEffect(() => {
    if (ruta.vista === vista) return;
    if (ruta.vista === "inicio") { setVista("inicio"); setLogin(null); return; }
    abrir(ruta.vista);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruta.vista]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (login || ayuda) return; // el modal gestiona su propio teclado
      if (e.key === "Escape") { irVista("inicio"); return; }
      const v = TECLA_A_VISTA[e.key];
      if (v) { e.preventDefault(); abrir(v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [login, ayuda]);

  // Fallback mientras baja el código del apartado. `Cargando` no parpadea: solo
  // se pinta si de verdad tarda (retardo interno), así una carga rápida ni la ve.
  let contenido: ReactNode;
  if (vista === "tpv") {
    // El TPV hereda el operario del hub (`operarioInicial`): al entrar ya estás
    // dentro, sin re-pedir PIN. Su velo automático (cobro/cuenta/tiempo) es suyo.
    contenido = <Suspense fallback={<Cargando etiqueta="el TPV" />}><Tpv onVolver={() => irVista("inicio")} operarioInicial={usuario ?? undefined} /></Suspense>;
  } else if (vista !== "inicio") {
    const Pantalla = PANTALLAS[vista];
    contenido = <Suspense fallback={<Cargando etiqueta={APARTADOS[vista].titulo} />}><Pantalla onVolver={() => irVista("inicio")} /></Suspense>;
  } else {
    contenido = (
      <Inicio
        local={inicio?.local ?? DEMO.local}
        turno={inicio?.turno ?? DEMO.turno}
        demo={inicio === null}
        usuario={usuario}
        permitido={permitido}
        onNavegar={abrir}
        onIdentificarse={() => setLogin({ destino: null })}
        onCerrarSesion={cerrarSesion}
        onAyuda={() => setAyuda(true)}
      />
    );
  }

  return (
    <>
      {contenido}

      {login && !usuario && (
        <CredencialModal
          titulo="Iniciar sesión"
          Icono={APARTADOS.tpv.Icono}
          color="var(--brand)"
          requiere="operario"
          modo="pasos"
          usuarios={equipo.usuarios}
          demo={equipo.demo}
          onValidar={validar}
          onOk={(u) => {
            // Identificado: quedas logueado con tu rol. Vas al destino SOLO si tu
            // rol llega; si no, te quedas en el hub viendo lo que sí puedes.
            if (u) despachar({ tipo: "identificar", operario: u });
            const d = login.destino;
            if (u && d && cumpleRol(u.rol, APARTADOS[d].requiere)) irVista(d);
            setLogin(null);
          }}
          onCancelar={() => setLogin(null)}
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
