import { useState, type ReactNode } from "react";
import {
  Users, ShieldCheck, Clock, BadgeCheck, Building2, Nfc, KeyRound, Check, X, UserPlus, Search,
} from "lucide-react";
import { ShellApartado, BarraSeccion, Caja, type SeccionShell } from "../../ui";
import { iniciales } from "../acceso/tipos";

// ADMINISTRADOR — lo del DUEÑO: quién trabaja aquí y con qué permisos, turnos,
// licencia y datos fiscales. Estructura de app (barra 56px + lateral plegable) y
// EMPLEADOS en maestro-detalle, como el mockup `docs/diseño/gluuh-empleados.html`.
// Datos DEMO con la forma de `app_user` / `perfil` / `tenant`.

const SECCIONES: readonly SeccionShell[] = [
  { id: "empleados", label: "Empleados", Icono: Users },
  { id: "permisos", label: "Perfiles y permisos", Icono: ShieldCheck },
  { id: "turnos", label: "Turnos", Icono: Clock },
  { id: "licencia", label: "Licencia", Icono: BadgeCheck },
  { id: "local", label: "Datos del local", Icono: Building2 },
];

interface Empleado {
  id: string; nombre: string; usuario: string; email: string; rol: string; perfil: string;
  pin: boolean; pulsera: boolean; activo: boolean; alta: string; color?: string;
}

const EMPLEADOS: Empleado[] = [
  { id: "1", nombre: "María Ruiz", usuario: "maria", email: "maria@laalameda.es", rol: "ENCARGADO", perfil: "Encargado", pin: true, pulsera: true, activo: true, alta: "12-03-2024", color: "linear-gradient(150deg,var(--brand-lit),var(--brand))" },
  { id: "2", nombre: "Berto Sanz", usuario: "berto", email: "berto@laalameda.es", rol: "CAMARERO", perfil: "Sala", pin: true, pulsera: false, activo: true, alta: "04-09-2024" },
  { id: "3", nombre: "Lucía Gil", usuario: "lucia", email: "lucia@laalameda.es", rol: "CAMARERO", perfil: "Sala", pin: true, pulsera: true, activo: true, alta: "21-01-2025" },
  { id: "4", nombre: "Iván Pérez", usuario: "ivan", email: "ivan@laalameda.es", rol: "COCINA", perfil: "Cocina", pin: true, pulsera: false, activo: false, alta: "15-06-2023" },
];

const TURNOS = [
  { nombre: "Desayunos", desde: "07:00", hasta: "11:30", gente: 2 },
  { nombre: "Comidas", desde: "12:00", hasta: "16:30", gente: 5 },
  { nombre: "Tardes", desde: "16:30", hasta: "20:00", gente: 2 },
  { nombre: "Cenas", desde: "20:00", hasta: "00:30", gente: 4 },
];

const PERMISOS = ["Cobrar", "Descuentos", "Anular líneas", "Invitar", "Abrir cajón", "Configuración"] as const;
const PERFILES: { nombre: string; gente: number; permisos: boolean[] }[] = [
  { nombre: "Encargado", gente: 1, permisos: [true, true, true, true, true, true] },
  { nombre: "Sala", gente: 2, permisos: [true, false, true, true, false, false] },
  { nombre: "Cocina", gente: 1, permisos: [false, false, false, false, false, false] },
];

const TH = "sticky top-0 z-10 bg-panel px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-muted";
const TD = "px-3 py-2.5 text-[13px]";

function Campo({ label, valor }: Readonly<{ label: string; valor: ReactNode }>) {
  return (
    <div>
      <span className="mb-1 block text-[11.5px] font-semibold text-muted">{label}</span>
      <div className="flex min-h-10 items-center rounded-lg border border-line bg-paper/3 px-3 text-[13.5px] font-semibold">{valor}</div>
    </div>
  );
}

function Btn({ children, onClick }: Readonly<{ children: ReactNode; onClick?: () => void }>) {
  return (
    <button type="button" onClick={onClick}
      className="flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[12.5px] font-semibold text-paper/85 transition-transform active:scale-95">
      {children}
    </button>
  );
}

