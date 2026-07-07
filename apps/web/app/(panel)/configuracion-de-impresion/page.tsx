"use client";

// Configuración de impresión: diseño del ticket (qué líneas salen, ancho, pie),
// impresoras del local, y a qué impresora va cada tipo de documento. Se guarda
// en `setting` (GLOBAL) y el TPV lo aplica al imprimir. Vista previa en vivo.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Printer, Plus, Trash2, Download, TriangleAlert } from "lucide-react";
import { toast } from "@/app/lib/toast";
import { getSetting, setSetting } from "../../lib/settings";
import {
  formatearTicket, guardarTicketComoFichero,
  type TicketImpresion, type DisenoTicket, type ImpresoraCfg, type ConfigImpresion,
} from "../../lib/impresion";
import { ESTACIONES, ESTACION_LABEL, type Estacion } from "../../lib/estaciones";
import { leerBranding } from "../../lib/branding";
import { ZonaTecnica, ClaveTecnicaCard } from "@/components/zona-tecnica";
import { ConfigTerminal } from "@/components/config-terminal";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Ancho = 58 | 80;
// Misma forma que ConfigImpresion (lib/impresion.ts, la única fuente de verdad),
// pero con los tres bloques siempre presentes para trabajar cómodos en la UI.
type CfgImpresion = Required<ConfigImpresion>;

