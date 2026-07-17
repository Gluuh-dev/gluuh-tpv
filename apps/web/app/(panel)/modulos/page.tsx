"use client";

// Módulos y pantallas: interruptor por módulo (tabla tenant_module; sin fila =
// activo), dispositivos vinculados a cada módulo y emparejado por código de
// 6 dígitos, todo en una sola página (absorbe la antigua /dispositivos).
// Guía: docs/implementacion/04-modulos-y-emparejado.md.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Plus, Settings2, Trash2, X } from "lucide-react";
import { toast } from "@/app/lib/toast";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import {
  CONFIG_CARTELERIA_DEF, CONFIG_COCINA_DEF, CONFIG_KIOSKO_DEF, CONFIG_PANTALLA_DEF,
  CONFIG_VISOR_DEF, MODULOS, configCon, guardarConfigModulo, leerConfigModulo,
  leerLicencia, licenciaVigente, modulosInactivos,
  type DefModulo, type DisenoKiosko, type Modulo,
} from "../../lib/modulos";
import { ZonaTecnica } from "@/components/zona-tecnica";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface Dispositivo {
  id: string;
  nombre: string;
  tipo: string;
  modulo: string | null;
  codigo_vinculacion: string | null;
  codigo_expira: string | null;
  vinculado_at: string | null;
  /** Grupo de puntos de venta (0067); null = sin grupo. */
  grupo_punto_venta_id: string | null;
  /** Estación del monitor KDS (0068); null = la global del módulo Cocina. */
  estacion: string | null;
  /** Última señal de vida del equipo (0080); null = nunca conectó. */
  ultima_conexion?: string | null;
}

