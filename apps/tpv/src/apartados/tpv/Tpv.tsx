import { useEffect, useMemo, useReducer, useState } from "react";
import { EnObras, Modal } from "../../ui";
import { eur } from "../../lib/dinero";
import { PlanoMesas } from "./PlanoMesas";
import { Venta } from "./Venta";
import { RailSalas } from "./RailSalas";
import { BarraEstado } from "./venta/BarraEstado";
import { CobrarModal } from "./venta/CobrarModal";
import { DividirCuenta } from "./venta/DividirCuenta";
import { InvitacionesModal } from "./venta/InvitacionesModal";
import { ClienteModal } from "./venta/ClienteModal";
import { UtilidadesModal } from "./venta/UtilidadesModal";
import { marcharPendientes } from "./venta/ticket-impresion";
import { VeloBloqueo } from "./VeloBloqueo";
import { AutorizacionModal } from "./AutorizacionModal";
import { SesionTpvProvider } from "./sesion-contexto";
import { reducirSesion, operarioActivo, DORMIDO, type Operario, type EstadoTerminal } from "./sesion";
import { puede as puedeAccion, type Accion, type EstadoPerfil } from "./permisos";
import { cargarOperarios, validarPin } from "../acceso/operarios";
import { EQUIPO_DEMO } from "../acceso/demo";
import type { Usuario } from "../acceso/tipos";
import { useVenta } from "./store";
import { SALAS_DEMO, type Mesa } from "./datos";

// Perfil de permisos del operario, en DEMO. En real lo trae el nodo
// (`app_user.perfil.permisos`, 0048). Aquí, para enseñar el flujo: el admin puede
// todo; un trabajador normal no descuenta ni anula sin que un responsable autorice.
function perfilDemo(op: Operario): EstadoPerfil {
  if (op.rol === "admin") return { estado: "sin-perfil" };
  return { estado: "cargado", permisos: { descuento: false, borrar: false } };
}

// Cuándo baja el velo. Valores de FÁBRICA; al cablear Configuración vendrán de
// getSetting("tpv.bloqueo"). Default: por inactividad y botón, NO tras cada cobro
// (el modo "cada uno cobra lo suyo" se enciende en config si el bar lo quiere).
const BLOQUEO = { alCobrar: false, inactividad: true, segundos: 60 };

// Título del modal aún-en-obras según la función pulsada.
const TITULO_FUNCION: Record<string, string> = {
  cliente: "Cliente", aparcar: "Aparcar cuenta", pasar: "Pasar a mesa", consumo: "Consumo propio",
  dividir: "Dividir cuenta", utilidades: "Utilidades", bloquear: "Bloquear terminal",
  menu: "Componer menú", extra: "Comentarios y extras",
};

function VistaSimple({ titulo, vista, onVista, onInicio, onConfig }: Readonly<{ titulo: string; vista: string; onVista: (v: string) => void; onInicio: () => void; onConfig: () => void }>) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-14 flex-none items-center gap-3 bg-brand px-3 text-white">
        <img src="/logo-gluuh-monocolor.svg" alt="Gluuh" className="h-8 w-auto" draggable={false} />
        <span className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-bold">{titulo}</span>
      </header>
      <div className="flex min-h-0 flex-1">
        <EnObras titulo={titulo} />
        <RailSalas vista={vista} onVista={onVista} onConfig={onConfig} />
      </div>
    </div>
  );
}