export function Administrador({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const [seccion, setSeccion] = useState("empleados");
  const [selId, setSelId] = useState(EMPLEADOS[0]!.id);
  const [busca, setBusca] = useState("");

  const lista = EMPLEADOS.filter((e) => e.nombre.toLowerCase().includes(busca.trim().toLowerCase()));
  const sel = EMPLEADOS.find((e) => e.id === selId) ?? EMPLEADOS[0]!;

  return (
    <ShellApartado titulo="Administrador" claveLateral="admin" secciones={SECCIONES}
      seccion={seccion} onSeccion={setSeccion} onVolver={onVolver}>

      {seccion === "empleados" && (
        <>
          <BarraSeccion titulo="Empleados" sub={`${EMPLEADOS.filter((e) => e.activo).length} activos de ${EMPLEADOS.length}`}>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…"
                className="h-9 w-44 rounded-lg border border-line bg-panel pl-8 pr-2 text-[13px] text-paper placeholder:text-muted focus:border-brand-lit focus:outline-none" />
            </div>
            <Btn><UserPlus size={14} /> Nuevo</Btn>
          </BarraSeccion>

          {/* Maestro-detalle: lista a la izquierda, ficha a la derecha */}
          <div className="flex min-h-0 flex-1">
            <div className="w-72 flex-none space-y-1 overflow-y-auto border-r border-line p-2">
              {lista.map((e) => {
                const activa = e.id === sel.id;
                return (
                  <button key={e.id} type="button" onClick={() => setSelId(e.id)}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-lg px-2.5 text-left transition-transform active:scale-[.98] ${
                      activa ? "bg-brand text-white" : ""
                    } ${e.activo ? "" : "opacity-55"}`}>
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-full text-[12.5px] font-bold text-white"
                      style={{ background: e.color ?? "linear-gradient(150deg,var(--brand-lit),var(--brand))" }}>
                      {iniciales(e.nombre)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13.5px] font-semibold">{e.nombre}</b>
                      <span className={`text-[11.5px] ${activa ? "text-white/75" : "text-muted"}`}>{e.perfil}{e.activo ? "" : " · de baja"}</span>
                    </span>
                  </button>
                );
              })}
              {lista.length === 0 && <p className="px-2 py-6 text-center text-[13px] text-muted">Nadie con ese nombre.</p>}
            </div>

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3">
              {/* Cinta del empleado */}
              <div className="flex items-center gap-3.5 rounded-xl border border-line bg-panel px-4 py-3">
                <span className="grid h-11 w-11 flex-none place-items-center rounded-full text-[15px] font-bold text-white"
                  style={{ background: sel.color ?? "linear-gradient(150deg,var(--brand-lit),var(--brand))" }}>
                  {iniciales(sel.nombre)}
                </span>
                <span className="mr-auto min-w-0">
                  <b className="block truncate font-display text-[17px] font-extrabold leading-tight">{sel.nombre}</b>
                  <span className="text-[12px] text-muted">{sel.rol} · perfil {sel.perfil} · alta {sel.alta}</span>
                </span>
                <Btn><KeyRound size={14} /> Cambiar PIN</Btn>
                <Btn><Nfc size={14} /> Pulsera</Btn>
                <Btn>{sel.activo ? "Dar de baja" : "Reactivar"}</Btn>
              </div>

              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                <Caja titulo="Identidad">
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Nombre" valor={sel.nombre} />
                    <Campo label="Usuario" valor={sel.usuario} />
                    <Campo label="Email" valor={<span className="truncate">{sel.email}</span>} />
                    <Campo label="Alta" valor={sel.alta} />
                  </div>
                </Caja>

                <Caja titulo="Acceso y permisos">
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Rol" valor={sel.rol} />
                    <Campo label="Perfil" valor={sel.perfil} />
                    <Campo label="PIN" valor={sel.pin ? <span className="flex items-center gap-1.5"><KeyRound size={13} className="text-mint" /> Configurado</span> : "Sin PIN"} />
                    <Campo label="Pulsera" valor={sel.pulsera ? <span className="flex items-center gap-1.5"><Nfc size={13} className="text-brand-lit" /> Asignada</span> : "Sin pulsera"} />
                  </div>
                  <p className="mt-3 text-[12px] leading-relaxed text-muted">
                    El <b className="font-semibold text-paper/80">perfil</b> manda sobre el rol: el nodo valida
                    cada acción sensible contra sus permisos.
                  </p>
                </Caja>
              </div>
            </div>
          </div>
        </>
      )}

      {seccion === "permisos" && (
        <>
          <BarraSeccion titulo="Perfiles y permisos" sub={`${PERFILES.length} perfiles`} />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <Caja titulo="Qué puede hacer cada perfil">
              <div className="overflow-x-auto">
                <table className="w-full min-w-140 border-collapse">
                  <thead>
                    <tr>
                      <th className={TH}>Perfil</th>
                      <th className={`${TH} text-right`}>Personas</th>
                      {PERMISOS.map((p) => <th key={p} className={`${TH} text-center`}>{p}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {PERFILES.map((pf) => (
                      <tr key={pf.nombre} className="border-t border-line">
                        <td className={`${TD} font-semibold`}>{pf.nombre}</td>
                        <td className={`${TD} text-right tabular-nums text-muted`}>{pf.gente}</td>
                        {pf.permisos.map((ok, i) => (
                          <td key={PERMISOS[i]} className={`${TD} text-center`}>
                            {ok ? <Check size={15} className="mx-auto text-mint" /> : <X size={14} className="mx-auto text-muted/50" />}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Caja>
          </div>
        </>
      )}

      {seccion === "turnos" && (
        <>
          <BarraSeccion titulo="Turnos" sub="Periodos de servicio del día" />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <Caja titulo="Periodos de servicio" contador={`${TURNOS.length} turnos`}>
              <table className="w-full border-collapse">
                <thead><tr><th className={TH}>Turno</th><th className={TH}>Desde</th><th className={TH}>Hasta</th><th className={`${TH} text-right`}>Personas</th></tr></thead>
                <tbody>
                  {TURNOS.map((t) => (
                    <tr key={t.nombre} className="border-t border-line">
                      <td className={`${TD} font-semibold`}>{t.nombre}</td>
                      <td className={`${TD} font-mono tabular-nums`}>{t.desde}</td>
                      <td className={`${TD} font-mono tabular-nums`}>{t.hasta}</td>
                      <td className={`${TD} text-right tabular-nums`}>{t.gente}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                Los turnos agrupan las ventas por franja (salen en Análisis) y marcan qué
                periodo de servicio está activo en el TPV.
              </p>
            </Caja>
          </div>
        </>
      )}

      {seccion === "licencia" && (
        <>
          <BarraSeccion titulo="Licencia" sub="Plan, terminales y versiones" />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="grid gap-3 xl:grid-cols-2">
              <Caja titulo="Licencia de este local">
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Licencia" valor="LA-ALAMEDA-0417" />
                  <Campo label="Plan" valor="Gluuh Hostelería" />
                  <Campo label="Terminales" valor="4 de 6 usados" />
                  <Campo label="Renovación" valor="01-01-2027" />
                </div>
              </Caja>
              <Caja titulo="Versiones y soporte">
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="TPV" valor="v3.2.0" />
                  <Campo label="Servidor" valor="v2.4.1" />
                  <Campo label="Soporte" valor="soporte@gluuh.com" />
                  <Campo label="Teléfono" valor="900 000 000" />
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-muted">
                  El estado del servidor y sus actualizaciones están en Visor Node.
                </p>
              </Caja>
            </div>
          </div>
        </>
      )}

      {seccion === "local" && (
        <>
          <BarraSeccion titulo="Datos del local" sub="Identidad fiscal del negocio" />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="grid gap-3 xl:grid-cols-2">
              <Caja titulo="Datos fiscales">
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Nombre comercial" valor="Bar La Alameda" />
                  <Campo label="Razón social" valor="La Alameda Hostelería S.L." />
                  <Campo label="CIF" valor="B00000000" />
                  <Campo label="Teléfono" valor="922 000 000" />
                </div>
                <div className="mt-3"><Campo label="Dirección" valor="C/ Mayor 1 · 38002 Santa Cruz de La Palma" /></div>
              </Caja>
              <Caja titulo="Fiscalidad">
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Territorio" valor="Canarias (IGIC)" />
                  <Campo label="Serie" valor="A · 2026" />
                  <Campo label="VERIFACTU" valor={<span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber" /> Modo prueba</span>} />
                  <Campo label="Tipos" valor="7 % / 3 %" />
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-muted">
                  El territorio decide los tipos de toda la carta: se deduce del código postal
                  y recalcula los precios, así que se cambia con el local cerrado.
                </p>
              </Caja>
            </div>
          </div>
        </>
      )}
    </ShellApartado>
  );
}
