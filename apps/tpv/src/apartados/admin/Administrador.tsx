import { useState, type ReactNode } from "react";
import {
  Users, Clock, ShieldCheck, BadgeCheck, Building2, Nfc, KeyRound, Check, X, type LucideIcon,
} from "lucide-react";
import { MarcoApartado } from "../../ui";
import { APARTADOS } from "../meta";
import { iniciales } from "../acceso/tipos";

// ADMINISTRADOR — lo del DUEÑO del local: quién trabaja aquí (y con qué permisos),
// los turnos, la licencia y los datos fiscales del negocio. Es la puerta con PIN de
// administrador; la carta y los precios viven en Configuración, y lo técnico del
// servidor en Visor Node. Datos DEMO con la forma de `app_user`/`perfil`/`tenant`.

type Pestana = "empleados" | "turnos" | "permisos" | "licencia" | "local";
const PESTANAS: { id: Pestana; label: string; Icono: LucideIcon }[] = [
  { id: "empleados", label: "Empleados", Icono: Users },
  { id: "turnos", label: "Turnos", Icono: Clock },
  { id: "permisos", label: "Permisos", Icono: ShieldCheck },
  { id: "licencia", label: "Licencia", Icono: BadgeCheck },
  { id: "local", label: "Datos del local", Icono: Building2 },
];

const EMPLEADOS_DEMO = [
  { id: "1", nombre: "María Ruiz", rol: "Encargada", perfil: "Encargado", pin: true, pulsera: true, activo: true, color: "linear-gradient(150deg,var(--brand-lit),var(--brand))" },
  { id: "2", nombre: "Berto Sanz", rol: "Camarero", perfil: "Sala", pin: true, pulsera: false, activo: true },
  { id: "3", nombre: "Lucía Gil", rol: "Camarera", perfil: "Sala", pin: true, pulsera: true, activo: true },
  { id: "4", nombre: "Iván Pérez", rol: "Cocina", perfil: "Cocina", pin: true, pulsera: false, activo: false },
];

const TURNOS_DEMO = [
  { nombre: "Desayunos", desde: "07:00", hasta: "11:30", gente: 2 },
  { nombre: "Comidas", desde: "12:00", hasta: "16:30", gente: 5 },
  { nombre: "Tardes", desde: "16:30", hasta: "20:00", gente: 2 },
  { nombre: "Cenas", desde: "20:00", hasta: "00:30", gente: 4 },
];

// Matriz de permisos por perfil (los del panel: `perfil.permisos`).
const PERMISOS = ["Cobrar", "Descuentos", "Anular líneas", "Invitar", "Abrir cajón", "Configuración"] as const;
const PERFILES_DEMO: { nombre: string; permisos: boolean[] }[] = [
  { nombre: "Encargado", permisos: [true, true, true, true, true, true] },
  { nombre: "Sala", permisos: [true, false, true, true, false, false] },
  { nombre: "Cocina", permisos: [false, false, false, false, false, false] },
];

function Panel({ titulo, accion, children }: Readonly<{ titulo: string; accion?: ReactNode; children: ReactNode }>) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex items-center gap-3 pb-3">
        <h3 className="mr-auto text-[11px] font-semibold uppercase tracking-[.14em] text-muted">{titulo}</h3>
        {accion}
      </div>
      {children}
    </section>
  );
}

function Dato({ label, valor }: Readonly<{ label: string; valor: string }>) {
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-paper/3 px-4">
      <span className="text-[12px] font-semibold uppercase tracking-widest text-muted">{label}</span>
      <span className="ml-auto truncate text-[14px] font-semibold">{valor}</span>
    </div>
  );
}

