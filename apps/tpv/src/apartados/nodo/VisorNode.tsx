import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Server, MonitorSmartphone, HardDriveDownload, RefreshCw, Package, Table2, Users, Receipt,
} from "lucide-react";
import { MarcoApartado } from "../../ui";
import { eur } from "../../lib/dinero";
import { APARTADOS } from "../meta";
import { cargarEstadoNodo, ESTADO_DEMO, type EstadoNodo } from "./estado";

// VISOR NODE — el servidor del bar de un vistazo: qué servicios están vivos, qué
// terminales hay conectados, cuánto lleva hecho hoy y las copias de seguridad.
// Lee el estado REAL del nodo (`/nodo/estado`); si no hay nodo o no autoriza,
// enseña la demo MARCADA como ejemplo.

const MB = (bytes: number) => `${(bytes / 1_000_000).toFixed(0)} MB`;

function haceCuanto(iso: string | null): string {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}

function Panel({ titulo, accion, children }: Readonly<{ titulo: string; accion?: ReactNode; children: ReactNode }>) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex items-center gap-3 pb-3">
        <h3 className="mr-auto text-[11px] font-semibold uppercase tracking-widest text-muted">{titulo}</h3>
        {accion}
      </div>
      {children}
    </section>
  );
}

function Cifra({ label, valor, Icono }: Readonly<{ label: string; valor: string; Icono: typeof Package }>) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-paper/3 px-4 py-3">
      <Icono size={17} className="flex-none text-muted" />
      <span className="min-w-0">
        <b className="block font-display text-[19px] font-extrabold leading-none tracking-tight">{valor}</b>
        <span className="text-[11.5px] text-muted">{label}</span>
      </span>
    </div>
  );
}