const CLAVE = "impresion.config";
const DEFECTO: CfgImpresion = {
  ticket: { anchoMm: 80, logo: false, nombre: true, cif: true, direccion: true, cabecera: "", fecha: true, mesaOperario: true, lineas: true, desglose: true, total: true, qr: true, pie: "¡Gracias por su visita!" },
  impresoras: [], rutas: {},
};
const DOCS = [
  { k: "TICKET_CLIENTE", t: "Ticket de cliente" },
  { k: "FACTURA", t: "Factura" },
  { k: "COMANDA_COCINA", t: "Comanda de cocina" },
  { k: "COMANDA_BARRA", t: "Comanda de barra" },
  { k: "TICKET_CAMARERO", t: "Ticket para camarero" },
];
function Toggle({ on, onClick, label }: { on: boolean; onClick(): void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
      <span>{label}</span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-brand" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export default function ConfiguracionImpresion() {
  const [cfg, setCfg] = useState<CfgImpresion>(DEFECTO);
  const [local, setLocal] = useState({ nombre: "Mi Bar", cif: "B12345678", direccion: "Calle Mayor 1" });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Impresoras con el URI en modo "avanzado" (edición libre en vez de IP+puerto).
  const [uriAvanzado, setUriAvanzado] = useState<Set<string>>(new Set());
  // Reparto por estación: nº de productos por estación + cuántos sin asignar.
  const [porEstacion, setPorEstacion] = useState<Record<Estacion, number> | null>(null);
  const [sinEstacion, setSinEstacion] = useState(0);
  const enDesktop = mounted && typeof window !== "undefined" && !!window.gluuh;

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    (async () => {
      const guardado = await getSetting<CfgImpresion>(CLAVE).catch(() => null);
      if (guardado) setCfg({ ...DEFECTO, ...guardado, ticket: { ...DEFECTO.ticket, ...guardado.ticket } });
      const { supabaseBrowser } = await import("../../lib/supabaseBrowser");
      const sb = supabaseBrowser();
      const [{ data }, { data: prods }, marca] = await Promise.all([
        sb.from("location").select("nombre,cif,direccion").limit(1).maybeSingle(),
        sb.from("product").select("estacion"),
        leerBranding(sb),
      ]);
      if (data) setLocal({ nombre: data.nombre ?? "Mi Bar", cif: data.cif ?? "", direccion: data.direccion ?? "" });
      // Logo de tickets (b/n) si existe; si no, cae al logo de marca.
      setLogoUrl(marca.logo_ticket_url || marca.logo_url);
      const conteo: Record<Estacion, number> = { COCINA: 0, BARRA: 0, CAMARERO: 0, NINGUNA: 0 };
      let sin = 0;
      for (const p of (prods as { estacion: string | null }[]) ?? []) {
        if (p.estacion && (ESTACIONES as readonly string[]).includes(p.estacion)) conteo[p.estacion as Estacion]++;
        else sin++; // null o valor raro → estacionDe() lo manda a Cocina
      }
      setPorEstacion(conteo);
      setSinEstacion(sin);
    })();
  }, []);

  function addImpresora() {
    setCfg((c) => ({
      ...c,
      impresoras: [...c.impresoras, {
        id: crypto.randomUUID(), nombre: "Impresora", uri: "tcp://192.168.1.50:9100",
        anchoMm: 80, copias: 1, abreCajon: false, activa: true,
      }],
    }));
  }
  function delImpresora(id: string) {
    setCfg((c) => ({ ...c, impresoras: c.impresoras.filter((p) => p.id !== id), rutas: Object.fromEntries(Object.entries(c.rutas).filter(([, v]) => v !== id)) }));
  }
  /** Actualiza una impresora por id con un parche parcial. */
  function setImp(id: string, patch: Partial<ImpresoraCfg>) {
    setCfg((c) => ({ ...c, impresoras: c.impresoras.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  }
  /** Si el URI es de red (tcp://IP:puerto) devuelve sus partes; si no, null. */
  function parseRed(uri: string): { ip: string; puerto: string } | null {
    const m = /^tcp:\/\/([^:/]+):(\d+)$/.exec(uri.trim());
    return m ? { ip: m[1]!, puerto: m[2]! } : null;
  }
  async function abrirCajonAhora() {
    const gluuh = window.gluuh;
    if (!gluuh) return;
    const r = await gluuh.abrirCajon();
    if (r.ok) toast.success("Orden de apertura enviada al cajón.");
    else toast.error("No se pudo abrir el cajón.");
  }

  async function guardar() {
    setSaving(true); setMsg("");
    try { await setSetting("GLOBAL", CLAVE, cfg); setMsg("Configuración guardada ✓"); }
    catch (e) { setMsg(`Error: ${e instanceof Error ? e.message : e}`); }
    finally { setSaving(false); }
  }

  // Vista previa: el mismo formateo que la impresión real, con datos de muestra.
  const muestra: TicketImpresion = {
    local, contexto: "Mesa 5", operario: "Ana",
    lineas: [{ cantidad: 2, nombre: "Caña", importe: 3.0 }, { cantidad: 1, nombre: "Ensalada César", importe: 8.5 }],
    desglose: [{ etiqueta: "IVA 10% (base 10,45)", cuota: 1.05 }],
    total: 11.5, leyenda: "VERI*FACTU", huella: "A1B2C3D4E5F6",
  };
  const diseno: DisenoTicket = cfg.ticket;
  const preview = formatearTicket(muestra, diseno);

  // Prueba real: mismo ticket de muestra marcado como PRUEBA, directo a la IP
  // de la impresora vía Gluuh Desktop (en navegador no hay envío nativo).
  async function imprimirPrueba(p: ImpresoraCfg) {
    const gluuh = window.gluuh;
    if (!gluuh) return;
    const lineas = formatearTicket({ ...muestra, esPrueba: true }, { ...cfg.ticket, anchoMm: p.anchoMm });
    const r = await gluuh.imprimir({ lineas, cortar: true, impresora: { uri: p.uri, ancho: p.anchoMm === 58 ? 32 : 42 } });
    if (r.ok) toast.success(`Prueba enviada a ${p.nombre}`);
    else toast.error(r.error ?? `No se pudo imprimir en ${p.nombre}`);
  }

  return (
    <ZonaTecnica>
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Configuración de impresión" description="Diseña el ticket, define tus impresoras y decide qué sale en cada una." />

      {/* Servidor/IP y backup del terminal (app de escritorio). */}
      <ConfigTerminal />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {/* El diseño del ticket vive en Plantillas de ticket (Administración → General). */}
          <Card>
            <CardContent className="flex items-center justify-between gap-3 pt-6">
              <div className="flex items-center gap-2.5 text-sm">
                <Printer className="h-4 w-4 text-muted-foreground" aria-hidden />
                <span>
                  <span className="block font-medium">Diseño del ticket</span>
                  <span className="block text-[11px] text-muted-foreground">Cabecera, líneas, pie y QR se editan en Plantillas de ticket.</span>
                </span>
              </div>
              <Link href="/plantillas-ticket" className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-surface-overlay">Editar diseño</Link>
            </CardContent>
          </Card>

          {/* Impresoras */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Impresoras</CardTitle>
                <CardDescription>Red (IP:puerto, normalmente 9100) o URI avanzado. Copias, cajón y activa por impresora.</CardDescription>
              </div>
              <div className="flex items-center gap-1.5">
                {enDesktop && (
                  <Button type="button" variant="outline" size="sm" onClick={abrirCajonAhora} title="Manda la orden de apertura por la impresora predeterminada del escritorio">
                    Abrir cajón
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={addImpresora}><Plus className="h-4 w-4" /> Añadir</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {cfg.impresoras.length === 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Sin impresoras. Añade la de barra, la de cocina… Mientras no haya ninguna,
                    los tickets se guardarán como fichero para no perderse.
                  </p>
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => guardarTicketComoFichero(preview, `ticket-prueba-${new Date().toISOString().slice(0, 10)}.txt`)}
                  >
                    <Download className="h-4 w-4" aria-hidden /> Descargar ticket de prueba
                  </Button>
                </div>
              )}
              {cfg.impresoras.map((p) => {
                const red = uriAvanzado.has(p.id) ? null : parseRed(p.uri);
                const inactiva = p.activa === false;
                return (
                  <div key={p.id} className={`space-y-2 rounded-md border p-2.5 ${inactiva ? "border-border opacity-60" : "border-border"}`}>
                    {/* Fila 1: nombre · activa · eliminar */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Input className="w-44 font-medium" value={p.nombre} onChange={(e) => setImp(p.id, { nombre: e.target.value })} placeholder="Barra, Cocina, Caja…" aria-label="Nombre de la impresora" />
                      <Toggle label="Activa" on={!inactiva} onClick={() => setImp(p.id, { activa: inactiva })} />
                      {inactiva && <span className="text-xs text-amber-600 dark:text-amber-500">Sus documentos no se imprimirán.</span>}
                      <button type="button" onClick={() => delImpresora(p.id)} aria-label={`Quitar ${p.nombre}`} title="Quitar impresora" className="ml-auto text-rose-500 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    {/* Fila 2: conexión · ancho · copias · cajón · prueba */}
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={red ? "RED" : "URI"}
                        onChange={(e) => {
                          setUriAvanzado((prev) => {
                            const next = new Set(prev);
                            if (e.target.value === "URI") next.add(p.id);
                            else next.delete(p.id);
                            return next;
                          });
                          if (e.target.value === "RED" && !parseRed(p.uri)) setImp(p.id, { uri: "tcp://192.168.1.50:9100" });
                        }}
                        className="rounded-md border border-border bg-background px-2 py-2 text-sm"
                        aria-label="Tipo de conexión"
                      >
                        <option value="RED">Red</option>
                        <option value="URI">Avanzado</option>
                      </select>
                      {red ? (
                        <>
                          <Input className="w-36 font-mono text-xs" value={red.ip} onChange={(e) => setImp(p.id, { uri: `tcp://${e.target.value.trim()}:${red.puerto}` })} placeholder="192.168.1.50" aria-label="Dirección IP" />
                          <Input className="w-20 font-mono text-xs" inputMode="numeric" value={red.puerto} onChange={(e) => setImp(p.id, { uri: `tcp://${red.ip}:${e.target.value.replace(/\D/g, "") || "9100"}` })} placeholder="9100" aria-label="Puerto" />
                        </>
                      ) : (
                        <Input className="min-w-48 flex-1 font-mono text-xs" value={p.uri} onChange={(e) => setImp(p.id, { uri: e.target.value })} placeholder="tcp://192.168.1.50:9100" aria-label="URI de la impresora" />
                      )}
                      <select value={p.anchoMm} onChange={(e) => setImp(p.id, { anchoMm: Number(e.target.value) as Ancho })} className="rounded-md border border-border bg-background px-2 py-2 text-sm" aria-label="Ancho de papel">
                        <option value={80}>80 mm</option><option value={58}>58 mm</option>
                      </select>
                      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        Copias
                        <Input className="w-14 text-center tabular-nums" inputMode="numeric" value={p.copias ?? 1}
                          onChange={(e) => setImp(p.id, { copias: Math.max(1, Math.min(5, Number(e.target.value.replace(/\D/g, "")) || 1)) })}
                          aria-label={`Copias de ${p.nombre}`} />
                      </label>
                      <Toggle label="Cajón" on={!!p.abreCajon} onClick={() => setImp(p.id, { abreCajon: !p.abreCajon })} />
                      <Button
                        type="button" variant="outline" size="sm"
                        onClick={() => imprimirPrueba(p)}
                        disabled={!enDesktop}
                        title={enDesktop ? `Imprime un ticket de prueba en ${p.nombre}` : "Disponible en la app de escritorio"}
                      >
                        <Printer className="h-4 w-4" aria-hidden /> Prueba
                      </Button>
                    </div>
                    {p.abreCajon && (
                      <p className="text-[11px] text-muted-foreground">El cajón (RJ11) se abrirá por esta impresora al cobrar en efectivo.</p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Tipos de impresión (enrutado) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tipos de impresión</CardTitle>
              <CardDescription>A qué impresora va cada documento. La comanda de cocina/barra sale sin precios; el ticket y la factura, para el cliente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {DOCS.map((d) => {
                const asignada = cfg.impresoras.find((p) => p.id === cfg.rutas[d.k]);
                const inactiva = asignada?.activa === false;
                return (
                  <div key={d.k} className="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm">
                    <span className="flex items-center gap-2">
                      <Printer className="h-4 w-4 text-muted-foreground" /> {d.t}
                      {inactiva && (
                        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-500">
                          impresora desactivada
                        </span>
                      )}
                    </span>
                    <select value={cfg.rutas[d.k] ?? ""} onChange={(e) => setCfg((c) => ({ ...c, rutas: { ...c.rutas, [d.k]: e.target.value } }))} className="rounded-md border border-border bg-background px-2 py-1.5">
                      <option value="">— Sin imprimir —</option>
                      {cfg.impresoras.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}{(p.copias ?? 1) > 1 ? ` (x${p.copias})` : ""}{p.activa === false ? " — desactivada" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Reparto por estación: a dónde irán las comandas según product.estacion */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reparto por estación</CardTitle>
              <CardDescription>Cada producto se manda a su estación al marchar; la comanda de cada estación sale por la impresora elegida arriba.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {porEstacion === null ? (
                <Skeleton className="h-5 w-64" />
              ) : (
                <>
                  <p className="text-sm">
                    {ESTACIONES.map((s, i) => (
                      <span key={s}>
                        {i > 0 && <span className="text-muted-foreground"> · </span>}
                        {ESTACION_LABEL[s]} <b className="tabular-nums">{porEstacion[s]}</b>
                      </span>
                    ))}
                  </p>
                  {sinEstacion > 0 && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                      <p>
                        <b>{sinEstacion}</b> {sinEstacion === 1 ? "producto sin estación saldrá" : "productos sin estación saldrán"} por
                        Cocina. Asígnala en la <Link href="/carta" className="underline underline-offset-2">Carta</Link>.
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "Guardar configuración"}</Button>
            {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
          </div>

          <ClaveTecnicaCard />
        </div>

        {/* Vista previa: una columna de papel térmico (blanca siempre, es papel)
            sobre fondo neutro, con sombra y borde inferior dentado. */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vista previa</p>
          <div className="flex justify-center overflow-x-auto rounded-lg border border-border bg-muted/60 px-4 pt-6 pb-8">
            <div className="drop-shadow-md" style={{ width: cfg.ticket.anchoMm === 58 ? 236 : 306 }}>
              <div className="overflow-x-auto bg-white px-3 pt-4 pb-2 text-black">
                {cfg.ticket.logo && logoUrl && <img src={logoUrl} alt="" className="mx-auto mb-2 max-w-[60%]" />}
                <pre className="whitespace-pre font-mono text-[10.5px] leading-[1.45]">{preview.join("\n")}</pre>
              </div>
              {/* Borde dentado del corte: triángulos blancos sobre el fondo neutro. */}
              <div
                aria-hidden
                className="h-2.5"
                style={{
                  background: "linear-gradient(135deg, #fff 50%, transparent 50%), linear-gradient(225deg, #fff 50%, transparent 50%)",
                  backgroundSize: "10px 10px",
                  backgroundRepeat: "repeat-x",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    </ZonaTecnica>
  );
}
