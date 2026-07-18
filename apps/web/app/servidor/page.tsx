"use client";

// PANEL DEL SERVIDOR — estilo Fluent / Windows 11, oscuro.
//
// Lo abre quien está delante del mini-PC de la barra (acceso directo → ventana de Edge en
// modo app), no el dueño desde casa: por eso vive fuera del panel y no pide login. Enseña
// el estado del servidor y RECUENTOS del negocio — nunca una venta suelta ni un secreto.
//
// Regla de oro de esta pantalla: no mentir. Si un dato no lo medimos, no se pinta un número
// inventado — se omite o se dice "no disponible". Un panel que miente es peor que uno feo.
//
// Todo el estilo va inline (fuente Segoe UI del propio Windows, SVG a mano): el nodo no
// tiene internet, así que nada de CDNs ni fuentes que se bajen de fuera.

import * as React from "react";
import { config } from "../lib/config";

// ————————————————————————————————————————————————————————————— tipos
interface Servicio { clave: string; nombre: string; puerto: number; up: boolean }
interface Dispositivo { nombre: string; tipo: string | null; estacion: string | null; version: string | null; ultimaConexion: string | null; conectado: boolean }
interface Categoria { nombre: string; estacion: string | null; productos: number; conFoto: number }
interface Cliente {
  tenant_nombre: string; plan: string | null; tenant_cif: string | null;
  licencia_hasta: string | null; licencia_modulos: unknown; licencia_limites: unknown;
  razon_social: string | null; nombre_comercial: string | null; cif: string | null; direccion: string | null;
  poblacion: string | null; provincia: string | null; codigo_postal: string | null; territorio_fiscal: string | null;
  serie_factura: string | null; contacto: string | null; telefono: string | null; email: string | null; alta: string | null;
}
interface Estado {
  servicios: Servicio[];
  sistema: { cpu: number; ramUsada: number; ramTotal: number; discoLibre: number; discoTotal: number; encendidoSeg: number; equipo: string };
  red: { ip: string | null; mac: string | null; equipo: string };
  contenido: { productos: number; categorias: number; mesas: number; usuarios: number; pedidos: number; pedidosAbiertos: number };
  hoy: { pedidos: number; mesasAbiertas: number; mesasLibres: number; caja: number };
  categorias: Categoria[];
  dispositivos: Dispositivo[];
  modulos: { modulo: string; activo: boolean }[];
  cliente: Cliente | null;
  registro: { tabla: string; cuando: string | null; error: string | null }[];
  ocupa: { baseDatos: number; imagenes: number };
  sincronizacion: { imagenesPorSubir: number; ventasPorSubir: number; conError: number; ultimaSync: string | null; ultimaVenta: string | null };
  copia: { hay: number; ultima: string | null; ocupa: number; carpeta: string; lista: { cuando: string; ocupa: number }[] };
  reloj: { ok: boolean | null; deriva_segundos?: number; motivo?: string };
  version: string;
  ahora: string;
}

