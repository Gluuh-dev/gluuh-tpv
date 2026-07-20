import { useCallback, useEffect, useState } from "react";
import {
  Activity, MonitorSmartphone, Printer, ScrollText, HardDriveDownload, RefreshCw, ArrowUpCircle,
  type LucideIcon,
} from "lucide-react";
import { ShellApartado, BarraSeccion, Caja, type SeccionShell } from "../../ui";
import { eur } from "../../lib/dinero";
import { cargarEstadoNodo, ESTADO_DEMO, type EstadoNodo } from "./estado";

// VISOR NODE — el servidor del bar con estructura de app. Lee el estado REAL del
// nodo (`/nodo/estado` del gateway); si no hay nodo o no autoriza (solo lo sirve
// en local o con token), cae a demo MARCADA como ejemplo. Las colas de impresión
// y el registro aún no los expone el nodo: van marcados como pendientes.

const SECCIONES: readonly SeccionShell[] = [
  { id: "estado", label: "Estado", Icono: Activity },
  { id: "terminales", label: "Terminales", Icono: MonitorSmartphone },
  { id: "impresion", label: "Impresión", Icono: Printer },
  { id: "registro", label: "Registro", Icono: ScrollText },
  { id: "copias", label: "Copias", Icono: HardDriveDownload },
  { id: "actualiza", label: "Actualizaciones", Icono: ArrowUpCircle },
];

const TH = "sticky top-0 z-10 bg-panel px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-muted";
const TD = "px-3 py-2.5 text-[13px]";

const MB = (b: number) => `${(b / 1_000_000).toFixed(0)} MB`;

function haceCuanto(iso: string | null): string {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}

// Demo de lo que el nodo aún no expone en /nodo/estado.
const COLAS_DEMO = [
  { doc: "Ticket #001482", impresora: "Caja (tickets)", estado: "IMPRESO", cuando: "hace 2 min" },
  { doc: "Comanda · COCINA", impresora: "Cocina", estado: "IMPRESO", cuando: "hace 4 min" },
  { doc: "Comanda · BARRA", impresora: "Barra", estado: "ENCOLADO", cuando: "hace 4 min" },
  { doc: "Ticket #001481", impresora: "Caja (tickets)", estado: "ERROR", cuando: "hace 12 min" },
];
const REGISTRO_DEMO = [
  { nivel: "INFO", hora: "13:42:08", texto: "Cobro 24,50 € · mesa 3 · tarjeta" },
  { nivel: "INFO", hora: "13:41:55", texto: "Comanda impresa en COCINA (3 líneas)" },
  { nivel: "AVISO", hora: "13:37:02", texto: "Impresora Barra: sin papel" },
  { nivel: "INFO", hora: "13:30:14", texto: "TERMINAL 02 conectado" },
  { nivel: "ERROR", hora: "13:12:47", texto: "Reintento de envío a la nube (sin internet)" },
  { nivel: "INFO", hora: "06:00:00", texto: "Cierre automático de jornada · Z generado" },
];
const TONO_NIVEL: Record<string, string> = { INFO: "text-muted", AVISO: "text-amber", ERROR: "text-danger" };
const TONO_COLA: Record<string, string> = { IMPRESO: "bg-mint/15", ERROR: "bg-danger/15", ENCOLADO: "bg-amber/15" };
const LABEL_NIVEL: Record<string, string> = { TODO: "Todo", AVISO: "Avisos", ERROR: "Errores" };

function Kpi({ label, valor, Icono }: Readonly<{ label: string; valor: string; Icono: LucideIcon }>) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3">
      <Icono size={17} className="flex-none text-muted" />
      <span className="min-w-0">
        <b className="block font-display text-[19px] font-extrabold leading-none tracking-tight">{valor}</b>
        <span className="text-[11.5px] text-muted">{label}</span>
      </span>
    </div>
  );
}