export function VisorNode({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const m = APARTADOS.nodo;
  const [datos, setDatos] = useState<EstadoNodo>(ESTADO_DEMO);
  const [real, setReal] = useState(false);
  const [cargando, setCargando] = useState(true);

  const refrescar = useCallback(() => {
    setCargando(true);
    cargarEstadoNodo().then((e) => {
      if (e) { setDatos(e); setReal(true); } else { setDatos(ESTADO_DEMO); setReal(false); }
      setCargando(false);
    });
  }, []);

  useEffect(refrescar, [refrescar]);

  const caidos = datos.servicios.filter((s) => !s.up).length;
  const disp = datos.dispositivos ?? [];
  const conectados = disp.filter((d) => d.conectado).length;

  return (
    <MarcoApartado
      titulo={m.titulo} desc={m.desc} icono={<m.Icono size={22} />} color={m.color} onVolver={onVolver}
      acciones={
        <button type="button" onClick={refrescar} disabled={cargando}
          className="flex min-h-10 items-center gap-2 rounded-xl border border-line bg-panel px-4 text-[13px] font-semibold text-paper/85 transition-transform active:scale-95 disabled:opacity-50">
          <RefreshCw size={15} className={cargando ? "animate-spin" : ""} /> Actualizar
        </button>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {/* De dónde salen los datos: nodo real o ejemplo */}
        <div className={`mb-4 flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-[12.5px] font-semibold ${
          real ? "border-mint/40 bg-mint/10" : "border-amber/40 bg-amber/10"
        }`}>
          <span className={`h-2 w-2 flex-none rounded-full ${real ? "bg-mint" : "bg-amber"}`} />
          {real
            ? <>Conectado al servidor de este bar{caidos > 0 && ` · ${caidos} servicio(s) caído(s)`}</>
            : <>Datos de ejemplo — no se ve el servidor desde aquí (arráncalo o entra desde el propio ordenador)</>}
        </div>

        {/* Servicios */}
        <Panel titulo="Servicios del servidor"
          accion={<span className="rounded-full border border-line px-3 py-1 text-[11px] font-semibold text-muted">
            {datos.servicios.filter((s) => s.up).length}/{datos.servicios.length} vivos
          </span>}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {datos.servicios.map((s) => (
              <div key={s.clave} className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-paper/3 px-4">
                <span className={`h-2.5 w-2.5 flex-none rounded-full ${s.up ? "bg-mint" : "bg-danger"}`}
                  style={{ boxShadow: `0 0 0 4px ${s.up ? "rgba(63,216,164,.16)" : "rgba(224,85,74,.16)"}` }} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[14px] font-semibold">{s.nombre}</b>
                  <span className="font-mono text-[11.5px] text-muted">puerto {s.puerto}</span>
                </span>
                <span className={`flex-none text-[11.5px] font-bold uppercase ${s.up ? "text-mint" : "text-danger"}`}>
                  {s.up ? "OK" : "Caído"}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Hoy en el bar */}
        {datos.hoy && (
          <div className="mt-4">
            <Panel titulo="Hoy en el bar">
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <Cifra label="Pedidos cerrados" valor={String(datos.hoy.pedidos)} Icono={Receipt} />
                <Cifra label="Mesas abiertas" valor={String(datos.hoy.mesasAbiertas)} Icono={Table2} />
                <Cifra label="Mesas libres" valor={String(datos.hoy.mesasLibres)} Icono={Table2} />
                <Cifra label="Caja del día" valor={datos.hoy.caja != null ? eur(datos.hoy.caja) : "—"} Icono={Server} />
              </div>
            </Panel>
          </div>
        )}

        {/* Terminales */}
        <div className="mt-4">
          <Panel titulo="Terminales conectados"
            accion={<span className="rounded-full border border-line px-3 py-1 text-[11px] font-semibold text-muted">{conectados} de {disp.length}</span>}>
            {disp.length === 0
              ? <p className="text-[13px] text-muted">Ningún terminal emparejado todavía.</p>
              : (
                <ul className="space-y-2">
                  {disp.map((d) => (
                    <li key={d.nombre} className={`flex min-h-14 items-center gap-3 rounded-xl border border-line bg-paper/3 px-4 ${d.conectado ? "" : "opacity-55"}`}>
                      <MonitorSmartphone size={17} className="flex-none text-muted" />
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[14.5px] font-semibold">{d.nombre}</b>
                        <span className="text-[12px] text-muted">
                          {d.tipo}{d.estacion ? ` · ${d.estacion}` : ""}{d.version ? ` · ${d.version}` : ""}
                        </span>
                      </span>
                      <span className="flex-none text-right">
                        <span className={`block text-[11.5px] font-bold uppercase ${d.conectado ? "text-mint" : "text-muted"}`}>
                          {d.conectado ? "Conectado" : "Sin señal"}
                        </span>
                        <span className="font-mono text-[11px] text-muted">{haceCuanto(d.ultimaConexion)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
          </Panel>
        </div>

        {/* Contenido y copias */}
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {datos.contenido && (
            <Panel titulo="Qué hay dado de alta">
              <div className="grid grid-cols-2 gap-2">
                <Cifra label="Productos" valor={String(datos.contenido.productos)} Icono={Package} />
                <Cifra label="Categorías" valor={String(datos.contenido.categorias)} Icono={Package} />
                <Cifra label="Mesas" valor={String(datos.contenido.mesas)} Icono={Table2} />
                <Cifra label="Empleados" valor={String(datos.contenido.usuarios)} Icono={Users} />
              </div>
            </Panel>
          )}

          {datos.copias && (
            <Panel titulo="Copias de seguridad">
              <div className="space-y-2">
                <div className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-paper/3 px-4">
                  <HardDriveDownload size={17} className="flex-none text-muted" />
                  <span className="text-[13px] font-semibold">Última copia</span>
                  <span className="ml-auto text-[13.5px] font-semibold">{haceCuanto(datos.copias.ultima)}</span>
                </div>
                <div className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-paper/3 px-4">
                  <span className="text-[13px] font-semibold text-muted">Guardadas</span>
                  <span className="ml-auto text-[13.5px] font-semibold">{datos.copias.hay} · {MB(datos.copias.ocupa)}</span>
                </div>
                {datos.copias.carpeta && (
                  <p className="px-1 pt-1 font-mono text-[11.5px] text-muted">{datos.copias.carpeta}</p>
                )}
              </div>
              <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
                El bar cobra sin internet: estas copias son su red de seguridad. Reiniciar
                servicios o actualizar solo se hace desde el propio ordenador del servidor.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </MarcoApartado>
  );
}
