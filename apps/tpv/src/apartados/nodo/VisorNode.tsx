import { useCallback, useEffect, useState } from "react";
import {
  Activity, MonitorSmartphone, Printer, ScrollText, HardDriveDownload, RefreshCw, ArrowUpCircle,
} from "lucide-react";
import { ShellApartado, Boton, Tarjeta, Segmento, RC, TH, TD, type SeccionShell } from "../../ui";
import { eur } from "../../lib/dinero";
import { cargarEstadoNodo, ESTADO_DEMO, type EstadoNodo } from "./estado";

// VISOR NODE — el servidor del bar con el lenguaje de gestión. Lee el estado
// REAL del nodo (`/nodo/estado` del gateway); si no hay nodo o no autoriza (solo
// lo sirve en local o con token), cae a demo MARCADA como ejemplo. Las colas de
// impresión y el registro aún no los expone el nodo: van marcados como tales.

const SECCIONES: readonly SeccionShell[] = [
  { id: "estado", label: "Estado", Icono: Activity },
  { id: "terminales", label: "Terminales", Icono: MonitorSmartphone },
  { id: "impresion", label: "Impresión", Icono: Printer },
  { id: "registro", label: "Registro", Icono: ScrollText },
  { id: "copias", label: "Copias", Icono: HardDriveDownload },
  { id: "actualiza", label: "Actualizaciones", Icono: ArrowUpCircle },
];

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

const NIVELES = [
  { id: "TODO" as const, label: "Todo" },
  { id: "AVISO" as const, label: "Avisos" },
  { id: "ERROR" as const, label: "Errores" },
];