export function VisorNode({ onVolver }: Readonly<{ onVolver: () => void }>) {
  const [seccion, setSeccion] = useState("estado");
  const [datos, setDatos] = useState<EstadoNodo>(ESTADO_DEMO);
  const [real, setReal] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [nivel, setNivel] = useState<"TODO" | "AVISO" | "ERROR">("TODO");

  const refrescar = useCallback(() => {
    setCargando(true);
    cargarEstadoNodo().then((e) => {
      if (e) { setDatos(e); setReal(true); } else { setDatos(ESTADO_DEMO); setReal(false); }
      setCargando(false);
    });
  }, []);
  useEffect(refrescar, [refrescar]);

  const disp = datos.dispositivos ?? [];
  const vivos = datos.servicios.filter((s) => s.up).length;
  const registro = REGISTRO_DEMO.filter((r) => nivel === "TODO" || r.nivel === nivel);

  const acciones = (
    <button type="button" onClick={refrescar} disabled={cargando}
      className="flex min-h-9 items-center gap-2 rounded-lg bg-white/10 px-3 text-[12.5px] font-bold text-white transition-transform active:scale-95 disabled:opacity-50">
      <RefreshCw size={14} className={cargando ? "animate-spin" : ""} /> Actualizar
    </button>
  );

  // Aviso de procedencia de los datos (real vs ejemplo): honesto, siempre visible.
  const aviso = (
    <div className={`mb-3 flex items-center gap-2.5 rounded-lg border px-3.5 py-2 text-[12.5px] font-semibold ${
      real ? "border-mint/40 bg-mint/10" : "border-amber/40 bg-amber/10"
    }`}>
      <span className={`h-2 w-2 flex-none rounded-full ${real ? "bg-mint" : "bg-amber"}`} />
      {real ? "Conectado al servidor de este bar" : "Datos de ejemplo — no se ve el servidor desde aquí"}
    </div>
  );

  return (
    <ShellApartado titulo="Visor Node" claveLateral="nodo" secciones={SECCIONES}
      seccion={seccion} onSeccion={setSeccion} onVolver={onVolver} acciones={acciones}>

      {seccion === "estado" && (
        <>
          <BarraSeccion titulo="Estado del servidor" sub={`${vivos} de ${datos.servicios.length} servicios vivos`} />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {aviso}
            <Caja titulo="Servicios" contador={`${vivos}/${datos.servicios.length}`}>
              <table className="w-full border-collapse">
                <thead><tr><th className={TH}>Servicio</th><th className={TH}>Puerto</th><th className={`${TH} text-right`}>Estado</th></tr></thead>
                <tbody>
                  {datos.servicios.map((s) => (
                    <tr key={s.clave} className="border-t border-line">
                      <td className={`${TD} font-semibold`}>
                        <span className="flex items-center gap-2.5">
                          <span className={`h-2 w-2 flex-none rounded-full ${s.up ? "bg-mint" : "bg-danger"}`} />
                          {s.nombre}
                        </span>
                      </td>
                      <td className={`${TD} font-mono tabular-nums text-muted`}>{s.puerto}</td>
                      <td className={`${TD} text-right text-[11.5px] font-bold uppercase ${s.up ? "text-mint" : "text-danger"}`}>
                        {s.up ? "Activo" : "Caído"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Caja>

            {datos.hoy && (
              <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Kpi label="Pedidos cerrados hoy" valor={String(datos.hoy.pedidos)} Icono={Activity} />
                <Kpi label="Mesas abiertas" valor={String(datos.hoy.mesasAbiertas)} Icono={Activity} />
                <Kpi label="Mesas libres" valor={String(datos.hoy.mesasLibres)} Icono={Activity} />
                <Kpi label="Caja del día" valor={datos.hoy.caja != null ? eur(datos.hoy.caja) : "—"} Icono={Activity} />
              </div>
            )}

            {datos.contenido && (
              <div className="mt-3">
                <Caja titulo="Qué hay dado de alta">
                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <Kpi label="Productos" valor={String(datos.contenido.productos)} Icono={Activity} />
                    <Kpi label="Categorías" valor={String(datos.contenido.categorias)} Icono={Activity} />
                    <Kpi label="Mesas" valor={String(datos.contenido.mesas)} Icono={Activity} />
                    <Kpi label="Empleados" valor={String(datos.contenido.usuarios)} Icono={Activity} />
                  </div>
                </Caja>
              </div>
            )}
          </div>
        </>
      )}

      {seccion === "terminales" && (
        <>
          <BarraSeccion titulo="Terminales" sub={`${disp.filter((d) => d.conectado).length} conectados de ${disp.length}`} />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {aviso}
            <Caja titulo="Dispositivos emparejados">
              {disp.length === 0 ? <p className="py-6 text-center text-[13px] text-muted">Ningún terminal emparejado todavía.</p> : (
                <table className="w-full border-collapse">
                  <thead><tr><th className={TH}>Terminal</th><th className={TH}>Tipo</th><th className={TH}>Zona</th><th className={TH}>Versión</th><th className={`${TH} text-right`}>Última señal</th></tr></thead>
                  <tbody>
                    {disp.map((d) => (
                      <tr key={d.nombre} className={`border-t border-line ${d.conectado ? "" : "opacity-60"}`}>
                        <td className={`${TD} font-semibold`}>
                          <span className="flex items-center gap-2.5">
                            <span className={`h-2 w-2 flex-none rounded-full ${d.conectado ? "bg-mint" : "bg-muted"}`} />
                            {d.nombre}
                          </span>
                        </td>
                        <td className={`${TD} text-muted`}>{d.tipo}</td>
                        <td className={`${TD} text-muted`}>{d.estacion ?? "—"}</td>
                        <td className={`${TD} font-mono text-muted`}>{d.version ?? "—"}</td>
                        <td className={`${TD} text-right tabular-nums`}>{haceCuanto(d.ultimaConexion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Caja>
          </div>
        </>
      )}

      {seccion === "impresion" && (
        <>
          <BarraSeccion titulo="Impresión" sub="Cola de documentos del local" />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <Caja titulo="Últimos documentos" contador={`${COLAS_DEMO.length}`}>
              <table className="w-full border-collapse">
                <thead><tr><th className={TH}>Documento</th><th className={TH}>Impresora</th><th className={TH}>Cuándo</th><th className={`${TH} text-right`}>Estado</th></tr></thead>
                <tbody>
                  {COLAS_DEMO.map((c) => (
                    <tr key={c.doc} className="border-t border-line">
                      <td className={`${TD} font-semibold`}>{c.doc}</td>
                      <td className={`${TD} text-muted`}>{c.impresora}</td>
                      <td className={`${TD} text-muted`}>{c.cuando}</td>
                      <td className={`${TD} text-right`}>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TONO_COLA[c.estado] ?? "bg-amber/15"}`}>{c.estado}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[12px] leading-relaxed text-muted">
                Ejemplo: el nodo aún no publica la cola en su estado. Las impresoras y su
                enrutado por zona se configuran en Configuración → Impresión.
              </p>
            </Caja>
          </div>
        </>
      )}

      {seccion === "registro" && (
        <>
          <BarraSeccion titulo="Registro" sub="Lo que ha hecho el servidor">
            <div className="flex gap-0.5 rounded-lg border border-line bg-panel p-0.5">
              {(["TODO", "AVISO", "ERROR"] as const).map((n) => (
                <button key={n} type="button" onClick={() => setNivel(n)}
                  className={`min-h-8 rounded-md px-3 text-[12px] font-bold transition-transform active:scale-95 ${nivel === n ? "bg-brand text-white" : "text-muted"}`}>
                  {LABEL_NIVEL[n]}
                </button>
              ))}
            </div>
          </BarraSeccion>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <Caja titulo="Últimos eventos" contador={`${registro.length}`}>
              {registro.length === 0 ? <p className="py-6 text-center text-[13px] text-muted">Nada de ese nivel.</p> : (
                <ul className="divide-y divide-line font-mono text-[12.5px]">
                  {registro.map((r) => (
                    <li key={`${r.hora}${r.texto}`} className="flex items-center gap-3 py-2">
                      <span className="flex-none tabular-nums text-muted">{r.hora}</span>
                      <span className={`w-14 flex-none text-[11px] font-bold ${TONO_NIVEL[r.nivel]}`}>{r.nivel}</span>
                      <span className="min-w-0 flex-1 truncate">{r.texto}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 font-sans text-[12px] leading-relaxed text-muted">
                Ejemplo: el registro real vive en los ficheros de log del nodo; se publicará
                por su propio camino.
              </p>
            </Caja>
          </div>
        </>
      )}

      {seccion === "copias" && (
        <>
          <BarraSeccion titulo="Copias de seguridad" sub="La red de seguridad del bar" />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {aviso}
            {datos.copias && (
              <div className="grid gap-3 xl:grid-cols-2">
                <Caja titulo="Estado de las copias">
                  <div className="grid grid-cols-2 gap-3">
                    <Kpi label="Última copia" valor={haceCuanto(datos.copias.ultima)} Icono={HardDriveDownload} />
                    <Kpi label="Guardadas" valor={String(datos.copias.hay)} Icono={HardDriveDownload} />
                    <Kpi label="Ocupan" valor={MB(datos.copias.ocupa)} Icono={HardDriveDownload} />
                  </div>
                  {datos.copias.carpeta && <p className="mt-3 font-mono text-[11.5px] text-muted">{datos.copias.carpeta}</p>}
                </Caja>
                <Caja titulo="Por qué importan">
                  <p className="text-[13px] leading-relaxed text-muted">
                    El bar cobra y factura <b className="font-semibold text-paper/80">sin internet</b>: los datos
                    viven en este servidor. Las copias son lo que permite recuperar el local
                    si el equipo falla. Se programan en Configuración; restaurar solo se hace
                    desde el propio ordenador del servidor.
                  </p>
                </Caja>
              </div>
            )}
          </div>
        </>
      )}

      {seccion === "actualiza" && (
        <>
          <BarraSeccion titulo="Actualizaciones" sub="Versión del servidor y del TPV" />
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="grid gap-3 xl:grid-cols-2">
              <Caja titulo="Versiones">
                <div className="grid grid-cols-2 gap-3">
                  <Kpi label="Servidor" valor="v2.4.1" Icono={ArrowUpCircle} />
                  <Kpi label="TPV" valor="v3.2.0" Icono={ArrowUpCircle} />
                </div>
              </Caja>
              <Caja titulo="Buscar actualización">
                <p className="text-[13px] leading-relaxed text-muted">
                  Actualizar y reiniciar servicios solo se puede desde el{" "}
                  <b className="font-semibold text-paper/80">propio ordenador del servidor</b>, nunca desde un
                  TPV de la barra: el nodo rechaza esas acciones desde la red.
                </p>
                <button type="button" disabled
                  className="mt-3 flex min-h-10 items-center gap-2 rounded-lg border border-line bg-panel px-3.5 text-[13px] font-semibold text-muted opacity-60">
                  <ArrowUpCircle size={15} /> Buscar actualización (solo en el servidor)
                </button>
              </Caja>
            </div>
          </div>
        </>
      )}
    </ShellApartado>
  );
}