export function Administrador({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const m = APARTADOS.admin;
  const [pestana, setPestana] = useState<Pestana>("empleados");

  return (
    <MarcoApartado titulo={m.titulo} desc={m.desc} icono={<m.Icono size={22} />} color={m.color} onVolver={onVolver}>
      {/* Pestañas (táctiles: ≥48px de alto) */}
      <nav className="flex flex-none gap-1 border-b border-line px-6 pt-3">
        {PESTANAS.map((p) => {
          const activa = p.id === pestana;
          return (
            <button key={p.id} type="button" onClick={() => setPestana(p.id)}
              className={`flex min-h-12 items-center gap-2 rounded-t-xl border-b-2 px-4 text-[14px] font-semibold transition-transform active:scale-95 ${
                activa ? "border-brand text-paper" : "border-transparent text-muted"
              }`}>
              <p.Icono size={16} /> {p.label}
            </button>
          );
        })}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {pestana === "empleados" && (
          <Panel titulo="Quién trabaja aquí" accion={<span className="rounded-full border border-line px-3 py-1 text-[11px] font-semibold text-muted">{EMPLEADOS_DEMO.filter((e) => e.activo).length} activos</span>}>
            <ul className="space-y-2">
              {EMPLEADOS_DEMO.map((e) => (
                <li key={e.id} className={`flex items-center gap-3 rounded-xl border border-line bg-paper/3 p-3 ${e.activo ? "" : "opacity-50"}`}>
                  <span className="grid h-11 w-11 flex-none place-items-center rounded-full text-[14px] font-bold text-white"
                    style={{ background: e.color ?? "linear-gradient(150deg,var(--brand-lit),var(--brand))" }}>
                    {iniciales(e.nombre)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[15px] font-semibold">{e.nombre}</b>
                    <span className="text-[12.5px] text-muted">{e.rol} · perfil {e.perfil}</span>
                  </span>
                  <span className="flex flex-none items-center gap-1.5">
                    {e.pin && <span className="flex items-center gap-1 rounded-full bg-paper/5 px-2 py-1 text-[11px] font-semibold text-muted"><KeyRound size={11} /> PIN</span>}
                    {e.pulsera && <span className="flex items-center gap-1 rounded-full bg-brand/10 px-2 py-1 text-[11px] font-semibold text-brand-lit"><Nfc size={11} /> Pulsera</span>}
                    {!e.activo && <span className="rounded-full bg-paper/5 px-2 py-1 text-[11px] font-semibold text-muted">De baja</span>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
              Alta y baja, cambio de PIN y asignación de pulsera se harán aquí; hoy se
              gestionan desde el panel web.
            </p>
          </Panel>
        )}

        {pestana === "turnos" && (
          <Panel titulo="Turnos del día">
            <ul className="space-y-2">
              {TURNOS_DEMO.map((t) => (
                <li key={t.nombre} className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-paper/3 px-4">
                  <Clock size={16} className="flex-none text-muted" />
                  <b className="min-w-0 flex-1 truncate text-[15px] font-semibold">{t.nombre}</b>
                  <span className="flex-none font-mono text-[13px] tabular-nums text-muted">{t.desde} – {t.hasta}</span>
                  <span className="flex-none rounded-full bg-paper/5 px-2.5 py-1 text-[11.5px] font-semibold text-muted">{t.gente} personas</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
              Los turnos agrupan las ventas por franja (salen en Análisis) y marcan qué
              periodo de servicio está activo en el TPV.
            </p>
          </Panel>
        )}

        {pestana === "permisos" && (
          <Panel titulo="Qué puede hacer cada perfil">
            <div className="overflow-x-auto">
              <table className="w-full min-w-140 border-collapse text-[13.5px]">
                <thead>
                  <tr>
                    <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-widest text-muted">Perfil</th>
                    {PERMISOS.map((p) => (
                      <th key={p} className="px-2 pb-2 text-center text-[11px] font-semibold uppercase tracking-widest text-muted">{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERFILES_DEMO.map((pf) => (
                    <tr key={pf.nombre} className="border-t border-line">
                      <td className="py-3 font-semibold">{pf.nombre}</td>
                      {pf.permisos.map((ok, i) => (
                        <td key={PERMISOS[i]} className="px-2 py-3 text-center">
                          {ok
                            ? <Check size={16} className="mx-auto text-mint" />
                            : <X size={15} className="mx-auto text-muted/60" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
              El perfil manda sobre el rol: el nodo valida cada acción sensible contra
              estos permisos, no contra el nombre del puesto.
            </p>
          </Panel>
        )}

        {pestana === "licencia" && (
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel titulo="Licencia de este local">
              <div className="space-y-2">
                <Dato label="Licencia" valor="LA-ALAMEDA-0417" />
                <Dato label="Plan" valor="Gluuh Hostelería" />
                <Dato label="Terminales" valor="4 de 6 usados" />
                <Dato label="Renovación" valor="01-01-2027" />
              </div>
            </Panel>
            <Panel titulo="Versión y soporte">
              <div className="space-y-2">
                <Dato label="TPV" valor="v3.2.0" />
                <Dato label="Servidor" valor="v2.4.1" />
                <Dato label="Soporte" valor="soporte@gluuh.com" />
              </div>
              <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
                El estado del servidor, sus servicios y las actualizaciones están en
                Visor Node.
              </p>
            </Panel>
          </div>
        )}

        {pestana === "local" && (
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel titulo="Datos fiscales del negocio">
              <div className="space-y-2">
                <Dato label="Nombre" valor="Bar La Alameda" />
                <Dato label="Razón social" valor="La Alameda Hostelería S.L." />
                <Dato label="CIF" valor="B00000000" />
                <Dato label="Dirección" valor="C/ Mayor 1 · Santa Cruz de La Palma" />
              </div>
            </Panel>
            <Panel titulo="Territorio fiscal">
              <div className="space-y-2">
                <Dato label="Territorio" valor="Canarias (IGIC)" />
                <Dato label="Serie" valor="A · 2026" />
                <Dato label="VERIFACTU" valor="Modo prueba" />
              </div>
              <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
                El territorio decide los tipos de impuesto de toda la carta. Cambiarlo
                recalcula los precios: se hace con el local cerrado.
              </p>
            </Panel>
          </div>
        )}

        <p className="mt-5 text-[12.5px] text-muted">
          Datos de ejemplo. Al cablear el nodo salen del local real (empleados, perfiles,
          licencia y datos fiscales) sin tocar esta pantalla.
        </p>
      </div>
    </MarcoApartado>
  );
}