// La OPERATIVA: shell con la barra de estado COMÚN a todas las páginas y el rail
// persistente. `vista` = "ticket" (venta) · "aparcado" · id de sala (plano) ·
// "llevar" · "reservas". Catálogo y cobro demo; se cablean al nodo por fases.
export function Tpv({ onVolver, operarioInicial }: Readonly<{ onVolver: () => void; operarioInicial?: Operario }>) {
  const [vista, setVista] = useState<string>(SALAS_DEMO[0]!.id);
  const [zurdo, setZurdo] = useState(() => (typeof localStorage !== "undefined" && localStorage.getItem("gluuh_zurdo") === "1"));
  const [modal, setModal] = useState<string | null>(null);
  const [cobrado, setCobrado] = useState<string | null>(null);

  // ── Sesión del terminal: quién opera, y el velo ──────────────────────────
  // Hereda el operario del hub (`operarioInicial`): entras ya identificado. Si
  // llegas sin sesión (deep-link directo al TPV), arranca DORMIDO y el velo pide
  // PIN. El velo tapa la venta mientras no haya operario activo, pero la cuenta
  // sigue viva debajo.
  const inicial: EstadoTerminal = operarioInicial ? { fase: "activo", operario: operarioInicial } : DORMIDO;
  const [sesion, despachar] = useReducer(reducirSesion, inicial);
  const activo = operarioActivo(sesion);
  const nombreOp = activo?.nombre ?? "";
  const [equipo, setEquipo] = useState<{ usuarios: Usuario[]; demo: boolean }>({ usuarios: EQUIPO_DEMO, demo: true });
  useEffect(() => {
    cargarOperarios().then((reales) => { if (reales?.length) setEquipo({ usuarios: reales, demo: false }); });
  }, []);

  // Velo por inactividad: al pasar los segundos configurados sin tocar la
  // pantalla, cae el velo (la cuenta no se pierde). Cada toque reinicia la cuenta.
  useEffect(() => {
    if (!activo || !BLOQUEO.inactividad) return;
    let id = 0;
    const rearmar = () => {
      clearTimeout(id);
      id = window.setTimeout(() => despachar({ tipo: "bloquear" }), BLOQUEO.segundos * 1000);
    };
    rearmar();
    for (const ev of ["pointerdown", "keydown"] as const) window.addEventListener(ev, rearmar);
    return () => {
      clearTimeout(id);
      for (const ev of ["pointerdown", "keydown"] as const) window.removeEventListener(ev, rearmar);
    };
  }, [activo]);

  // ── Permisos y autorización de un responsable ────────────────────────────
  const perfil = activo ? perfilDemo(activo) : null;
  // Acción sensible esperando el PIN de un responsable (o null si no hay ninguna).
  const [autoriz, setAutoriz] = useState<{ accion: Accion; alConceder: () => void } | null>(null);
  const sesionTpv = useMemo(() => ({
    puede: (accion: Accion) => !!activo && puedeAccion(activo.rol, perfil ?? { estado: "sin-cargar" }, accion),
    // Hace la acción si el operario puede; si no, guarda el callback y abre la
    // puerta de autorización — la acción NO ocurre hasta que un admin mete el PIN.
    hacer: (accion: Accion, alConceder: () => void) => {
      if (activo && puedeAccion(activo.rol, perfil ?? { estado: "sin-cargar" }, accion)) alConceder();
      else setAutoriz({ accion, alConceder });
    },
  }), [activo, perfil]);
  const iniciar = useVenta((s) => s.iniciar);
  const vaciar = useVenta((s) => s.vaciar);
  const contexto = useVenta((s) => s.contexto);
  const comensales = useVenta((s) => s.comensales);
  const total = useVenta((s) => s.total());

  useEffect(() => {
    if (!cobrado) return;
    const t = setTimeout(() => setCobrado(null), 2600);
    return () => clearTimeout(t);
  }, [cobrado]);

  const cambiarZurdo = (v: boolean) => { setZurdo(v); localStorage.setItem("gluuh_zurdo", v ? "1" : "0"); };
  const abrirMesa = (mesa: Mesa) => { iniciar(`Mesa ${mesa.nombre}`, mesa.comensales ?? 1, SALAS_DEMO.find((s) => s.id === vista)?.nombre ?? ""); setVista("ticket"); };
  const nuevaBarra = () => { iniciar("Barra", 1, "Barra"); setVista("ticket"); };
  const cobrar = (metodo: string) => {
    setCobrado(`Cobrado ${eur(total)} · ${metodo === "EFECTIVO" ? "Contado" : metodo}`); vaciar(); setModal(null); setVista(SALAS_DEMO[0]!.id);
    // Modo "cada uno cobra lo suyo": tras cerrar la cuenta, vuelve el velo.
    if (BLOQUEO.alCobrar) despachar({ tipo: "bloquear" });
  };
  // Mesa saldada tras dividir (todas las partes cobradas): cierra la mesa y vuelve al plano.
  const mesaSaldada = () => { setCobrado("Mesa cobrada · cuenta dividida"); vaciar(); setModal(null); setVista(SALAS_DEMO[0]!.id); };

  // Marchar: manda a cocina/barra SOLO lo pendiente (lo añadido desde la última
  // vez), una impresión por estación. NO cobra ni vacía: la cuenta sigue abierta.
  const marchar = () => {
    const est = marcharPendientes({ operario: nombreOp });
    setCobrado(est.length ? `Marchado a ${est.join(" y ")}` : "No hay nada nuevo que marchar");
  };
  // "Bloquear" (utilidad o botón de la barra) baja el velo a mano; la cuenta queda.
  const onFuncion = (f: string) => { if (f === "marchar") { marchar(); return; } if (f === "bloquear") { despachar({ tipo: "bloquear" }); return; } setModal(f); };

  const esSala = SALAS_DEMO.some((s) => s.id === vista);

  let contenido;
  if (vista === "ticket") {
    contenido = <Venta operario={nombreOp} vista={vista} zurdo={zurdo} onVista={setVista} onConfig={onVolver} onCobrar={() => setModal("cobrar")} onFuncion={onFuncion} />;
  } else if (esSala) {
    contenido = <PlanoMesas vista={vista} onVista={setVista} onConfig={onVolver} onAbrirMesa={abrirMesa} onNuevaBarra={nuevaBarra} onInicio={onVolver} operario={nombreOp} />;
  } else {
    const titulo = vista === "aparcado" ? "Aparcado" : (vista === "llevar" ? "Para llevar" : "Reservas");
    contenido = <VistaSimple titulo={titulo} vista={vista} onVista={setVista} onInicio={onVolver} onConfig={onVolver} />;
  }

  return (
    <SesionTpvProvider value={sesionTpv}>
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{contenido}</div>
      <BarraEstado operario={nombreOp} terminal="TERMINAL 01" contexto={contexto} zurdo={zurdo} onZurdo={cambiarZurdo}
        onBloquear={() => despachar({ tipo: "bloquear" })} />

      {modal === "cobrar" && <CobrarModal total={total} contexto={contexto} onCerrar={() => setModal(null)} onCobrado={cobrar} onDividir={() => setModal("dividir")} />}
      {modal === "invitar" && <InvitacionesModal onCerrar={() => setModal(null)} />}
      {modal === "cliente" && <ClienteModal onCerrar={() => setModal(null)} />}
      {modal === "utilidades" && <UtilidadesModal onCerrar={() => setModal(null)} onFuncion={onFuncion} />}
      {/* Dividir cuenta: centro de mando del reparto; el cobro de cada parte se abre encima. */}
      {modal === "dividir" && <DividirCuenta contexto={contexto} comensales={comensales} onCerrar={() => setModal(null)} onSaldada={mesaSaldada} />}
      {modal && !["cobrar", "invitar", "cliente", "utilidades", "dividir"].includes(modal) && (
        <Modal onCerrar={() => setModal(null)} ancho="md" className="p-7">
          <div className="flex min-h-[220px] flex-col">
            <h2 className="mb-1 font-display text-xl font-bold">{TITULO_FUNCION[modal] ?? modal}</h2>
            <EnObras titulo={TITULO_FUNCION[modal] ?? modal} />
            <button type="button" onClick={() => setModal(null)} className="btn-ghost mt-4">Cerrar</button>
          </div>
        </Modal>
      )}

      {cobrado && (
        <div className="gl-aparecer fixed bottom-16 left-1/2 z-40 -translate-x-1/2 rounded-full bg-mint px-6 py-3 font-bold text-[#053a26] shadow-md">{cobrado}</div>
      )}

      {/* El velo tapa el TPV mientras no haya operario activo: al ARRANCAR (dormido,
          pide identificarse) y al BLOQUEAR (velado, la cuenta sigue viva debajo).
          "Salir" cierra el turno y vuelve al Inicio. */}
      {!activo && (
        <VeloBloqueo
          bloqueadoPor={sesion.fase === "velado" ? sesion.operario : null}
          usuarios={equipo.usuarios}
          demo={equipo.demo}
          validarPin={validarPin}
          onEntra={(quien) => despachar(sesion.fase === "velado" ? { tipo: "desbloquear", operario: quien } : { tipo: "identificar", operario: quien })}
          onSalir={() => { despachar({ tipo: "salir" }); onVolver(); }}
        />
      )}

      {/* Autorización de un responsable para una acción que el operario no puede.
          Al conceder, se ejecuta la acción; el operario activo NO cambia. */}
      {autoriz && (
        <AutorizacionModal
          accion={autoriz.accion}
          usuarios={equipo.usuarios}
          demo={equipo.demo}
          validarPin={validarPin}
          onConcedido={() => { autoriz.alConceder(); setAutoriz(null); }}
          onCancelar={() => setAutoriz(null)}
        />
      )}
    </div>
    </SesionTpvProvider>
  );
}
