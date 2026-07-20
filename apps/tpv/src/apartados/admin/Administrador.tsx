import { useState } from "react";
import {
  Users, ShieldCheck, Clock, BadgeCheck, Building2, Nfc, KeyRound, Check, X, Plus, Search,
} from "lucide-react";
import { ShellApartado, Boton, Tarjeta, Campo, R, RC, TH, TD, type SeccionShell } from "../../ui";
import { iniciales } from "../acceso/tipos";

// ADMINISTRADOR — lo del DUEÑO: quién trabaja aquí y con qué permisos, turnos,
// licencia y datos fiscales. Usa el shell de gestión (lateral a toda altura,
// barra de 60px, controles compactos). Datos DEMO con la forma de
// `app_user` / `perfil` / `tenant`.

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

const SUB: Record<string, string> = {
  permisos: `${PERFILES.length} perfiles`,
  turnos: `${TURNOS.length} periodos de servicio`,
  licencia: "Plan, terminales y versiones",
  local: "Identidad fiscal del negocio",
};

export function Administrador({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const [seccion, setSeccion] = useState("empleados");
  const [selId, setSelId] = useState(EMPLEADOS[0]!.id);
  const [busca, setBusca] = useState("");

  const lista = EMPLEADOS.filter((e) => e.nombre.toLowerCase().includes(busca.trim().toLowerCase()));
  const sel = EMPLEADOS.find((e) => e.id === selId) ?? EMPLEADOS[0]!;
  const activos = EMPLEADOS.filter((e) => e.activo).length;

  const acciones = seccion === "empleados" ? (
    <>
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empleado…"
          className={`h-8 w-56 ${R} border border-line bg-background pl-8 pr-2.5 text-[12.5px] text-paper placeholder:text-muted focus:border-brand-lit focus:outline-none`} />
      </div>
      <Boton primario><Plus size={14} /> Nuevo empleado</Boton>
    </>
  ) : undefined;

  return (
    <ShellApartado app="Administrador" claveLateral="admin" secciones={SECCIONES}
      seccion={seccion} onSeccion={setSeccion} onVolver={onVolver}
      subtitulo={seccion === "empleados" ? `${activos} activos de ${EMPLEADOS.length}` : SUB[seccion]}
      acciones={acciones}>

      {seccion === "empleados" && (
        <div className="flex min-h-full">
          {/* Maestro */}
          <div className="w-64 flex-none border-r border-line p-2">
            {lista.map((e) => {
              const activa = e.id === sel.id;
              return (
                <button key={e.id} type="button" onClick={() => setSelId(e.id)}
                  className={`mb-0.5 flex h-12 w-full items-center gap-2.5 ${R} px-2 text-left transition-colors ${
                    activa ? "bg-paper/8" : ""
                  } ${e.activo ? "" : "opacity-55"}`}>
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: e.color ?? "linear-gradient(150deg,var(--brand-lit),var(--brand))" }}>
                    {iniciales(e.nombre)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className={`block truncate text-[12.5px] ${activa ? "font-semibold" : "font-medium"}`}>{e.nombre}</b>
                    <span className="text-[11px] text-muted">{e.perfil}{e.activo ? "" : " · de baja"}</span>
                  </span>
                </button>
              );
            })}
            {lista.length === 0 && <p className="px-2 py-6 text-center text-[12.5px] text-muted">Nadie con ese nombre.</p>}
          </div>

          {/* Detalle */}
          <div className="min-w-0 flex-1 space-y-3 p-4">
            <div className={`flex items-center gap-3 ${RC} border border-line bg-panel px-4 py-3`}>
              <span className="grid h-9 w-9 flex-none place-items-center rounded-full text-[13px] font-bold text-white"
                style={{ background: sel.color ?? "linear-gradient(150deg,var(--brand-lit),var(--brand))" }}>
                {iniciales(sel.nombre)}
              </span>
              <span className="mr-auto min-w-0">
                <b className="block truncate text-[14.5px] font-semibold leading-tight">{sel.nombre}</b>
                <span className="text-[11.5px] text-muted">{sel.rol} · perfil {sel.perfil} · alta {sel.alta}</span>
              </span>
              <Boton><KeyRound size={14} /> Cambiar PIN</Boton>
              <Boton><Nfc size={14} /> Pulsera</Boton>
              <Boton>{sel.activo ? "Dar de baja" : "Reactivar"}</Boton>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              <Tarjeta titulo="Identidad">
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Nombre" valor={sel.nombre} />
                  <Campo label="Usuario" valor={sel.usuario} />
                  <Campo label="Email" valor={<span className="truncate">{sel.email}</span>} />
                  <Campo label="Alta" valor={sel.alta} />
                </div>
              </Tarjeta>

              <Tarjeta titulo="Acceso y permisos">
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Rol" valor={sel.rol} />
                  <Campo label="Perfil" valor={sel.perfil} />
                  <Campo label="PIN" valor={sel.pin ? <span className="flex items-center gap-1.5"><KeyRound size={12} className="text-mint" /> Configurado</span> : "Sin PIN"} />
                  <Campo label="Pulsera" valor={sel.pulsera ? <span className="flex items-center gap-1.5"><Nfc size={12} className="text-brand-lit" /> Asignada</span> : "Sin pulsera"} />
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-muted">
                  El <b className="font-medium text-paper/80">perfil</b> manda sobre el rol: el nodo valida
                  cada acción sensible contra sus permisos.
                </p>
              </Tarjeta>
            </div>
          </div>
        </div>
      )}

      {seccion === "permisos" && (
        <div className="p-4">
          <Tarjeta titulo="Qué puede hacer cada perfil">
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
                    <tr key={pf.nombre} className="border-b border-line">
                      <td className={`${TD} font-medium`}>{pf.nombre}</td>
                      <td className={`${TD} text-right tabular-nums text-muted`}>{pf.gente}</td>
                      {pf.permisos.map((ok, i) => (
                        <td key={PERMISOS[i]} className={`${TD} text-center`}>
                          {ok ? <Check size={14} className="mx-auto text-mint" /> : <X size={13} className="mx-auto text-muted/50" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        </div>
      )}

      {seccion === "turnos" && (
        <div className="p-4">
          <Tarjeta titulo="Periodos de servicio">
            <table className="w-full border-collapse">
              <thead><tr><th className={TH}>Turno</th><th className={TH}>Desde</th><th className={TH}>Hasta</th><th className={`${TH} text-right`}>Personas</th></tr></thead>
              <tbody>
                {TURNOS.map((t) => (
                  <tr key={t.nombre} className="border-b border-line">
                    <td className={`${TD} font-medium`}>{t.nombre}</td>
                    <td className={`${TD} tabular-nums text-muted`}>{t.desde}</td>
                    <td className={`${TD} tabular-nums text-muted`}>{t.hasta}</td>
                    <td className={`${TD} text-right tabular-nums`}>{t.gente}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              Los turnos agrupan las ventas por franja (salen en Análisis) y marcan qué
              periodo de servicio está activo en el TPV.
            </p>
          </Tarjeta>
        </div>
      )}

      {seccion === "licencia" && (
        <div className="grid gap-3 p-4 xl:grid-cols-2">
          <Tarjeta titulo="Licencia de este local">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Licencia" valor="LA-ALAMEDA-0417" />
              <Campo label="Plan" valor="Gluuh Hostelería" />
              <Campo label="Terminales" valor="4 de 6 usados" />
              <Campo label="Renovación" valor="01-01-2027" />
            </div>
          </Tarjeta>
          <Tarjeta titulo="Versiones y soporte">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="TPV" valor="v3.2.0" />
              <Campo label="Servidor" valor="v2.4.1" />
              <Campo label="Soporte" valor="soporte@gluuh.com" />
              <Campo label="Teléfono" valor="900 000 000" />
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              El estado del servidor y sus actualizaciones están en Visor Node.
            </p>
          </Tarjeta>
        </div>
      )}

      {seccion === "local" && (
        <div className="grid gap-3 p-4 xl:grid-cols-2">
          <Tarjeta titulo="Datos fiscales">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nombre comercial" valor="Bar La Alameda" />
              <Campo label="Razón social" valor="La Alameda Hostelería S.L." />
              <Campo label="CIF" valor="B00000000" />
              <Campo label="Teléfono" valor="922 000 000" />
            </div>
            <div className="mt-3"><Campo label="Dirección" valor="C/ Mayor 1 · 38002 Santa Cruz de La Palma" /></div>
          </Tarjeta>
          <Tarjeta titulo="Fiscalidad">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Territorio" valor="Canarias (IGIC)" />
              <Campo label="Serie" valor="A · 2026" />
              <Campo label="VERIFACTU" valor={<span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber" /> Modo prueba</span>} />
              <Campo label="Tipos" valor="7 % / 3 %" />
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              El territorio decide los tipos de toda la carta: se deduce del código postal
              y recalcula los precios, así que se cambia con el local cerrado.
            </p>
          </Tarjeta>
        </div>
      )}
    </ShellApartado>
  );
}