// ————————————————————————————————————————————————————————————— formato
function tamano(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
function euros(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
function cuando(iso: string | null): string {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  const dias = Math.round(min / 1440);
  return dias < 30 ? `hace ${dias} d` : new Date(iso).toLocaleDateString("es-ES");
}
function duracion(seg: number): string {
  const d = Math.floor(seg / 86400);
  if (d >= 1) return `${d} día${d > 1 ? "s" : ""}`;
  const h = Math.floor(seg / 3600);
  if (h >= 1) return `${h} h`;
  return `${Math.max(1, Math.floor(seg / 60))} min`;
}
function fecha(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "—";
}

const TERRITORIO: Record<string, string> = {
  PENINSULA_BALEARES: "Península / Baleares (IVA)", CANARIAS: "Canarias (IGIC)", CEUTA_MELILLA: "Ceuta / Melilla (IPSI)",
};
const NOMBRE_MODULO: Record<string, string> = {
  tpv: "TPV", cocina: "Cocina (KDS)", kiosko: "Kiosko", carta: "Carta digital (QR)",
  reservas: "Reservas", fidelizacion: "Fidelización", stock: "Almacén y stock",
  informes: "Informes", verifactu: "VERIFACTU",
};
const nombreModulo = (k: string) => NOMBRE_MODULO[k] ?? k.charAt(0).toUpperCase() + k.slice(1);
const TIPOS: Record<string, string> = { tpv: "TPV", comandera: "Comandera", pantalla: "Pantalla", kds: "Pantalla de cocina", impresora: "Impresora", kiosko: "Kiosko" };

// ————————————————————————————————————————————————————————————— piezas UI
function Pastilla({ tono, children }: { tono: "ok" | "av" | "ko" | "off"; children: React.ReactNode }) {
  return <span className={`pastilla ${tono}`}><i /> {children}</span>;
}
function Cifra({ n, e, tono }: { n: React.ReactNode; e: string; tono?: "ok" | "av" | "cero" }) {
  return <div className="cifra"><div className={`n ${tono ?? ""}`}>{n}</div><div className="e">{e}</div></div>;
}
function Uso({ etiqueta, pct, peso, color }: { etiqueta: string; pct: number; peso: string; color?: "vd" | "am" }) {
  return (
    <div className="uso">
      <div>{etiqueta}</div>
      <div className="pista"><i className={color ?? ""} style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} /></div>
      <div className="peso">{peso}</div>
    </div>
  );
}
function Seccion({ titulo, aparte, children }: { titulo: string; aparte?: string; children: React.ReactNode }) {
  return <section className="seccion"><h2>{titulo}{aparte && <span className="aparte">{aparte}</span>}</h2>{children}</section>;
}

const NAV: { clave: Vista; nombre: string; grupo?: string; insignia?: (e: Estado) => number | null }[] = [
  { clave: "estado", nombre: "Estado" },
  { clave: "servicios", nombre: "Servicios", insignia: (e) => e.servicios.filter((s) => !s.up).length || null },
  { clave: "dispositivos", nombre: "Dispositivos", insignia: (e) => e.dispositivos.filter((d) => !d.conectado).length || null },
  { clave: "red", nombre: "Red" },
  { clave: "modulos", nombre: "Módulos", grupo: "Negocio" },
  { clave: "catalogo", nombre: "Catálogo" },
  { clave: "cliente", nombre: "Cliente y licencia" },
  { clave: "copias", nombre: "Copias de seguridad", grupo: "Sistema" },
  { clave: "registro", nombre: "Registro", insignia: (e) => e.registro.filter((r) => r.error).length || null },
  { clave: "ajustes", nombre: "Ajustes" },
];
type Vista = "estado" | "servicios" | "dispositivos" | "red" | "modulos" | "catalogo" | "cliente" | "copias" | "registro" | "ajustes";

export default function Servidor() {
  const [e, setE] = React.useState<Estado | null>(null);
  const [caido, setCaido] = React.useState(false);
  const [detalle, setDetalle] = React.useState("");
  const [intentos, setIntentos] = React.useState(0);
  const [vista, setVista] = React.useState<Vista>("estado");
  const [aviso, setAviso] = React.useState<string | null>(null);

  async function accion(que: "reiniciar" | "actualizar", texto: string, confirmar?: string) {
    if (confirmar && !window.confirm(confirmar)) return;
    setAviso(texto);
    try {
      const r = await fetch(`${config().url}/nodo/accion/${que}`, { method: "POST" });
      setAviso(r.ok
        ? (que === "reiniciar" ? "Reiniciando el servidor… en unos segundos vuelve." : "Buscando actualización… si hay una nueva, se instalará sola.")
        : "No se pudo. Esta acción sólo funciona desde el ordenador del servidor.");
    } catch {
      setAviso("No se pudo contactar con el servidor.");
    }
    setTimeout(() => setAviso(null), 8000);
  }

  React.useEffect(() => {
    const pedir = async () => {
      try {
        // Con tiempo límite: una petición que se queda colgada dejaría la pantalla
        // en "Conectando…" para siempre, sin error y sin pista. Eso ya nos pasó.
        const r = await fetch(`${config().url}/nodo/estado`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
        if (!r.ok) throw new Error(`el servidor contesta con error ${r.status}`);
        setE((await r.json()) as Estado);
        setCaido(false);
      } catch (err) {
        setCaido(true);
        setIntentos((n) => n + 1);
        setDetalle(
          err instanceof Error && err.name === "TimeoutError" ? "no contesta (tiempo agotado)"
          : err instanceof Error && err.message ? err.message
          : "no se puede conectar");
      }
    };
    void pedir();
    const t = setInterval(pedir, 5000);
    return () => clearInterval(t);
  }, []);

  // Nunca una pantalla muda: siempre se dice QUÉ dirección se consulta, qué ha
  // contestado y que se sigue reintentando. Una espera sin información no es funcional.
  if (caido || !e) {
    const direccion = `${config().url || (typeof window !== "undefined" ? window.location.origin : "")}/nodo/estado`;
    return (
      <>
        <style>{CSS}</style>
        <div className="caido">
          <div>
            {caido ? (
              <>
                <p style={{ fontSize: 64 }}>🔌</p>
                <h1>El servidor no responde</h1>
                <p className="sub">El equipo de la barra está apagado o se ha caído. Los TPV no pueden cobrar.</p>
              </>
            ) : (
              <p className="sub" style={{ fontSize: 18 }}>Conectando con el servidor…</p>
            )}
            <p className="sub" style={{ marginTop: 16, fontFamily: "Consolas, monospace", fontSize: 12 }}>{direccion}</p>
            {caido && (
              <p className="sub" style={{ fontSize: 12 }}>
                {detalle} · se reintenta cada 5 segundos{intentos > 1 ? ` (${intentos} intentos)` : ""}
              </p>
            )}
          </div>
        </div>
      </>
    );
  }

  const serviciosOk = e.servicios.filter((s) => s.up).length;
  const dispConectados = e.dispositivos.filter((d) => d.conectado).length;
  const rot = e.reloj.ok === false;
  const nombreBar = e.cliente?.nombre_comercial || e.cliente?.tenant_nombre || "el local";

  return (
    <>
      <style>{CSS}</style>
      <div className="ventana">
        {/* Identidad — sin botones de ventana falsos: la ventana de Edge ya trae los suyos. */}
        <div className="titulo">
          <div className="id">
            <img src="/icono-servidor.png" alt="" width={16} height={16} style={{ borderRadius: 3 }} />
            <span>Servidor del local — {nombreBar}</span>
          </div>
        </div>

        <div className="cuerpo">
          <nav className="nav" aria-label="Secciones">
            {NAV.map((n) => {
              const insignia = n.insignia?.(e);
              return (
                <React.Fragment key={n.clave}>
                  {n.grupo && <><div className="nav-sep" /><div className="nav-cab">{n.grupo}</div></>}
                  <button className={`nav-item ${vista === n.clave ? "activo" : ""}`} onClick={() => setVista(n.clave)}>
                    {n.nombre}
                    {insignia != null && <span className={`insignia ${n.clave === "modulos" ? "gris" : ""}`}>{insignia}</span>}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>

          <main className="contenido">
            {aviso && (
              <div className="infobar info" style={{ marginBottom: 20 }}>
                <span className="ico"><Ico t="info" /></span>
                <div><p>{aviso}</p></div>
              </div>
            )}

            {/* ═══════════════ ESTADO ═══════════════ */}
            {vista === "estado" && (
              <div className="vista">
                <h1 className="pagina">Estado</h1>
                <div className="subpagina">
                  Versión {e.version} · Encendido desde hace {duracion(e.sistema.encendidoSeg)} ·{" "}
                  {dispConectados} de {e.dispositivos.length} dispositivos conectados
                </div>

                <div className="comandos">
                  <button className="cmd" onClick={() => accion("actualizar", "Buscando actualización…")}>
                    <Ico t="descargar" /> Buscar actualización
                  </button>
                  <button className="cmd" onClick={() => setVista("dispositivos")}><Ico t="disp" /> Ver dispositivos</button>
                  <span className="cmd-sep" />
                  <button className="cmd" onClick={() => accion("reiniciar", "Reiniciando…", "¿Reiniciar el servidor? Los TPV se quedan unos segundos sin cobrar.")}>
                    <Ico t="reiniciar" /> Reiniciar servidor
                  </button>
                </div>

                {rot && (
                  <div className="infobar av">
                    <span className="ico"><Ico t="aviso" /></span>
                    <div><b>El reloj del servidor va desviado{e.reloj.deriva_segundos != null ? ` (${e.reloj.deriva_segundos}s)` : ""}</b>
                      <p>Este equipo le pone la hora a cada factura. Ajusta la hora de Windows cuanto antes.</p></div>
                  </div>
                )}
                {!rot && e.dispositivos.length - dispConectados > 0 && (
                  <div className="infobar av">
                    <span className="ico"><Ico t="aviso" /></span>
                    <div><b>{e.dispositivos.length - dispConectados} dispositivo(s) sin conexión</b>
                      <p>El resto del bar funciona con normalidad. Suele ser la batería o que se ha salido del wifi.{" "}
                        <button className="enlace" onClick={() => setVista("dispositivos")}>Ver dispositivos</button></p></div>
                  </div>
                )}

                <Seccion titulo="Resumen" aparte="Comprobado cada 5 s">
                  <div className="rejilla">
                    <Cifra n={`${serviciosOk}/${e.servicios.length}`} e="Servicios en marcha" tono={serviciosOk === e.servicios.length ? "ok" : "av"} />
                    <Cifra n={`${dispConectados}/${e.dispositivos.length || 0}`} e="Dispositivos conectados" tono={e.dispositivos.length && dispConectados < e.dispositivos.length ? "av" : "ok"} />
                    <Cifra n={duracion(e.sistema.encendidoSeg)} e="Encendido sin apagar" />
                    <Cifra n={cuando(e.sincronizacion.ultimaSync)} e="Última copia en la nube" />
                  </div>
                </Seccion>

                <Seccion titulo="Hoy en el bar" aparte={new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}>
                  <div className="rejilla">
                    <Cifra n={e.hoy.pedidos} e="Pedidos cobrados" tono={e.hoy.pedidos ? undefined : "cero"} />
                    <Cifra n={e.hoy.mesasAbiertas} e="Mesas abiertas ahora" tono={e.hoy.mesasAbiertas ? undefined : "cero"} />
                    <Cifra n={euros(e.hoy.caja)} e="Caja del día" tono={e.hoy.caja ? undefined : "cero"} />
                    <Cifra n={e.hoy.mesasLibres} e="Mesas libres" />
                  </div>
                </Seccion>

                <Seccion titulo="Recursos del equipo">
                  <div className="tarjeta">
                    <Uso etiqueta="Procesador" pct={e.sistema.cpu} peso={`${e.sistema.cpu} %`} color={e.sistema.cpu < 70 ? "vd" : "am"} />
                    <Uso etiqueta="Memoria" pct={(e.sistema.ramUsada / e.sistema.ramTotal) * 100} peso={`${tamano(e.sistema.ramUsada)} / ${tamano(e.sistema.ramTotal)}`} color="vd" />
                    {e.sistema.discoTotal > 0 && (
                      <Uso etiqueta="Disco libre" pct={(1 - e.sistema.discoLibre / e.sistema.discoTotal) * 100}
                        peso={`${tamano(e.sistema.discoLibre)} libres`} color="vd" />
                    )}
                    <div className="pie-tarjeta">
                      {e.sistema.cpu < 60 ? "El equipo va holgado. No hace falta tocar nada." : "El equipo está algo cargado; si va lento, reinícialo fuera de horario."}
                    </div>
                  </div>
                </Seccion>
              </div>
            )}

            {/* ═══════════════ SERVICIOS ═══════════════ */}
            {vista === "servicios" && (
              <div className="vista">
                <h1 className="pagina">Servicios</h1>
                <div className="subpagina">Lo que el servidor levanta al arrancar. Comanderas, pantallas e impresoras se conectan a estos puertos.</div>
                <div className="tabla">
                  <table>
                    <thead><tr><th style={{ width: "44%" }}>Servicio</th><th className="mono" style={{ width: "16%" }}>Puerto</th><th style={{ width: "20%" }}>Estado</th><th className="acc" /></tr></thead>
                    <tbody>
                      {e.servicios.map((s) => (
                        <tr key={s.clave}>
                          <td>{s.nombre}</td>
                          <td className="mono">{s.puerto}</td>
                          <td>{s.up ? <Pastilla tono="ok">Funcionando</Pastilla> : <Pastilla tono="ko">Caído</Pastilla>}</td>
                          <td className="acc sub">{s.clave === "gateway" || s.clave === "datos" ? "Solo la barra" : "Red del bar"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="pie-tarjeta" style={{ border: 0, paddingLeft: 2 }}>Si un servicio se cae, el servidor lo vuelve a levantar solo en unos segundos. Reinicia a mano solo si te lo pide el soporte.</div>
              </div>
            )}

            {/* ═══════════════ DISPOSITIVOS ═══════════════ */}
            {vista === "dispositivos" && <Dispositivos e={e} />}

            {/* ═══════════════ RED ═══════════════ */}
            {vista === "red" && (
              <div className="vista">
                <h1 className="pagina">Red</h1>
                <div className="subpagina">Dónde encontrar el servidor dentro del bar.</div>
                <div className="infobar info">
                  <span className="ico"><Ico t="info" /></span>
                  <div><b>La IP del servidor no debe cambiar</b>
                    <p>Conviene fijarla en el router. Si cambias de router, las comanderas y las impresoras dejarán de encontrarlo hasta volver a fijarla.</p></div>
                </div>
                <Seccion titulo="Este equipo">
                  <div className="ficha">
                    <Campo k="Dirección IP" v={e.red.ip ?? "—"} mono />
                    <Campo k="Nombre en la red" v={e.red.equipo} mono />
                    <Campo k="MAC" v={e.red.mac ?? "—"} mono />
                    <Campo k="Puerta de la barra" v="puerto 54321" mono />
                  </div>
                </Seccion>
                <Seccion titulo="Puertos abiertos" aparte="Solo dentro del bar">
                  <div className="tabla">
                    <table>
                      <thead><tr><th className="mono" style={{ width: "16%" }}>Puerto</th><th style={{ width: "38%" }}>Servicio</th><th className="acc">Estado</th></tr></thead>
                      <tbody>
                        {e.servicios.map((s) => (
                          <tr key={s.clave}><td className="mono">{s.puerto}</td><td>{s.nombre}</td>
                            <td className="acc">{s.up ? <Pastilla tono="ok">Abierto</Pastilla> : <Pastilla tono="ko">Caído</Pastilla>}</td></tr>
                        ))}
                        <tr><td className="mono">55432</td><td>Base de datos del bar</td><td className="acc"><Pastilla tono="off">Local</Pastilla></td></tr>
                      </tbody>
                    </table>
                  </div>
                </Seccion>
              </div>
            )}

            {/* ═══════════════ MÓDULOS ═══════════════ */}
            {vista === "modulos" && (
              <div className="vista">
                <h1 className="pagina">Módulos</h1>
                <div className="subpagina">Lo que tiene contratado el local. Se gestiona desde la nube; aquí solo se consulta.</div>
                {e.modulos.length === 0 ? (
                  <div className="tarjeta"><div className="sub">Este local no tiene módulos configurados todavía.</div></div>
                ) : (
                  <div className="modulos">
                    {e.modulos.map((m) => (
                      <div key={m.modulo} className={`modulo ${m.activo ? "" : "no"}`}>
                        <div className="icono"><Ico t="modulo" /></div>
                        <div className="cuerpo-m">
                          <h3>{nombreModulo(m.modulo)} {m.activo ? <Pastilla tono="ok">Activo</Pastilla> : <Pastilla tono="off">Apagado</Pastilla>}</h3>
                          <p>{m.activo ? "Disponible en los dispositivos del bar." : "No está en uso ahora mismo."}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════ CATÁLOGO ═══════════════ */}
            {vista === "catalogo" && (
              <div className="vista">
                <h1 className="pagina">Catálogo</h1>
                <div className="subpagina">Lo que tiene dado de alta. Se edita desde el TPV; aquí solo se consulta.</div>
                <div className="rejilla" style={{ marginBottom: 22 }}>
                  <Cifra n={e.contenido.productos} e="Productos" />
                  <Cifra n={e.contenido.categorias} e="Categorías" />
                  <Cifra n={e.contenido.mesas} e="Mesas" />
                  <Cifra n={e.contenido.usuarios} e="Empleados" />
                </div>
                <Seccion titulo="Categorías">
                  <div className="tabla">
                    <table>
                      <thead><tr><th style={{ width: "44%" }}>Categoría</th><th style={{ width: "20%" }}>Productos</th><th className="oculta-movil">Con foto</th><th className="acc">Se prepara en</th></tr></thead>
                      <tbody>
                        {e.categorias.length === 0 && <tr><td colSpan={4} className="sub">Sin categorías todavía.</td></tr>}
                        {e.categorias.map((c, i) => (
                          <tr key={i}><td>{c.nombre}</td><td>{c.productos}</td>
                            <td className="oculta-movil">{c.conFoto}</td>
                            <td className="acc sub">{c.estacion === "cocina" ? "Cocina" : c.estacion === "barra" ? "Barra" : "—"}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Seccion>
                <Seccion titulo="Espacio que ocupa">
                  <div className="tarjeta">
                    <Uso etiqueta="Datos del bar" pct={45} peso={tamano(e.ocupa.baseDatos)} />
                    <Uso etiqueta="Fotos de la carta" pct={8} peso={tamano(e.ocupa.imagenes)} color="am" />
                    <div className="pie-tarjeta">{tamano(e.ocupa.baseDatos + e.ocupa.imagenes)} en total. Hay sitio para años de tickets.</div>
                  </div>
                </Seccion>
              </div>
            )}

            {/* ═══════════════ CLIENTE ═══════════════ */}
            {vista === "cliente" && <ClienteVista e={e} />}

            {/* ═══════════════ COPIAS ═══════════════ */}
            {vista === "copias" && <Copias e={e} />}

            {/* ═══════════════ REGISTRO ═══════════════ */}
            {vista === "registro" && (
              <div className="vista">
                <h1 className="pagina">Registro</h1>
                <div className="subpagina">Estado de la sincronización de cada tipo de dato con la nube. Útil cuando llamas al soporte.</div>
                <div className="tabla">
                  <table>
                    <thead><tr><th style={{ width: "30%" }}>Tipo de dato</th><th style={{ width: "22%" }}>Última sincronización</th><th>Resultado</th></tr></thead>
                    <tbody>
                      {e.registro.length === 0 && <tr><td colSpan={3} className="sub">Aún no ha habido sincronizaciones.</td></tr>}
                      {e.registro.map((r, i) => (
                        <tr key={i}>
                          <td>{r.tabla}</td>
                          <td className="sub">{r.cuando ? cuando(r.cuando) : "—"}</td>
                          <td>{r.error
                            ? <span className="sev e"><i /> {r.error.slice(0, 80)}</span>
                            : <span className="sev i"><i /> Correcto</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ═══════════════ AJUSTES ═══════════════ */}
            {vista === "ajustes" && (
              <div className="vista">
                <h1 className="pagina">Ajustes</h1>
                <div className="subpagina">Acciones del servidor. Solo funcionan desde este ordenador.</div>
                <div className="pila">
                  <div className="fila">
                    <div className="txt-fila"><div className="t">Buscar actualización</div><div className="s">Comprueba si hay una versión nueva y la instala sola.</div></div>
                    <button className="cmd" onClick={() => accion("actualizar", "Buscando actualización…")}><Ico t="descargar" /> Buscar</button>
                  </div>
                  <div className="fila">
                    <div className="txt-fila"><div className="t">Reiniciar el servidor</div><div className="s">Vuelve a levantar todos los servicios. Los TPV se quedan unos segundos sin cobrar.</div></div>
                    <button className="cmd" onClick={() => accion("reiniciar", "Reiniciando…", "¿Reiniciar el servidor?")}><Ico t="reiniciar" /> Reiniciar</button>
                  </div>
                  <div className="fila">
                    <div className="txt-fila"><div className="t">Versión instalada</div><div className="s">Equipo: {e.sistema.equipo}</div></div>
                    <span className="val">v{e.version}</span>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        <div className="estado-barra">
          <span className="punto">Servidor en marcha</span>
          <span className="oculta-movil">{serviciosOk}/{e.servicios.length} servicios · {dispConectados}/{e.dispositivos.length} dispositivos</span>
          <span className="der">v{e.version} · {new Date(e.ahora).toLocaleTimeString("es-ES")}</span>
        </div>
      </div>
    </>
  );
}

// ————————————————————————————————————————————————————————————— vistas grandes
function Dispositivos({ e }: { e: Estado }) {
  const [filtro, setFiltro] = React.useState<string>("todos");
  const conectados = e.dispositivos.filter((d) => d.conectado).length;
  const tipos = Array.from(new Set(e.dispositivos.map((d) => d.tipo).filter(Boolean))) as string[];
  const lista = filtro === "todos" ? e.dispositivos : e.dispositivos.filter((d) => d.tipo === filtro);
  return (
    <div className="vista">
      <h1 className="pagina">Dispositivos</h1>
      <div className="subpagina">Todo lo que se conecta al servidor por la red del bar.</div>
      <div className="rejilla" style={{ marginBottom: 18 }}>
        <Cifra n={conectados} e="Conectados" tono="ok" />
        <Cifra n={e.dispositivos.length - conectados} e="Sin conexión" tono={e.dispositivos.length - conectados ? "av" : "cero"} />
        <Cifra n={e.dispositivos.length} e="Dados de alta" />
        <Cifra n={e.contenido.usuarios} e="Empleados" />
      </div>
      {tipos.length > 1 && (
        <div className="filtros">
          <button className={`chip ${filtro === "todos" ? "activo" : ""}`} onClick={() => setFiltro("todos")}>Todos</button>
          {tipos.map((t) => <button key={t} className={`chip ${filtro === t ? "activo" : ""}`} onClick={() => setFiltro(t)}>{TIPOS[t] ?? t}</button>)}
        </div>
      )}
      <div className="tabla">
        <table>
          <thead><tr><th style={{ width: "30%" }}>Dispositivo</th><th className="oculta-movil" style={{ width: "18%" }}>Tipo</th><th style={{ width: "18%" }}>Estado</th><th className="oculta-movil">Última señal</th><th className="mono acc">Versión</th></tr></thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={5} className="sub">No hay dispositivos vinculados. Emparéjalos desde el TPV.</td></tr>}
            {lista.map((d, i) => (
              <tr key={i} className={d.conectado ? "" : "apagado"}>
                <td>{d.nombre}{d.estacion && <div className="sub">{d.estacion}</div>}</td>
                <td className="oculta-movil sub">{d.tipo ? (TIPOS[d.tipo] ?? d.tipo) : "—"}</td>
                <td>{d.conectado ? <Pastilla tono="ok">Conectado</Pastilla> : <Pastilla tono="ko">Sin conexión</Pastilla>}</td>
                <td className="oculta-movil sub">{cuando(d.ultimaConexion)}</td>
                <td className="mono acc sub">{d.version ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClienteVista({ e }: { e: Estado }) {
  const c = e.cliente;
  if (!c) return <div className="vista"><h1 className="pagina">Cliente y licencia</h1><div className="tarjeta"><div className="sub">Sin datos del cliente todavía.</div></div></div>;
  const territorio = c.territorio_fiscal ? TERRITORIO[c.territorio_fiscal] ?? c.territorio_fiscal : null;
  return (
    <div className="vista">
      <h1 className="pagina">Cliente y licencia</h1>
      <div className="subpagina">Los datos que necesita el soporte cuando llamas.</div>
      <Seccion titulo="Licencia">
        <div className="ficha">
          <Campo k="Plan" v={c.plan ?? "—"} />
          <Campo k="Renovación" v={fecha(c.licencia_hasta)} />
          <Campo k="Módulos activos" v={`${e.modulos.filter((m) => m.activo).length} de ${e.modulos.length}`} />
          <Campo k="Alta" v={fecha(c.alta)} />
        </div>
      </Seccion>
      <Seccion titulo="Datos del cliente">
        <div className="ficha">
          <Campo k="Razón social" v={c.razon_social ?? c.tenant_nombre} />
          <Campo k="Nombre comercial" v={c.nombre_comercial ?? "—"} />
          <Campo k="CIF / NIF" v={c.cif ?? c.tenant_cif ?? "—"} mono />
          <Campo k="Territorio fiscal" v={territorio ?? "—"} />
          <Campo k="Serie de factura" v={c.serie_factura ?? "—"} mono />
          <Campo k="Local" v={[c.direccion, c.codigo_postal, c.poblacion, c.provincia].filter(Boolean).join(" · ") || "—"} ancho />
          <Campo k="Persona de contacto" v={c.contacto ?? "—"} />
          <Campo k="Teléfono" v={c.telefono ?? "—"} mono />
          <Campo k="Correo" v={c.email ?? "—"} ancho />
        </div>
      </Seccion>
    </div>
  );
}

function Copias({ e }: { e: Estado }) {
  const [abierto, setAbierto] = React.useState<"nube" | "local" | null>("nube");
  const alDia = e.sincronizacion.ventasPorSubir === 0 && e.sincronizacion.imagenesPorSubir === 0 && e.sincronizacion.conError === 0;
  return (
    <div className="vista">
      <h1 className="pagina">Copias de seguridad</h1>
      <div className="subpagina">Dos copias por si el equipo se rompe: una fuera del local (la nube) y otra aquí mismo.</div>

      <div className={`expansor ${abierto === "nube" ? "abierto" : ""}`}>
        <button className="exp-cab" onClick={() => setAbierto(abierto === "nube" ? null : "nube")}>
          <div className="txt-fila"><div className="t">Copia en la nube</div>
            <div className="s">{alDia ? "Al día" : "Con cambios por subir"} · Última: {cuando(e.sincronizacion.ultimaSync)}</div></div>
          {alDia ? <Pastilla tono="ok">A salvo</Pastilla> : <Pastilla tono="av">Pendiente</Pastilla>}
          <span className="chevron"><Ico t="chevron" /></span>
        </button>
        <div className="exp-cuerpo">
          <dl className="datos">
            <dt>Qué se sube</dt><dd>Datos del bar y fotos de la carta</dd>
            <dt>Ventas por subir</dt><dd>{e.sincronizacion.ventasPorSubir}</dd>
            <dt>Imágenes por subir</dt><dd>{e.sincronizacion.imagenesPorSubir}</dd>
            <dt>Errores de sincronización</dt><dd>{e.sincronizacion.conError}</dd>
            <dt>Última venta registrada</dt><dd>{cuando(e.sincronizacion.ultimaVenta)}</dd>
          </dl>
        </div>
      </div>

      <div className={`expansor ${abierto === "local" ? "abierto" : ""}`}>
        <button className="exp-cab" onClick={() => setAbierto(abierto === "local" ? null : "local")}>
          <div className="txt-fila"><div className="t">Copia en el propio equipo</div>
            <div className="s">{e.copia.hay} copia(s) · {tamano(e.copia.ocupa)} · Última: {cuando(e.copia.ultima)}</div></div>
          {e.copia.hay === 0 ? <Pastilla tono="ko">Sin copia</Pastilla> : e.copia.hay === 1 ? <Pastilla tono="av">Solo 1</Pastilla> : <Pastilla tono="ok">{e.copia.hay} copias</Pastilla>}
          <span className="chevron"><Ico t="chevron" /></span>
        </button>
        <div className="exp-cuerpo">
          <dl className="datos">
            <dt>Carpeta</dt><dd className="mono">{e.copia.carpeta}</dd>
            <dt>Copias guardadas</dt><dd>{e.copia.hay}</dd>
          </dl>
        </div>
      </div>

      <Seccion titulo="Últimas copias">
        <div className="tabla">
          <table>
            <thead><tr><th style={{ width: "40%" }}>Fecha</th><th>Dónde</th><th className="mono acc">Tamaño</th></tr></thead>
            <tbody>
              {e.copia.lista.length === 0 && <tr><td colSpan={3} className="sub">Todavía no hay copias en este equipo.</td></tr>}
              {e.copia.lista.map((c, i) => (
                <tr key={i}><td>{new Date(c.cuando).toLocaleString("es-ES")}</td><td className="sub">Este equipo</td><td className="mono acc">{tamano(c.ocupa)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
    </div>
  );
}

function Campo({ k, v, mono, ancho }: { k: string; v: string; mono?: boolean; ancho?: boolean }) {
  return <div className={`campo ${ancho ? "ancho" : ""}`}><div className="k">{k}</div><div className={`v ${mono ? "mono" : ""}`}>{v}</div></div>;
}

// ————————————————————————————————————————————————————————————— iconos (línea, 16px)
function Ico({ t }: { t: string }) {
  const p: Record<string, React.ReactNode> = {
    descargar: <><path d="M8 3v7M5 7.2L8 10.3l3-3.1" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><path d="M2.8 11.5v1.2c0 .4.3.8.8.8h8.8c.5 0 .8-.4.8-.8v-1.2" strokeWidth="1.3" strokeLinecap="round" /></>,
    reiniciar: <><path d="M13 7.6a5 5 0 11-1.7-3.4" strokeWidth="1.3" strokeLinecap="round" /><path d="M13.2 2v2.8h-2.8" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></>,
    disp: <><rect x="1.5" y="3" width="8" height="6" rx="1" strokeWidth="1.2" /><rect x="10.5" y="6.5" width="4" height="7" rx="1" strokeWidth="1.2" /></>,
    info: <><circle cx="9" cy="9" r="7.2" strokeWidth="1.3" /><path d="M9 8.2v4" strokeWidth="1.5" strokeLinecap="round" /><circle cx="9" cy="5.8" r=".85" fill="currentColor" stroke="none" /></>,
    aviso: <><path d="M9 2.6l6.4 11.2H2.6L9 2.6z" strokeWidth="1.3" strokeLinejoin="round" /><path d="M9 7v3.2" strokeWidth="1.4" strokeLinecap="round" /><circle cx="9" cy="12.2" r=".8" fill="currentColor" stroke="none" /></>,
    modulo: <><rect x="2" y="2.5" width="5" height="5" rx="1" strokeWidth="1.2" /><rect x="9" y="2.5" width="5" height="5" rx="1" strokeWidth="1.2" /><rect x="2" y="8.5" width="5" height="5" rx="1" strokeWidth="1.2" /><rect x="9" y="8.5" width="5" height="5" rx="1" strokeWidth="1.2" /></>,
    chevron: <path d="M2 4.5L6 8.5l4-4" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />,
  };
  const grande = t === "info" || t === "aviso";
  return <svg width={grande ? 18 : 16} height={grande ? 18 : 16} viewBox={grande ? "0 0 18 18" : "0 0 16 16"} fill="none" stroke="currentColor" aria-hidden>{p[t]}</svg>;
}

// ————————————————————————————————————————————————————————————— estilo Fluent
const CSS = `
:root{
  --mica:#1F1F1F;--capa:#272727;--tarjeta:#2B2B2B;--tarjeta-hover:#323232;
  --control:#2D2D2D;--control-hover:#353535;--control-press:#2A2A2A;
  --borde:rgba(255,255,255,.0698);--borde-fuerte:rgba(255,255,255,.1);--divisoria:rgba(255,255,255,.0837);
  --txt:#FFFFFF;--txt-2:rgba(255,255,255,.786);--txt-3:rgba(255,255,255,.544);--txt-4:rgba(255,255,255,.363);
  --acento:#60CDFF;--acento-2:#4CC2FF;--sobre-acento:#000;--exito:#6CCB5F;--aviso:#FCE100;--critico:#FF99A4;--cerrar:#C42B1C;
  --fuente:"Segoe UI Variable Text","Segoe UI Variable","Segoe UI",system-ui,-apple-system,sans-serif;
  --fuente-titulo:"Segoe UI Variable Display","Segoe UI Variable","Segoe UI",system-ui,sans-serif;
}
.servidor-reset,body{margin:0}
*{box-sizing:border-box}
body{font-family:var(--fuente);font-size:14px;line-height:20px;color:var(--txt);
  background:#0C1116;background-image:radial-gradient(1200px 700px at 70% 10%,#1B3350 0,transparent 60%),radial-gradient(900px 600px at 10% 90%,#14243A 0,transparent 60%);
  -webkit-font-smoothing:antialiased;overflow:hidden}
.caido{min-height:100vh;display:grid;place-items:center;text-align:center;background:#0C1116;color:#fff;font-family:var(--fuente)}
.caido h1{font-family:var(--fuente-titulo);font-size:28px;margin-top:12px;color:var(--critico)}
.caido .sub{color:var(--txt-3);margin-top:6px}
.ventana{width:100vw;height:100vh;background:var(--mica);display:flex;flex-direction:column;overflow:hidden}
.titulo{height:32px;flex:0 0 32px;display:flex;align-items:center;padding-left:12px;user-select:none;-webkit-app-region:drag}
.titulo .id{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--txt-2)}
.cuerpo{flex:1;display:grid;grid-template-columns:252px 1fr;min-height:0}
.nav{padding:8px 4px;display:flex;flex-direction:column;gap:2px;border-right:1px solid var(--borde);overflow:auto}
.nav-item{display:flex;align-items:center;gap:12px;height:36px;padding:0 12px;margin:0 4px;border-radius:4px;color:var(--txt-2);cursor:pointer;position:relative;font-size:14px;border:0;background:transparent;font-family:inherit;text-align:left;width:calc(100% - 8px)}
.nav-item:hover{background:rgba(255,255,255,.0605)}
.nav-item.activo{background:rgba(255,255,255,.0837);color:var(--txt)}
.nav-item.activo::before{content:"";position:absolute;left:-4px;top:9px;width:3px;height:18px;border-radius:2px;background:var(--acento)}
.nav-item .insignia{margin-left:auto;background:var(--acento);color:var(--sobre-acento);font-size:11px;font-weight:600;min-width:18px;height:18px;border-radius:9px;display:grid;place-items:center;padding:0 5px}
.nav-item .insignia.gris{background:rgba(255,255,255,.12);color:var(--txt-2)}
.nav-sep{height:1px;background:var(--divisoria);margin:6px 12px}
.nav-cab{font-size:12px;color:var(--txt-3);padding:6px 16px 2px}
.contenido{background:var(--capa);border-top-left-radius:8px;border-left:1px solid var(--borde);border-top:1px solid var(--borde);overflow:auto;padding:20px 32px 40px}
.contenido::-webkit-scrollbar{width:14px}
.contenido::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border:5px solid transparent;background-clip:padding-box;border-radius:8px}
.vista{animation:entrar .25s cubic-bezier(0,0,0,1) both}
@keyframes entrar{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
h1.pagina{font-family:var(--fuente-titulo);font-size:28px;line-height:36px;font-weight:600;letter-spacing:-.01em;margin-bottom:4px}
.subpagina{color:var(--txt-3);font-size:14px;margin-bottom:18px}
.comandos{display:flex;gap:4px;align-items:center;margin-bottom:18px;flex-wrap:wrap}
.cmd{display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 11px;border:1px solid var(--borde-fuerte);border-radius:4px;background:var(--control);color:var(--txt);font-family:inherit;font-size:14px;cursor:pointer;white-space:nowrap}
.cmd:hover{background:var(--control-hover)}
.cmd:active{background:var(--control-press);color:var(--txt-2)}
.cmd svg{color:var(--txt-2);flex:0 0 auto}
.cmd-sep{width:1px;height:20px;background:var(--divisoria);margin:0 4px}
.infobar{display:flex;gap:12px;align-items:flex-start;border:1px solid var(--borde);border-radius:4px;padding:12px 14px;margin-bottom:24px;background:#393D1B}
.infobar.av{background:#433519}.infobar.info{background:#233043}
.infobar .ico{flex:0 0 auto;margin-top:1px;color:var(--exito)}
.infobar.av .ico{color:var(--aviso)}.infobar.info .ico{color:var(--acento)}
.infobar b{font-weight:600}.infobar p{color:var(--txt-2);font-size:14px}
.seccion{margin-bottom:26px}
.seccion>h2{font-family:var(--fuente-titulo);font-size:16px;font-weight:600;line-height:22px;margin-bottom:8px;display:flex;align-items:center;gap:10px}
.seccion>h2 .aparte{font-size:12px;color:var(--txt-3);font-weight:400;margin-left:auto;text-transform:capitalize}
.pila{display:flex;flex-direction:column;gap:4px}
.fila{display:flex;align-items:center;gap:16px;background:var(--tarjeta);border:1px solid var(--borde);border-radius:4px;padding:12px 16px;min-height:60px}
.fila .txt-fila{flex:1;min-width:0}
.fila .t{font-size:14px;line-height:20px}
.fila .s{font-size:12px;line-height:16px;color:var(--txt-3);margin-top:1px}
.fila .val{font-size:13px;color:var(--txt-3);white-space:nowrap;font-variant-numeric:tabular-nums}
.pastilla{display:inline-flex;align-items:center;gap:7px;font-size:12px;line-height:16px;font-weight:600;padding:3px 9px;border-radius:12px;border:1px solid var(--borde-fuerte);background:rgba(255,255,255,.04);color:var(--txt-2);white-space:nowrap}
.pastilla i{width:6px;height:6px;border-radius:50%;background:currentColor;flex:0 0 6px}
.pastilla.ok{color:#A9E39F;border-color:rgba(108,203,95,.35);background:rgba(108,203,95,.12)}
.pastilla.av{color:#F5E48A;border-color:rgba(252,225,0,.3);background:rgba(252,225,0,.1)}
.pastilla.ko{color:var(--critico);border-color:rgba(255,153,164,.3);background:rgba(255,99,99,.12)}
.pastilla.off{color:var(--txt-3)}
.rejilla{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.cifra{background:var(--tarjeta);border:1px solid var(--borde);border-radius:4px;padding:14px 16px}
.cifra .n{font-family:var(--fuente-titulo);font-size:24px;line-height:32px;font-weight:600;font-variant-numeric:tabular-nums}
.cifra .e{font-size:12px;color:var(--txt-3);margin-top:2px}
.cifra .n.cero{color:var(--txt-4)}.cifra .n.ok{color:#A9E39F}.cifra .n.av{color:#F5E48A}
.tabla{background:var(--tarjeta);border:1px solid var(--borde);border-radius:4px;overflow:hidden}
table{width:100%;border-collapse:collapse}
th{font-size:12px;font-weight:600;color:var(--txt-3);text-align:left;padding:9px 16px;border-bottom:1px solid var(--divisoria);white-space:nowrap;background:rgba(255,255,255,.02)}
td{padding:10px 16px;border-bottom:1px solid var(--divisoria);font-size:14px;vertical-align:middle}
tbody tr:last-child td{border-bottom:0}
tbody tr:hover td{background:rgba(255,255,255,.04)}
td.mono,th.mono{font-variant-numeric:tabular-nums;font-family:Consolas,"Cascadia Mono",monospace;font-size:13px;color:var(--txt-2)}
td .sub,.sub{font-size:12px;color:var(--txt-3)}
td.acc,th.acc{text-align:right;white-space:nowrap}
tr.apagado td{color:var(--txt-3)}
.tarjeta{background:var(--tarjeta);border:1px solid var(--borde);border-radius:4px;padding:16px}
.uso{display:grid;grid-template-columns:170px 1fr 120px;gap:14px;align-items:center;font-size:14px;padding:6px 0}
.uso .peso{text-align:right;color:var(--txt-2);font-variant-numeric:tabular-nums;font-size:13px}
.pista{height:4px;background:rgba(255,255,255,.09);border-radius:2px;overflow:hidden}
.pista i{display:block;height:100%;background:var(--acento-2);border-radius:2px;animation:crecer .6s cubic-bezier(0,0,0,1) both .15s;transform-origin:left}
.pista i.am{background:var(--aviso)}.pista i.vd{background:var(--exito)}
@keyframes crecer{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.pie-tarjeta{font-size:12px;color:var(--txt-3);margin-top:10px;padding-top:10px;border-top:1px solid var(--divisoria)}
.expansor{background:var(--tarjeta);border:1px solid var(--borde);border-radius:4px;overflow:hidden}
.expansor+.expansor{margin-top:4px}
.exp-cab{display:flex;align-items:center;gap:16px;width:100%;background:transparent;border:0;color:var(--txt);font-family:inherit;text-align:left;padding:12px 16px;min-height:60px;cursor:pointer}
.exp-cab:hover{background:var(--tarjeta-hover)}
.exp-cab .chevron{transition:transform .18s;color:var(--txt-2);flex:0 0 auto}
.expansor.abierto .exp-cab .chevron{transform:rotate(180deg)}
.exp-cuerpo{display:none;padding:14px 16px 16px 16px;background:var(--capa);border-top:1px solid var(--divisoria)}
.expansor.abierto .exp-cuerpo{display:block}
dl.datos{display:grid;grid-template-columns:220px 1fr;gap:8px 16px;font-size:13px}
dl.datos dt{color:var(--txt-3)}dl.datos dd{color:var(--txt-2)}dl.datos dd.mono{font-family:Consolas,"Cascadia Mono",monospace}
.enlace{color:var(--acento);text-decoration:none;font-size:13px;background:none;border:0;padding:0;cursor:pointer;font-family:inherit}
.enlace:hover{text-decoration:underline}
.modulos{display:grid;grid-template-columns:repeat(2,1fr);gap:4px}
.modulo{background:var(--tarjeta);border:1px solid var(--borde);border-radius:4px;padding:16px;display:flex;gap:14px;align-items:flex-start}
.modulo .icono{width:32px;height:32px;border-radius:4px;background:rgba(96,205,255,.12);color:var(--acento);display:grid;place-items:center;flex:0 0 32px}
.modulo.no .icono{background:rgba(255,255,255,.05);color:var(--txt-3)}
.modulo .cuerpo-m{flex:1;min-width:0}
.modulo h3{font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.modulo p{font-size:12px;color:var(--txt-3);margin-top:4px;line-height:16px}
.ficha{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.campo{background:var(--tarjeta);border:1px solid var(--borde);border-radius:4px;padding:12px 16px}
.campo .k{font-size:12px;color:var(--txt-3)}
.campo .v{font-size:14px;margin-top:2px}
.campo .v.mono{font-family:Consolas,"Cascadia Mono",monospace;font-size:13px;letter-spacing:.02em}
.campo.ancho{grid-column:1 / -1}
.filtros{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
.chip{height:28px;padding:0 12px;border-radius:14px;border:1px solid var(--borde-fuerte);background:transparent;color:var(--txt-2);font-family:inherit;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:7px}
.chip:hover{background:rgba(255,255,255,.06)}
.chip.activo{background:var(--acento-2);border-color:transparent;color:var(--sobre-acento);font-weight:600}
.sev{display:inline-flex;align-items:center;gap:8px;font-size:13px}
.sev i{width:8px;height:8px;border-radius:2px;flex:0 0 8px;transform:rotate(45deg)}
.sev.i i{background:var(--acento)}.sev.a i{background:var(--aviso)}.sev.e i{background:var(--critico)}
.estado-barra{flex:0 0 26px;height:26px;border-top:1px solid var(--borde);background:var(--mica);display:flex;align-items:center;gap:18px;padding:0 12px;font-size:12px;color:var(--txt-3)}
.estado-barra .der{margin-left:auto;font-variant-numeric:tabular-nums}
.estado-barra .punto{display:inline-flex;align-items:center;gap:6px}
.estado-barra .punto::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--exito)}
@media (max-width:1000px){.modulos,.ficha{grid-template-columns:1fr}.rejilla{grid-template-columns:repeat(2,1fr)}}
@media (max-width:860px){.cuerpo{grid-template-columns:1fr}.nav{display:none}.contenido{border-radius:0;border-left:0;padding:16px}.oculta-movil{display:none}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;