// "En línea" si latió en los últimos 3 min; si no, hace cuánto (aprox.).
function estadoConexion(iso: string | null | undefined): { enLinea: boolean; texto: string } | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 180_000) return { enLinea: true, texto: "En línea" };
  const min = Math.floor(ms / 60_000);
  if (min < 60) return { enLinea: false, texto: `hace ${min} min` };
  const h = Math.floor(min / 60);
  return { enLinea: false, texto: h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d` };
}

interface GrupoPV { id: string; nombre: string }
const SIN_GRUPO_PV = "__sin__"; // Radix Select no admite value=""
const ESTACION_GLOBAL = "__global__";
// Estaciones que puede fijar un monitor de cocina (mismas que la config global).
const ESTACIONES_KDS = [
  { v: "COCINA", t: "Cocina" }, { v: "BARRA", t: "Barra" },
  { v: "CAMARERO", t: "Camarero" }, { v: "TODAS", t: "Todas" },
];

interface CodigoActivo {
  modulo: Modulo;
  deviceId: string;
  codigo: string;
  expira: number; // epoch ms
}

/** Módulo al que pertenece un dispositivo (filas antiguas solo traían tipo). */
function moduloDe(d: Dispositivo): string {
  return d.modulo ?? (d.tipo === "KDS" ? "COCINA" : d.tipo);
}

function codigoVivo(d: Dispositivo): boolean {
  return !!d.codigo_vinculacion && !!d.codigo_expira && new Date(d.codigo_expira).getTime() > Date.now();
}

const fmtRestante = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString("es-ES");
const diasHasta = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

// Módulos con configuración editable (tenant_module.config) y sus valores por
// defecto. El contrato de claves vive en lib/modulos.ts.
const DEFECTOS_CONFIG = {
  COCINA: CONFIG_COCINA_DEF,
  PANTALLA: CONFIG_PANTALLA_DEF,
  CARTELERIA: CONFIG_CARTELERIA_DEF,
  VISOR: CONFIG_VISOR_DEF,
  KIOSKO: CONFIG_KIOSKO_DEF,
} as const;
type ModuloConfigurable = keyof typeof DEFECTOS_CONFIG;
const esConfigurable = (m: Modulo): m is ModuloConfigurable => m in DEFECTOS_CONFIG;

// Tipos de terminal emparejables. El usuario/contraseña reutilizable de 0105 está
// rechazado; cada equipo consume un código efímero de seis dígitos.
const TIPOS_TERMINAL = [
  { v: "TPV", label: "TPV (punto de venta)", tipo: "TPV", modulo: "TPV" },
  { v: "COMANDERA", label: "Comandera", tipo: "COMANDERA", modulo: "COMANDERA" },
  { v: "COCINA", label: "Pantalla de cocina (KDS)", tipo: "KDS", modulo: "COCINA" },
] as const;

function CrearTerminal({ onCreado }: { onCreado: () => void | Promise<void> }) {
  const [tipoSel, setTipoSel] = useState<string>("TPV");
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function crear() {
    if (!nombre.trim()) {
      toast.error("Escribe un nombre para el terminal.");
      return;
    }
    const t = TIPOS_TERMINAL.find((x) => x.v === tipoSel) ?? TIPOS_TERMINAL[0];
    setBusy(true);
    try {
      const sb = supabaseBrowser();
      const token = (await sb.auth.getSession()).data.session?.access_token;
      const res = await fetch("/api/dispositivos/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ tipo: t.tipo, modulo: t.modulo, nombre: nombre.trim() }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; codigo?: string };
      if (!res.ok || !j.ok) { toast.error(j.error ?? "No se pudo crear el terminal."); return; }
      setCodigo(j.codigo ?? null);
      toast.success(`Terminal "${nombre.trim()}" creado. El código caduca en 10 minutos.`);
      setNombre("");
      await onCreado();
    } finally { setBusy(false); }
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Nuevo terminal</CardTitle>
        <CardDescription>
          Crea el equipo y genera un código de seis dígitos, válido durante diez minutos y de un solo uso.
          En el terminal se introduce la dirección del nodo y este código; después, cada operario entra con su PIN.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Tipo</Label>
          <Select value={tipoSel} onValueChange={setTipoSel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS_TERMINAL.map((x) => <SelectItem key={x.v} value={x.v}>{x.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Nombre</Label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="TPV Barra" />
        </div>
        {codigo && (
          <div className="sm:col-span-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-xs text-muted-foreground">Código de emparejado (un uso, 10 minutos)</p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.3em]">{codigo}</p>
          </div>
        )}
        <div className="sm:col-span-2">
          <Button onClick={crear} disabled={busy}>{busy ? "Creando…" : "Crear terminal"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FilaDispositivo({ d, gruposPV, onGrupo, onEstacion, onDesvincular }: {
  d: Dispositivo;
  /** null = la 0067 no está aplicada (se oculta el selector). */
  gruposPV: GrupoPV[] | null;
  onGrupo(d: Dispositivo, grupoId: string | null): void;
  onEstacion(d: Dispositivo, estacion: string | null): void;
  onDesvincular(d: Dispositivo): void;
}) {
  const esMonitor = moduloDe(d) === "COCINA";
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-medium">{d.nombre}</p>
        <p className="text-[11px]">
          {d.vinculado_at
            ? (() => {
                const c = estadoConexion(d.ultima_conexion);
                if (!c) return <span className="text-emerald-500">Vinculado</span>;
                return <span className={c.enLinea ? "text-emerald-500" : "text-muted-foreground"}>{c.enLinea ? "● En línea" : `○ ${c.texto}`}</span>;
              })()
            : codigoVivo(d)
              ? <span className="tabular-nums text-amber-500">Esperando el código {d.codigo_vinculacion}</span>
              : <span className="text-muted-foreground">Sin vincular</span>}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {/* Estación del monitor (0068): qué partida muestra este KDS al arrancar. */}
        {esMonitor && (
          <Select
            value={d.estacion ?? ESTACION_GLOBAL}
            onValueChange={(v) => onEstacion(d, v === ESTACION_GLOBAL ? null : v)}
          >
            <SelectTrigger size="sm" className="h-7 w-28 text-[11px]" aria-label={`Estación de ${d.nombre}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ESTACION_GLOBAL}>Estación global</SelectItem>
              {ESTACIONES_KDS.map((e) => <SelectItem key={e.v} value={e.v}>{e.t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {/* Grupo de puntos de venta (0067): decide qué familias/categorías verá este terminal. */}
        {gruposPV && gruposPV.length > 0 && (
          <Select
            value={d.grupo_punto_venta_id ?? SIN_GRUPO_PV}
            onValueChange={(v) => onGrupo(d, v === SIN_GRUPO_PV ? null : v)}
          >
            <SelectTrigger size="sm" className="h-7 w-28 text-[11px]" aria-label={`Grupo de ${d.nombre}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SIN_GRUPO_PV}>Sin grupo</SelectItem>
              {gruposPV.map((g) => <SelectItem key={g.id} value={g.id}>{g.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button variant="ghost" size="xs" className="text-destructive shrink-0" onClick={() => onDesvincular(d)}>
          <Trash2 aria-hidden /> {d.vinculado_at ? "Desvincular" : "Eliminar"}
        </Button>
      </div>
    </li>
  );
}

// Plantillas de diseño del kiosko: etiqueta + descripción de cada una.
const DISENOS_KIOSKO_UI: { v: DisenoKiosko; t: string; d: string }[] = [
  { v: "marca", t: "Marca", d: "Portada a color de marca pleno (el original)." },
  { v: "claro", t: "Claro", d: "Blanco y aire; pedido en panel lateral." },
  { v: "calido", t: "Cálido", d: "Fondo tintado con tu color; carrito abajo." },
  { v: "oscuro", t: "Oscuro", d: "Casi negro, para locales nocturnos." },
];

// Miniatura en CSS puro que insinúa la disposición de cada plantilla.
function MiniVistaKiosko({ diseno }: { diseno: DisenoKiosko }) {
  const p = {
    marca:  { fondo: "bg-white", cab: "bg-brand", nav: "bg-neutral-300", tarj: "rounded-[2px] bg-neutral-200", panel: "bg-neutral-100", abajo: false, estrecha: false },
    claro:  { fondo: "bg-neutral-100", cab: "", nav: "bg-white shadow-sm", tarj: "rounded bg-white shadow-sm", panel: "bg-white shadow-sm", abajo: false, estrecha: false },
    calido: { fondo: "bg-orange-50", cab: "bg-orange-200", nav: "bg-white", tarj: "rounded-[2px] bg-white", panel: "bg-white", abajo: true, estrecha: true },
    oscuro: { fondo: "bg-neutral-900", cab: "bg-neutral-800", nav: "bg-neutral-700", tarj: "rounded-[2px] bg-neutral-800", panel: "bg-neutral-800", abajo: false, estrecha: false },
  }[diseno];
  return (
    <div className={`pointer-events-none flex h-14 w-full flex-col overflow-hidden rounded-md border border-border ${p.fondo}`} aria-hidden="true">
      {p.cab && <div className={`h-2 flex-none ${p.cab}`} />}
      <div className="flex min-h-0 flex-1 gap-1 p-1">
        <div className={`flex ${p.estrecha ? "w-2" : "w-3"} flex-none flex-col gap-0.5`}>
          {[0, 1, 2].map((i) => <div key={i} className={`h-2 rounded-[2px] ${p.nav}`} />)}
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-3 content-start gap-0.5">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className={`h-3 ${p.tarj}`} />)}
        </div>
        {!p.abajo && (
          <div className={`flex w-3.5 flex-none flex-col justify-end rounded-[2px] p-0.5 ${p.panel}`}>
            <div className="h-1.5 rounded-[2px] bg-brand" />
          </div>
        )}
      </div>
      {p.abajo && (
        <div className={`mx-1 mb-1 flex h-2.5 flex-none items-center justify-end rounded-[2px] px-0.5 ${p.panel}`}>
          <div className="h-1.5 w-4 rounded-[2px] bg-brand" />
        </div>
      )}
    </div>
  );
}

// Slide-over lateral con campos concretos por módulo (jamás un editor JSON).
function PanelConfig({ modulo, tenantId, onCerrar }: {
  modulo: ModuloConfigurable; tenantId: string | null; onCerrar(): void;
}) {
  const [cfg, setCfg] = useState<Record<string, unknown> | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    void leerConfigModulo(supabaseBrowser(), modulo).then((raw) => {
      if (vivo) setCfg(configCon({ ...DEFECTOS_CONFIG[modulo] } as Record<string, unknown>, raw));
    });
    return () => { vivo = false; };
  }, [modulo]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onCerrar]);

  const set = (k: string, v: unknown) => setCfg((c) => (c ? { ...c, [k]: v } : c));

  async function guardar() {
    if (!cfg) return;
    if (!tenantId) { toast.error("No se encontró la empresa de la sesión."); return; }
    // Sanea los numéricos: un valor vacío o absurdo vuelve al defecto.
    const defectos = DEFECTOS_CONFIG[modulo] as Record<string, unknown>;
    const limpio: Record<string, unknown> = { ...cfg };
    for (const k of Object.keys(defectos)) {
      if (typeof defectos[k] === "number") {
        const n = Number(limpio[k]);
        limpio[k] = Number.isFinite(n) && n >= 1 ? Math.round(n) : defectos[k];
      }
    }
    setGuardando(true);
    const { error } = await guardarConfigModulo(supabaseBrowser(), tenantId, modulo, limpio);
    setGuardando(false);
    if (error) { toast.error(error); return; }
    toast.success(`Configuración de «${MODULOS[modulo].nombre}» guardada.`);
    onCerrar();
  }

  const texto = (k: string, label: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`cfg-${k}`}>{label}</Label>
      <Input id={`cfg-${k}`} value={String(cfg![k] ?? "")} onChange={(e) => set(k, e.target.value)} />
    </div>
  );
  const numero = (k: string, label: string, min = 1) => (
    <div className="space-y-1.5">
      <Label htmlFor={`cfg-${k}`}>{label}</Label>
      <Input
        id={`cfg-${k}`} type="number" min={min} value={Number(cfg![k] ?? min)}
        onChange={(e) => { const n = e.target.valueAsNumber; set(k, Number.isFinite(n) ? n : 0); }}
      />
    </div>
  );
  const booleano = (k: string, label: string) => (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
      <Label className="text-[13px]">{label}</Label>
      <Switch checked={!!cfg![k]} onCheckedChange={(v) => set(k, v)} aria-label={label} />
    </div>
  );
  const opcion = (k: string, label: string, ops: { v: string; t: string }[]) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={String(cfg![k])} onValueChange={(v) => set(k, v)}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>{ops.map((o) => <SelectItem key={o.v} value={o.v}>{o.t}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onCerrar} aria-hidden="true" />
      <aside
        role="dialog" aria-modal="true" aria-label={`Configurar ${MODULOS[modulo].nombre}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background"
      >
        <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border px-3">
          <span className="flex-1 truncate text-[13px] font-semibold">
            Configurar · {MODULOS[modulo].nombre}
          </span>
          <button
            type="button" onClick={onCerrar} aria-label="Cerrar" title="Cerrar"
            className="grid h-7 w-7 cursor-pointer place-items-center rounded text-foreground/80 hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {!cfg ? (
            <p className="text-[12.5px] text-muted-foreground">Cargando…</p>
          ) : (
            <>
              {modulo === "COCINA" && (
                <>
                  {opcion("estacionDefecto", "Estación al abrir la pantalla", [
                    { v: "COCINA", t: "Cocina" }, { v: "BARRA", t: "Barra" },
                    { v: "CAMARERO", t: "Camarero" }, { v: "TODAS", t: "Todas" },
                  ])}
                  {opcion("tema", "Tema", [{ v: "oscuro", t: "Oscuro" }, { v: "claro", t: "Claro" }])}
                  <div className="grid grid-cols-2 gap-3">
                    {numero("avisoMin", "Aviso (minutos)")}
                    {numero("criticoMin", "Crítico (minutos)")}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    A partir de esos minutos la comanda se marca en ámbar y en rojo.
                  </p>
                  {booleano("sonido", "Sonido al entrar una comanda")}
                </>
              )}
              {modulo === "PANTALLA" && (
                <>
                  {texto("tituloPreparando", "Título de «en preparación»")}
                  {texto("tituloListos", "Título de «listos»")}
                  {booleano("incluirBarra", "Incluir pedidos solo de barra")}
                </>
              )}
              {modulo === "CARTELERIA" && numero("segundosPorOferta", "Segundos por oferta", 2)}
              {modulo === "VISOR" && (
                <>
                  {texto("mensajeReposo", "Mensaje de reposo")}
                  {texto("mensajeGracias", "Mensaje tras el cobro")}
                </>
              )}
              {modulo === "KIOSKO" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Plantilla de diseño</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {DISENOS_KIOSKO_UI.map((d) => {
                        const sel = String(cfg.diseno ?? "marca") === d.v;
                        return (
                          <button
                            key={d.v} type="button" aria-pressed={sel}
                            onClick={() => set("diseno", d.v)}
                            className={`cursor-pointer rounded-lg border p-2 text-left transition-colors ${sel ? "border-brand ring-1 ring-brand" : "border-border hover:bg-accent"}`}
                          >
                            <MiniVistaKiosko diseno={d.v} />
                            <p className="mt-1.5 text-[12px] font-medium">{d.t}</p>
                            <p className="text-[10.5px] text-muted-foreground">{d.d}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cfg-colorFondo">Color de fondo (opcional)</Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="cfg-colorFondo" type="color"
                        value={typeof cfg.colorFondo === "string" && cfg.colorFondo ? cfg.colorFondo : "#ffffff"}
                        onChange={(e) => set("colorFondo", e.target.value)}
                        className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0.5"
                      />
                      <span className="flex-1 font-mono text-[11px] text-muted-foreground">
                        {typeof cfg.colorFondo === "string" && cfg.colorFondo ? cfg.colorFondo : "Automático según el diseño"}
                      </span>
                      {!!cfg.colorFondo && (
                        <Button variant="ghost" size="xs" onClick={() => set("colorFondo", "")}>Limpiar</Button>
                      )}
                    </div>
                  </div>
                  {booleano("pedirNombre", "Pedir el nombre del cliente")}
                  {booleano("mostrarPrecios", "Mostrar precios")}
                  {texto("textoAqui", "Botón «comer aquí»")}
                  {texto("textoLlevar", "Botón «para llevar»")}
                  {texto("textoConfirmacion", "Texto de confirmación del pedido")}
                </>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border p-3">
          <Button variant="ghost" size="sm" onClick={onCerrar}>Cancelar</Button>
          <Button size="sm" disabled={!cfg || guardando} onClick={() => void guardar()}>
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </aside>
    </>
  );
}

export default function Modulos() {
  const [inactivos, setInactivos] = useState<Set<string>>(new Set());
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [codigo, setCodigo] = useState<CodigoActivo | null>(null);
  const [restante, setRestante] = useState(0);
  const [busy, setBusy] = useState(false);
  const [configurando, setConfigurando] = useState<ModuloConfigurable | null>(null);
  const [licencia, setLicencia] = useState<{ hasta: string | null; modulos: string[] }>({ hasta: null, modulos: [] });
  const [codigoLic, setCodigoLic] = useState("");
  const [activando, setActivando] = useState(false);

  const [gruposPV, setGruposPV] = useState<GrupoPV[] | null>(null); // null = 0067 sin aplicar

  const cargarDispositivos = useCallback(async () => {
    const sb = supabaseBrowser();
    // Con grupo de puntos de venta (0067) y estación del monitor (0068);
    // si faltan las columnas, degrada por tramos.
    const BASE = "id, nombre, tipo, modulo, codigo_vinculacion, codigo_expira, vinculado_at, ultima_conexion";
    const r0 = await sb.from("device").select(`${BASE}, grupo_punto_venta_id, estacion`).order("created_at", { ascending: false });
    if (!r0.error) {
      setDispositivos((r0.data as Dispositivo[]) ?? []);
      const { data: g } = await sb.from("grupo_punto_venta").select("id,nombre").order("nombre");
      setGruposPV((g as GrupoPV[] | null) ?? []);
      return;
    }
    const r1 = await sb.from("device").select(`${BASE}, grupo_punto_venta_id`).order("created_at", { ascending: false });
    if (!r1.error) {
      setDispositivos((((r1.data as Omit<Dispositivo, "estacion">[]) ?? [])).map((d) => ({ ...d, estacion: null })));
      const { data: g } = await sb.from("grupo_punto_venta").select("id,nombre").order("nombre");
      setGruposPV((g as GrupoPV[] | null) ?? []);
      return;
    }
    const { data } = await sb.from("device").select(BASE).order("created_at", { ascending: false });
    setDispositivos((((data as Omit<Dispositivo, "grupo_punto_venta_id" | "estacion">[]) ?? [])).map((d) => ({ ...d, grupo_punto_venta_id: null, estacion: null })));
    setGruposPV(null);
  }, []);

  async function cambiarGrupo(d: Dispositivo, grupoId: string | null) {
    const { error } = await supabaseBrowser().from("device").update({ grupo_punto_venta_id: grupoId }).eq("id", d.id);
    if (error) { toast.error(`No se pudo cambiar el grupo: ${error.message}`); return; }
    setDispositivos((prev) => prev.map((x) => (x.id === d.id ? { ...x, grupo_punto_venta_id: grupoId } : x)));
  }

  async function cambiarEstacion(d: Dispositivo, estacion: string | null) {
    const { error } = await supabaseBrowser().from("device").update({ estacion }).eq("id", d.id);
    if (error) { toast.error(`No se pudo cambiar la estación: ${error.message}`); return; }
    setDispositivos((prev) => prev.map((x) => (x.id === d.id ? { ...x, estacion } : x)));
  }

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data: t } = await sb.from("tenant").select("id").limit(1).maybeSingle();
      setTenantId(t?.id ?? null);
      setLicencia(await leerLicencia(sb));
      setInactivos(await modulosInactivos());
      await cargarDispositivos();
      setCargando(false);
    })();
  }, [cargarDispositivos]);

  // Mientras hay un código vivo: cuenta atrás cada segundo y recarga los
  // dispositivos cada 4 s para ver el canje sin que el instalador refresque.
  useEffect(() => {
    if (!codigo) return;
    const tick = setInterval(
      () => setRestante(Math.max(0, Math.round((codigo.expira - Date.now()) / 1000))),
      1000,
    );
    const sondeo = setInterval(() => { void cargarDispositivos(); }, 4000);
    return () => { clearInterval(tick); clearInterval(sondeo); };
  }, [codigo, cargarDispositivos]);

  // Código caducado o ya canjeado → cerrar el bloque del código.
  useEffect(() => {
    if (!codigo) return;
    if (restante <= 0) { setCodigo(null); return; }
    const d = dispositivos.find((x) => x.id === codigo.deviceId);
    if (d?.vinculado_at) {
      setCodigo(null);
      toast.success(`«${d.nombre}» vinculado.`);
    }
  }, [codigo, restante, dispositivos]);

  async function alternar(modulo: Modulo) {
    if (!tenantId) return;
    const activar = inactivos.has(modulo);
    const { error } = await supabaseBrowser()
      .from("tenant_module")
      .upsert({ tenant_id: tenantId, modulo, activo: activar }, { onConflict: "tenant_id,modulo" });
    if (error) { toast.error(error.message); return; }
    setInactivos((prev) => {
      const s = new Set(prev);
      if (activar) s.delete(modulo); else s.add(modulo);
      return s;
    });
  }

  async function activarLicencia() {
    const c = codigoLic.trim();
    if (!c) return;
    setActivando(true);
    const { data, error } = await supabaseBrowser().rpc("activar_licencia", { p_codigo: c });
    setActivando(false);
    if (error) { toast.error(error.message); return; }
    const r = data as { hasta: string; modulos: string[] };
    setLicencia({ hasta: r.hasta, modulos: r.modulos });
    setCodigoLic("");
    setInactivos(await modulosInactivos());
    toast.success(`Licencia activada hasta ${fmtFecha(r.hasta)}.`);
  }

  async function generar(clave: Modulo) {
    setBusy(true);
    try {
      const sb = supabaseBrowser();
      const token = (await sb.auth.getSession()).data.session?.access_token;
      const res = await fetch("/api/dispositivos/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          tipo: clave === "COCINA" ? "KDS" : clave,
          modulo: clave,
          nombre: MODULOS[clave].nombre,
        }),
      });
      const j = (await res.json()) as {
        ok?: boolean; error?: string; device_id?: string; codigo?: string; expira?: string;
      };
      if (!res.ok || !j.ok || !j.codigo || !j.device_id || !j.expira) {
        toast.error(j.error ?? "No se pudo generar el código");
        return;
      }
      const expiraMs = new Date(j.expira).getTime();
      setRestante(Math.max(0, Math.round((expiraMs - Date.now()) / 1000)));
      setCodigo({ modulo: clave, deviceId: j.device_id, codigo: j.codigo, expira: expiraMs });
      await cargarDispositivos();
    } finally { setBusy(false); }
  }

  async function desvincular(d: Dispositivo) {
    const { error } = await supabaseBrowser().from("device").delete().eq("id", d.id);
    if (error) { toast.error(error.message); return; }
    if (codigo?.deviceId === d.id) setCodigo(null);
    await cargarDispositivos();
  }

  const claves = Object.keys(MODULOS) as Modulo[];
  const sueltos = dispositivos.filter((d) => !(moduloDe(d) in MODULOS));
  const vigenteLic = licenciaVigente(licencia.hasta);
  const dias = licencia.hasta ? diasHasta(licencia.hasta) : 0;
  const modulosLic = licencia.modulos.filter((m) => m in MODULOS);

  return (
    <ZonaTecnica>
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          title="Módulos"
          description="Activa lo que use tu negocio y vincula sus pantallas con un código de 6 dígitos."
        />

        <CrearTerminal onCreado={cargarDispositivos} />

        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Licencia
              {licencia.hasta == null && <Badge variant="secondary">Sin licencia</Badge>}
              {licencia.hasta != null && vigenteLic && dias >= 30 && (
                <Badge className="border-emerald-500/20 bg-emerald-500/15 text-emerald-500">Activa</Badge>
              )}
              {licencia.hasta != null && vigenteLic && dias < 30 && (
                <Badge className="border-amber-500/20 bg-amber-500/15 text-amber-500">Caduca pronto</Badge>
              )}
              {licencia.hasta != null && !vigenteLic && (
                <Badge className="border-rose-500/20 bg-rose-500/15 text-rose-500">Caducada</Badge>
              )}
            </CardTitle>
            <CardDescription className="text-[12.5px]">
              {licencia.hasta == null
                ? "Sin licencia — todos los módulos disponibles."
                : vigenteLic
                  ? `Licencia activa hasta ${fmtFecha(licencia.hasta)} · ${dias} ${dias === 1 ? "día" : "días"} restantes.`
                  : `Caducada el ${fmtFecha(licencia.hasta)}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {licencia.hasta != null && vigenteLic && dias < 30 && (
              <p className="rounded-md bg-amber-500/15 px-3 py-2 text-[12px] text-amber-600 dark:text-amber-400">
                Tu licencia caduca en {dias} {dias === 1 ? "día" : "días"}. Introduce un código nuevo para renovarla
                y no perder los módulos.
              </p>
            )}
            {modulosLic.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {modulosLic.map((m) => (
                  <Badge key={m} variant="secondary">{MODULOS[m as Modulo].nombre}</Badge>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1 space-y-1.5">
                <Label htmlFor="codigo-lic">Introducir código de activación</Label>
                <Input
                  id="codigo-lic"
                  placeholder="GLUH-XXXX-XXXX-XXXX"
                  value={codigoLic}
                  onChange={(e) => setCodigoLic(e.target.value.toUpperCase())}
                  className="font-mono tracking-wider"
                  onKeyDown={(e) => { if (e.key === "Enter") void activarLicencia(); }}
                />
              </div>
              <Button disabled={activando || !codigoLic.trim()} onClick={() => void activarLicencia()}>
                {activando ? "Activando…" : "Activar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {claves.map((clave) => {
            const def: DefModulo = MODULOS[clave]; // ensancha el literal `as const`
            const activo = !inactivos.has(clave);
            // Premium disponible (no "próximamente") pero sin licencia que lo cubra.
            const sinLicencia = !def.proximamente && !!def.requiereLicencia
              && licencia.hasta != null && (!vigenteLic || !licencia.modulos.includes(clave));
            const vinculados = dispositivos.filter((d) => moduloDe(d) === clave);
            const conPantalla = !!def.ruta && !def.proximamente;
            return (
              <Card key={clave} size="sm" className={def.proximamente || sinLicencia ? "opacity-60" : undefined}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {def.nombre}
                    {def.proximamente && <Badge variant="secondary">Próximamente</Badge>}
                    {sinLicencia && (
                      <Badge className="border-amber-500/20 bg-amber-500/15 text-amber-500">Requiere licencia</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-[12.5px]">{def.descripcion}</CardDescription>
                  {sinLicencia && (
                    <p className="text-[11px] text-amber-500">
                      Activa una licencia que incluya este módulo para usarlo.
                    </p>
                  )}
                  <CardAction>
                    <Switch
                      checked={activo && !def.proximamente && !sinLicencia}
                      disabled={!!def.siempre || !!def.proximamente || sinLicencia || cargando}
                      aria-label={`${activo ? "Desactivar" : "Activar"} ${def.nombre}`}
                      onCheckedChange={() => void alternar(clave)}
                    />
                  </CardAction>
                </CardHeader>

                {conPantalla && (
                  <CardContent className="space-y-2">
                    {vinculados.length > 0 ? (
                      <ul className="space-y-1.5">
                        {vinculados.map((d) => (
                          <FilaDispositivo key={d.id} d={d} gruposPV={gruposPV} onGrupo={cambiarGrupo} onEstacion={cambiarEstacion} onDesvincular={desvincular} />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[12.5px] text-muted-foreground">Ninguna pantalla vinculada.</p>
                    )}

                    {codigo?.modulo === clave ? (
                      <div className="rounded-md border border-brand/40 bg-brand/5 p-3 text-center">
                        <p className="font-mono text-3xl font-bold tabular-nums tracking-[0.3em]">{codigo.codigo}</p>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          Caduca en <span className="tabular-nums">{fmtRestante(restante)}</span>. En la pantalla
                          nueva abre <code className="rounded bg-muted px-1">/conectar</code> y teclea el código.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button variant="outline" size="sm" disabled={busy || cargando} onClick={() => void generar(clave)}>
                          <Plus aria-hidden /> Añadir pantalla
                        </Button>
                        {esConfigurable(clave) && (
                          <Button variant="ghost" size="sm" onClick={() => setConfigurando(clave)}>
                            <Settings2 aria-hidden /> Configurar
                          </Button>
                        )}
                        {def.ruta && (
                          <Button asChild variant="ghost" size="sm">
                            <Link href={def.ruta} target="_blank">
                              Abrir pantalla <ExternalLink aria-hidden />
                            </Link>
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}

          {sueltos.length > 0 && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>Otros dispositivos</CardTitle>
                <CardDescription className="text-[12.5px]">
                  Vinculados a módulos que ya no existen en el catálogo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {sueltos.map((d) => (
                    <FilaDispositivo key={d.id} d={d} gruposPV={gruposPV} onGrupo={cambiarGrupo} onEstacion={cambiarEstacion} onDesvincular={desvincular} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {configurando && (
        <PanelConfig
          modulo={configurando}
          tenantId={tenantId}
          onCerrar={() => setConfigurando(null)}
        />
      )}
    </ZonaTecnica>
  );
}
