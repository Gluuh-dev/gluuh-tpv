"use client";

// Configuración de caja (cliente/encargado, sin zona técnica).
// ponytail: hoy estas claves solo se persisten en `setting`; la página /caja
// y el TPV las consumirán en una pasada posterior.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { getSetting, setSetting } from "../../lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// Fila etiqueta + interruptor compartido (Switch de components/ui).
function Conmutador({ id, label, hint, checked, onChange }: {
  id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="text-[11px] text-(--text-muted)">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

export default function ConfiguracionDeCaja() {
  const [fondo, setFondo] = useState("0");
  const [arqueoCiego, setArqueoCiego] = useState(false);
  const [umbral, setUmbral] = useState("0");
  const [venderSinCaja, setVenderSinCaja] = useState(true);
  const [abrirCajon, setAbrirCajon] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSetting<number>("caja.fondo_inicial").then((v) => { if (v !== null) setFondo(String(v)); }).catch(() => {});
    getSetting<boolean>("caja.arqueo_ciego").then((v) => { if (v !== null) setArqueoCiego(v); }).catch(() => {});
    getSetting<number>("caja.umbral_descuadre").then((v) => { if (v !== null) setUmbral(String(v)); }).catch(() => {});
    getSetting<boolean>("caja.vender_sin_caja").then((v) => { if (v !== null) setVenderSinCaja(v); }).catch(() => {});
    getSetting<boolean>("caja.abrir_cajon_efectivo").then((v) => { if (v !== null) setAbrirCajon(v); }).catch(() => {});
  }, []);

  async function guardar() {
    const fondoNum = Number(fondo || 0);
    const umbralNum = Number(umbral || 0);
    if (!Number.isFinite(fondoNum) || fondoNum < 0 || !Number.isFinite(umbralNum) || umbralNum < 0) {
      toast.error("Los importes deben ser números positivos");
      return;
    }
    setSaving(true);
    try {
      await Promise.all([
        setSetting("GLOBAL", "caja.fondo_inicial", fondoNum),
        setSetting("GLOBAL", "caja.arqueo_ciego", arqueoCiego),
        setSetting("GLOBAL", "caja.umbral_descuadre", umbralNum),
        setSetting("GLOBAL", "caja.vender_sin_caja", venderSinCaja),
        setSetting("GLOBAL", "caja.abrir_cajon_efectivo", abrirCajon),
      ]);
      toast.success("Configuración de caja guardada");
    } catch (e) {
      toast.error(`No se pudo guardar: ${e instanceof Error ? e.message : e}`);
    } finally { setSaving(false); }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Configuración de caja"
        description="Cómo se abre, se cierra y se comporta la caja en el día a día."
        actions={
          <Link href="/caja" className="text-[12.5px] text-brand hover:underline">
            Ir al control de caja →
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Coins className="h-4 w-4" aria-hidden /> Apertura y cierre</CardTitle>
          <CardDescription>Valores por defecto al abrir la caja y controles del cierre.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="caja-fondo">Fondo de caja inicial (€)</Label>
              <Input id="caja-fondo" type="number" min="0" step="0.01" inputMode="decimal" value={fondo} onChange={(e) => setFondo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="caja-umbral">Avisar si el descuadre supera (€)</Label>
              <Input id="caja-umbral" type="number" min="0" step="0.01" inputMode="decimal" value={umbral} onChange={(e) => setUmbral(e.target.value)} />
              <p className="text-[11px] text-(--text-muted)">0 = avisar de cualquier descuadre.</p>
            </div>
          </div>
          <Conmutador
            id="caja-arqueo"
            label="Obligar arqueo ciego al cierre"
            hint="El empleado cuenta el efectivo sin ver el total esperado."
            checked={arqueoCiego}
            onChange={setArqueoCiego}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Settings2 className="h-4 w-4" aria-hidden /> Comportamiento</CardTitle>
          <CardDescription>Qué permite el TPV según el estado de la caja.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Conmutador
            id="caja-vender"
            label="Permitir vender con la caja cerrada"
            hint="Si se desactiva, habrá que abrir caja antes de cobrar."
            checked={venderSinCaja}
            onChange={setVenderSinCaja}
          />
          <Conmutador
            id="caja-cajon"
            label="Abrir el cajón automáticamente al cobrar en efectivo"
            checked={abrirCajon}
            onChange={setAbrirCajon}
          />
        </CardContent>
      </Card>

      <Button type="button" onClick={guardar} disabled={saving}>
        {saving ? "Guardando…" : "Guardar"}
      </Button>
    </div>
  );
}
