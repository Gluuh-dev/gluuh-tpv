"use client";

// Configuración VERIFACTU (zona técnica). El motor real (huella, QR, XML)
// vive en packages/core y apps/api; en el TPV el encadenado/envío está
// desactivado por código (VERIFACTU_ACTIVO en apps/web/app/tpv/page.tsx).
// Aquí solo se informa del estado y se configura la serie fiscal.
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileKey, Hash, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { getSetting, setSetting } from "../../lib/settings";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { ZonaTecnica } from "@/components/zona-tecnica";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ConfiguracionVerifactu() {
  const [serie, setSerie] = useState("");
  const [serieLocation, setSerieLocation] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSetting<string>("modulo.FISCAL.serie").then((s) => { if (s) setSerie(s); }).catch(() => {});
    supabaseBrowser()
      .from("location")
      .select("serie_factura")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { setSerieLocation((data?.serie_factura as string | null) ?? null); });
  }, []);

  async function guardarSerie() {
    setSaving(true);
    try {
      await setSetting("GLOBAL", "modulo.FISCAL.serie", serie.trim());
      toast.success("Serie fiscal guardada");
    } catch (e) {
      toast.error(`No se pudo guardar: ${e instanceof Error ? e.message : e}`);
    } finally { setSaving(false); }
  }

  return (
    <ZonaTecnica>
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Configuración VERIFACTU"
          description="Estado del sistema de facturación verificable (AEAT) y serie fiscal del negocio."
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4" aria-hidden /> Estado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md bg-amber-500/15 px-3 py-2.5 text-[13px] font-semibold text-amber-500">
              MODO PRUEBA — las ventas no se encadenan ni se envían a la AEAT
            </div>
            <p className="text-[12.5px] text-(--text-secondary)">
              VERIFACTU está desactivado en este entorno. La activación real la hace el
              instalador junto con el certificado, cuando el negocio pasa a facturar en firme.
            </p>
            <Link href="/visor-de-verifactu" className="inline-block text-[12.5px] text-brand hover:underline">
              Ver el registro de facturas VERIFACTU →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Hash className="h-4 w-4" aria-hidden /> Serie de facturación</CardTitle>
            <CardDescription>Serie con la que se numeran las facturas fiscales de este negocio.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* ponytail: clave GLOBAL; la doc prevé ámbito DEVICE con fallback —
                se afinará por terminal cuando el TPV pase device_id. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="vf-serie">Serie fiscal</Label>
                <Input id="vf-serie" value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="F" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vf-serie-loc">Serie del local (referencia)</Label>
                <Input id="vf-serie-loc" value={serieLocation ?? "—"} readOnly disabled />
                <p className="text-[11px] text-(--text-muted)">Valor actual de <code>location.serie_factura</code>; se edita en Ajustes.</p>
              </div>
            </div>
            <Button type="button" onClick={guardarSerie} disabled={saving || !serie.trim()}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><FileKey className="h-4 w-4" aria-hidden /> Certificado AEAT</CardTitle>
            <CardDescription>Necesario para el envío real de registros a la AEAT (conexión mTLS).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-[12.5px] text-(--text-secondary)">
            {/* ponytail: la gestión real del certificado (subida, almacenamiento,
                mTLS) va en apps/api; aquí solo se informa, sin subida de ficheros. */}
            <div className="inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-2 py-1 text-[11px] font-medium text-(--text-muted)">
              No configurado en este entorno
            </div>
            <p>
              El certificado mTLS vive en el servidor de facturación, no en este panel.
              Hace falta un <strong>certificado de representante</strong> de la empresa,
              que instala el técnico en el servidor junto con su clave.
            </p>
          </CardContent>
        </Card>
      </div>
    </ZonaTecnica>
  );
}
