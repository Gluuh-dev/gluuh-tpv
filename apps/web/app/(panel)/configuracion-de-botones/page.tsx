"use client";

// Configuración visual de la botonera del TPV. Se guarda como UN solo objeto
// en el setting GLOBAL `tpv.botones`.
// ponytail: el TPV (app/tpv) consumirá `tpv.botones` en una pasada posterior;
// aquí solo se configura y previsualiza, no se cablea nada en la venta.
import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { getSetting, setSetting } from "../../lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface TpvBotones {
  columnas: "auto" | 6 | 8 | 10;
  mostrarPrecio: boolean;
  mostrarFoto: boolean;
  tamanoTexto: "S" | "M" | "L";
}

const DEFAULTS: TpvBotones = { columnas: "auto", mostrarPrecio: true, mostrarFoto: true, tamanoTexto: "M" };

// Tiles de ejemplo para la vista previa (colores tipo familia, como en la BD).
const DEMO: { nombre: string; precio: number; color: string }[] = [
  { nombre: "Caña", precio: 1.8, color: "#f59e0b" },
  { nombre: "Café solo", precio: 1.2, color: "#a16207" },
  { nombre: "Tortilla", precio: 2.5, color: "#ef4444" },
  { nombre: "Croquetas", precio: 6.0, color: "#f97316" },
  { nombre: "Agua 50cl", precio: 1.5, color: "#0ea5e9" },
  { nombre: "Copa vino", precio: 2.8, color: "#8b5cf6" },
  { nombre: "Ensalada", precio: 8.5, color: "#22c55e" },
  { nombre: "Papas arrugadas", precio: 5.5, color: "#64748b" },
];

const TEXTO_CLASE: Record<TpvBotones["tamanoTexto"], string> = {
  S: "text-[11px]",
  M: "text-[13px]",
  L: "text-[15px]",
};

const eur = (n: number) => n.toFixed(2) + " €";

export default function ConfiguracionDeBotones() {
  const [cfg, setCfg] = useState<TpvBotones>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSetting<Partial<TpvBotones>>("tpv.botones")
      .then((v) => { if (v) setCfg({ ...DEFAULTS, ...v }); })
      .catch(() => {});
  }, []);

  async function guardar() {
    setSaving(true);
    try {
      await setSetting("GLOBAL", "tpv.botones", cfg);
      toast.success("Configuración de botones guardada");
    } catch (e) {
      toast.error(`No se pudo guardar: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Configuración de botones"
        description="Cómo se ven los botones de producto en la pantalla de venta del TPV."
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="h-4 w-4" aria-hidden /> Opciones
            </CardTitle>
            <CardDescription>Los cambios se ven al momento en la vista previa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bt-columnas">Columnas</Label>
                <Select
                  value={String(cfg.columnas)}
                  onValueChange={(v) => setCfg({ ...cfg, columnas: v === "auto" ? "auto" : (Number(v) as 6 | 8 | 10) })}
                >
                  <SelectTrigger id="bt-columnas" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automáticas</SelectItem>
                    <SelectItem value="6">6 columnas</SelectItem>
                    <SelectItem value="8">8 columnas</SelectItem>
                    <SelectItem value="10">10 columnas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bt-texto">Tamaño del texto</Label>
                <Select
                  value={cfg.tamanoTexto}
                  onValueChange={(v) => setCfg({ ...cfg, tamanoTexto: v as TpvBotones["tamanoTexto"] })}
                >
                  <SelectTrigger id="bt-texto" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S">Pequeño</SelectItem>
                    <SelectItem value="M">Mediano</SelectItem>
                    <SelectItem value="L">Grande</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-sm">
                <Switch
                  id="bt-precio"
                  checked={cfg.mostrarPrecio}
                  onCheckedChange={(v) => setCfg({ ...cfg, mostrarPrecio: v })}
                  aria-label="Mostrar el precio en el botón"
                />
                <label htmlFor="bt-precio">Mostrar el precio en el botón</label>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Switch
                  id="bt-foto"
                  checked={cfg.mostrarFoto}
                  onCheckedChange={(v) => setCfg({ ...cfg, mostrarFoto: v })}
                  aria-label="Mostrar la foto del producto"
                />
                <label htmlFor="bt-foto">Mostrar la foto del producto</label>
              </div>
            </div>

            <Button type="button" onClick={guardar} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vista previa</CardTitle>
            <CardDescription>Simulación de la botonera con productos de ejemplo.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="grid gap-1.5 rounded-lg bg-muted/40 p-2"
              style={{
                gridTemplateColumns:
                  cfg.columnas === "auto"
                    ? "repeat(auto-fill, minmax(84px, 1fr))"
                    : `repeat(${cfg.columnas}, minmax(0, 1fr))`,
              }}
            >
              {DEMO.map((d) => (
                <div key={d.nombre} className="flex flex-col gap-1 rounded-md p-1.5 text-white" style={{ background: d.color }}>
                  {cfg.mostrarFoto && <div className="h-8 rounded-sm bg-white/25" aria-hidden />}
                  <span className={`${TEXTO_CLASE[cfg.tamanoTexto]} leading-tight font-medium`}>{d.nombre}</span>
                  {cfg.mostrarPrecio && (
                    <span className={`${TEXTO_CLASE[cfg.tamanoTexto]} tabular-nums opacity-90`}>{eur(d.precio)}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
