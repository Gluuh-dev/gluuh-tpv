"use client";

// Plantillas de ticket = DISEÑO del ticket (qué líneas salen, cabecera, pie, QR)
// con vista previa en vivo. Es un concern de negocio (Administración → General),
// separado de la configuración técnica de impresoras (/configuracion-de-impresion).
// Ambas páginas leen/escriben el mismo setting `impresion.config`: esta toca solo
// `.ticket` y preserva `.impresoras`/`.rutas` al guardar (carga el cfg completo).
import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings2 } from "lucide-react";
import { getSetting, setSetting } from "../../lib/settings";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { leerBranding } from "../../lib/branding";
import { formatearTicket, type TicketImpresion, type DisenoTicket, type ConfigImpresion } from "../../lib/impresion";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Ancho = 58 | 80;
type CfgImpresion = Required<ConfigImpresion>;
const CLAVE = "impresion.config";
const DEFECTO: CfgImpresion = {
  ticket: { anchoMm: 80, logo: false, nombre: true, cif: true, direccion: true, cabecera: "", fecha: true, mesaOperario: true, lineas: true, desglose: true, total: true, qr: true, pie: "¡Gracias por su visita!" },
  impresoras: [], rutas: {},
};
type ToggleKey = "nombre" | "cif" | "direccion" | "fecha" | "mesaOperario" | "lineas" | "desglose" | "total" | "qr" | "logo";
const TOGGLES_CABECERA: [ToggleKey, string][] = [["nombre", "Nombre del local"], ["cif", "CIF"], ["direccion", "Dirección"]];
const TOGGLES_CUERPO: [ToggleKey, string][] = [
  ["fecha", "Fecha y hora"], ["mesaOperario", "Mesa y camarero"], ["lineas", "Líneas del pedido"],
  ["desglose", "Desglose de impuestos"], ["total", "Total"],
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

export default function PlantillasTicket() {
  const [cfg, setCfg] = useState<CfgImpresion>(DEFECTO);
  const [local, setLocal] = useState({ nombre: "Mi Bar", cif: "B12345678", direccion: "Calle Mayor 1" });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const guardado = await getSetting<CfgImpresion>(CLAVE).catch(() => null);
      if (guardado) setCfg({ ...DEFECTO, ...guardado, ticket: { ...DEFECTO.ticket, ...guardado.ticket } });
      const sb = supabaseBrowser();
      const [{ data }, marca] = await Promise.all([
        sb.from("location").select("nombre,cif,direccion").limit(1).maybeSingle(),
        leerBranding(sb),
      ]);
      if (data) setLocal({ nombre: data.nombre ?? "Mi Bar", cif: data.cif ?? "", direccion: data.direccion ?? "" });
      setLogoUrl(marca.logo_ticket_url || marca.logo_url);
    })();
  }, []);

  function setTicket<K extends keyof DisenoTicket>(k: K, v: DisenoTicket[K]) {
    setCfg((c) => ({ ...c, ticket: { ...c.ticket, [k]: v } }));
  }

  async function guardar() {
    setSaving(true); setMsg("");
    try { await setSetting("GLOBAL", CLAVE, cfg); setMsg("Diseño guardado ✓"); }
    catch (e) { setMsg(`Error: ${e instanceof Error ? e.message : e}`); }
    finally { setSaving(false); }
  }

  // Vista previa: mismo formateo que la impresión real, con datos de muestra.
  const muestra: TicketImpresion = {
    local, contexto: "Mesa 5", operario: "Ana",
    lineas: [{ cantidad: 2, nombre: "Caña", importe: 3.0 }, { cantidad: 1, nombre: "Ensalada César", importe: 8.5 }],
    desglose: [{ etiqueta: "IVA 10% (base 10,45)", cuota: 1.05 }],
    total: 11.5, leyenda: "VERI*FACTU", huella: "A1B2C3D4E5F6",
  };
  const preview = formatearTicket(muestra, cfg.ticket);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Plantillas de ticket" description="Diseña qué aparece en el ticket: cabecera, líneas, pie y QR. Las impresoras se configuran aparte." />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Diseño del ticket</CardTitle>
              <CardDescription>El ticket se imprime en blanco y negro. Elige qué líneas quieres mostrar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Ancho de papel</Label>
                {[58, 80].map((a) => (
                  <button key={a} type="button" onClick={() => setTicket("anchoMm", a as Ancho)}
                    className={`rounded-md border px-3 py-1.5 text-sm ${cfg.ticket.anchoMm === a ? "border-brand bg-brand/10 text-brand" : "border-border"}`}>
                    {a} mm
                  </button>
                ))}
              </div>

              {/* Cabecera */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cabecera</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1"><Toggle label="Logo de tickets" on={!!cfg.ticket.logo} onClick={() => setTicket("logo", !cfg.ticket.logo)} /></div>
                    {logoUrl && <img src={logoUrl} alt="Logo de tickets" className="h-9 w-9 shrink-0 rounded border border-border bg-white object-contain p-0.5" />}
                  </div>
                  {TOGGLES_CABECERA.map(([k, t]) => (
                    <Toggle key={k} label={t} on={cfg.ticket[k] !== false} onClick={() => setTicket(k, cfg.ticket[k] === false)} />
                  ))}
                </div>
                {cfg.ticket.logo && !logoUrl && (
                  <p className="text-xs text-muted-foreground">No hay logo de tickets ni de marca: añádelo en <Link href="/personalizar" className="underline underline-offset-2">Marca y cartelería</Link>.</p>
                )}
                <div className="space-y-1.5">
                  <Label>Texto bajo el nombre</Label>
                  <Textarea rows={2} value={cfg.ticket.cabecera ?? ""} onChange={(e) => setTicket("cabecera", e.target.value)} placeholder={"Cafetería · Terraza"} />
                </div>
              </div>

              {/* Cuerpo */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cuerpo</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {TOGGLES_CUERPO.map(([k, t]) => (
                    <Toggle key={k} label={t} on={cfg.ticket[k] !== false} onClick={() => setTicket(k, cfg.ticket[k] === false)} />
                  ))}
                </div>
              </div>

              {/* Pie */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pie</p>
                <div className="space-y-1.5">
                  <Label>Mensaje de pie (una frase por línea)</Label>
                  <Textarea rows={3} value={cfg.ticket.pie ?? ""} onChange={(e) => setTicket("pie", e.target.value)} placeholder={"¡Gracias por su visita!\nSíguenos en @mibar"} />
                </div>
                <Toggle label="QR VERI*FACTU + leyenda" on={cfg.ticket.qr !== false} onClick={() => setTicket("qr", cfg.ticket.qr === false)} />
                <p className="text-xs text-muted-foreground">
                  Con VERI*FACTU activo, el QR y la leyenda son obligatorios en facturas reales y no se pueden quitar
                  (hoy VERI*FACTU está desactivado: este ajuste solo afecta a la vista previa y a tickets de prueba).
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "Guardar diseño"}</Button>
            {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
            <Link href="/configuracion-de-impresion" className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              <Settings2 className="h-4 w-4" aria-hidden /> Impresoras y rutas
            </Link>
          </div>
        </div>

        {/* Vista previa: papel térmico (blanco) sobre fondo neutro, con corte dentado. */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vista previa</p>
          <div className="flex justify-center overflow-x-auto rounded-lg border border-border bg-muted/60 px-4 pt-6 pb-8">
            <div className="drop-shadow-md" style={{ width: cfg.ticket.anchoMm === 58 ? 236 : 306 }}>
              <div className="overflow-x-auto bg-white px-3 pt-4 pb-2 text-black">
                {cfg.ticket.logo && logoUrl && <img src={logoUrl} alt="" className="mx-auto mb-2 max-w-[60%]" />}
                <pre className="whitespace-pre font-mono text-[10.5px] leading-[1.45]">{preview.join("\n")}</pre>
              </div>
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
  );
}