function Kpi({ label, valor }: Readonly<{ label: string; valor: string }>) {
  return (
    <div className={`${RC} border border-line bg-panel px-3.5 py-3`}>
      <span className="text-[11.5px] font-medium text-muted">{label}</span>
      <b className="mt-1 block text-[19px] font-semibold leading-none tracking-tight">{valor}</b>
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

  const SUB: Record<string, string> = {
    estado: `${vivos} de ${datos.servicios.length} servicios vivos`,
    terminales: `${disp.filter((x) => x.conectado).length} conectados de ${disp.length}`,
    impresion: "Cola de documentos del local",
    registro: "Lo que ha hecho el servidor",
    copias: "La red de seguridad del bar",
    actualiza: "Versión del servidor y del TPV",
  };

  // Procedencia de los datos (real vs ejemplo): honesto, siempre visible.
  const aviso = (
    <div className={`mb-3 flex items-center gap-2 ${RC} border px-3 py-2 text-[12px] font-medium ${
      real ? "border-mint/40 bg-mint/10" : "border-amber/40 bg-amber/10"
    }`}>
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${real ? "bg-mint" : "bg-amber"}`} />
      {real ? "Conectado al servidor de este bar" : "Datos de ejemplo — no se ve el servidor desde aquí"}
    </div>
  );

  return (
    <ShellApartado app="Visor Node" claveLateral="nodo" secciones={SECCIONES}
      seccion={seccion} onSeccion={setSeccion} onVolver={onVolver} subtitulo={SUB[seccion]}
      acciones={
        <Boton onClick={refrescar} disabled={cargando}>
          <RefreshCw size={14} className={cargando ? "animate-spin" : ""} /> Actualizar
        </Boton>
      }>

      {seccion === "estado" && (
        <div className="space-y-3 p-4">
          {aviso}
          <Tarjeta titulo="Servicios">
            <table className="w-full border-collapse">
              <thead><tr><th className={TH}>Servicio</th><th className={TH}>Puerto</th><th className={`${TH} text-right`}>Estado</th></tr></thead>
              <tbody>
                {datos.servicios.map((s) => (
                  <tr key={s.clave} className="border-b border-line">
                    <td className={`${TD} font-medium`}>
                      <span className="flex items-center gap-2.5">
                        <span className={`h-1.5 w-1.5 flex-none rounded-full ${s.up ? "bg-mint" : "bg-danger"}`} />
                        {s.nombre}
                      </span>
                    </td>
                    <td className={`${TD} tabular-nums text-muted`}>{s.puerto}</td>
                    <td className={`${TD} text-right text-[11.5px] font-medium ${s.up ? "text-mint" : "text-danger"}`}>
                      {s.up ? "Activo" : "Caído"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>

          {datos.hoy && (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Kpi label="Pedidos cerrados hoy" valor={String(datos.hoy.pedidos)} />
              <Kpi label="Mesas abiertas" valor={String(datos.hoy.mesasAbiertas)} />
              <Kpi label="Mesas libres" valor={String(datos.hoy.mesasLibres)} />
              <Kpi label="Caja del día" valor={datos.hoy.caja != null ? eur(datos.hoy.caja) : "—"} />
            </div>
          )}

          {datos.contenido && (
            <Tarjeta titulo="Qué hay dado de alta">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Kpi label="Productos" valor={String(datos.contenido.productos)} />
                <Kpi label="Categorías" valor={String(datos.contenido.categorias)} />
                <Kpi label="Mesas" valor={String(datos.contenido.mesas)} />
                <Kpi label="Empleados" valor={String(datos.contenido.usuarios)} />
              </div>
            </Tarjeta>
          )}
        </div>
      )}

      {seccion === "terminales" && (
        <div className="p-4">
          {aviso}
          <Tarjeta titulo="Dispositivos emparejados">
            {disp.length === 0 ? <p className="py-6 text-center text-[12.5px] text-muted">Ningún terminal emparejado todavía.</p> : (
              <table className="w-full border-collapse">
                <thead><tr><th className={TH}>Terminal</th><th className={TH}>Tipo</th><th className={TH}>Zona</th><th className={TH}>Versión</th><th className={`${TH} text-right`}>Última señal</th></tr></thead>
                <tbody>
                  {disp.map((x) => (
                    <tr key={x.nombre} className={`border-b border-line ${x.conectado ? "" : "opacity-60"}`}>
                      <td className={`${TD} font-medium`}>
                        <span className="flex items-center gap-2.5">
                          <span className={`h-1.5 w-1.5 flex-none rounded-full ${x.conectado ? "bg-mint" : "bg-muted"}`} />
                          {x.nombre}
                        </span>
                      </td>
                      <td className={`${TD} text-muted`}>{x.tipo}</td>
                      <td className={`${TD} text-muted`}>{x.estacion ?? "—"}</td>
                      <td className={`${TD} tabular-nums text-muted`}>{x.version ?? "—"}</td>
                      <td className={`${TD} text-right tabular-nums`}>{haceCuanto(x.ultimaConexion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Tarjeta>
        </div>
      )}

      {seccion === "impresion" && (
        <div className="p-4">
          <Tarjeta titulo="Últimos documentos">
            <table className="w-full border-collapse">
              <thead><tr><th className={TH}>Documento</th><th className={TH}>Impresora</th><th className={TH}>Cuándo</th><th className={`${TH} text-right`}>Estado</th></tr></thead>
              <tbody>
                {COLAS_DEMO.map((c) => (
                  <tr key={c.doc} className="border-b border-line">
                    <td className={`${TD} font-medium`}>{c.doc}</td>
                    <td className={`${TD} text-muted`}>{c.impresora}</td>
                    <td className={`${TD} text-muted`}>{c.cuando}</td>
                    <td className={`${TD} text-right`}>
                      <span className={`rounded-[3px] px-1.5 py-0.5 text-[11.5px] font-medium ${TONO_COLA[c.estado] ?? "bg-amber/15"}`}>{c.estado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              Ejemplo: el nodo aún no publica la cola en su estado. Las impresoras y su
              enrutado por zona se configuran en Configuración → Impresión.
            </p>
          </Tarjeta>
        </div>
      )}

      {seccion === "registro" && (
        <div className="p-4">
          <Tarjeta titulo="Últimos eventos"
            extra={<Segmento valor={nivel} opciones={NIVELES} onCambio={setNivel} />}>
            {registro.length === 0 ? <p className="py-6 text-center text-[12.5px] text-muted">Nada de ese nivel.</p> : (
              <ul className="divide-y divide-line font-mono text-[12px]">
                {registro.map((r) => (
                  <li key={`${r.hora}${r.texto}`} className="flex items-center gap-3 py-2">
                    <span className="flex-none tabular-nums text-muted">{r.hora}</span>
                    <span className={`w-12 flex-none text-[11px] font-medium ${TONO_NIVEL[r.nivel]}`}>{r.nivel}</span>
                    <span className="min-w-0 flex-1 truncate">{r.texto}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 font-sans text-[12px] leading-relaxed text-muted">
              Ejemplo: el registro real vive en los ficheros de log del nodo; se publicará
              por su propio camino.
            </p>
          </Tarjeta>
        </div>
      )}

      {seccion === "copias" && (
        <div className="p-4">
          {aviso}
          {datos.copias && (
            <div className="grid gap-3 xl:grid-cols-2">
              <Tarjeta titulo="Estado de las copias">
                <div className="grid grid-cols-3 gap-3">
                  <Kpi label="Última copia" valor={haceCuanto(datos.copias.ultima)} />
                  <Kpi label="Guardadas" valor={String(datos.copias.hay)} />
                  <Kpi label="Ocupan" valor={MB(datos.copias.ocupa)} />
                </div>
                {datos.copias.carpeta && <p className="mt-3 font-mono text-[11.5px] text-muted">{datos.copias.carpeta}</p>}
              </Tarjeta>
              <Tarjeta titulo="Por qué importan">
                <p className="text-[12.5px] leading-relaxed text-muted">
                  El bar cobra y factura <b className="font-medium text-paper/80">sin internet</b>: los datos
                  viven en este servidor. Las copias son lo que permite recuperar el local si
                  el equipo falla. Se programan en Configuración; restaurar solo se hace desde
                  el propio ordenador del servidor.
                </p>
              </Tarjeta>
            </div>
          )}
        </div>
      )}

      {seccion === "actualiza" && (
        <div className="grid gap-3 p-4 xl:grid-cols-2">
          <Tarjeta titulo="Versiones">
            <div className="grid grid-cols-2 gap-3">
              <Kpi label="Servidor" valor="v2.4.1" />
              <Kpi label="TPV" valor="v3.2.0" />
            </div>
          </Tarjeta>
          <Tarjeta titulo="Buscar actualización">
            <p className="text-[12.5px] leading-relaxed text-muted">
              Actualizar y reiniciar servicios solo se puede desde el{" "}
              <b className="font-medium text-paper/80">propio ordenador del servidor</b>, nunca desde un TPV
              de la barra: el nodo rechaza esas acciones desde la red.
            </p>
            <div className="mt-3">
              <Boton disabled><ArrowUpCircle size={14} /> Buscar actualización (solo en el servidor)</Boton>
            </div>
          </Tarjeta>
        </div>
      )}
    </ShellApartado>
  );
}
