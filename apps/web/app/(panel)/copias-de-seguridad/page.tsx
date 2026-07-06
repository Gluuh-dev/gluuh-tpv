"use client";

// Copias de seguridad locales (USB/carpeta del terminal). La ejecuta la app de
// escritorio Gluuh: aquí solo se configura (hora + destino, en `setting`) y se
// puede lanzar una copia manual si estamos dentro de Gluuh Desktop.
import { useEffect, useState } from "react";
import { Archive, Clock, HardDriveDownload } from "lucide-react";
import { toast } from "sonner";
import { getSetting, setSetting } from "../../lib/settings";
import { exportarBackupLocal } from "../../lib/backup-local";
import { ZonaTecnica } from "@/components/zona-tecnica";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CopiasDeSeguridad() {
  // ponytail: claves GLOBAL porque casi todos los clientes tienen un solo
  // terminal; migrar a ámbito DEVICE cuando el TPV pase device_id.
  const [hora, setHora] = useState("03:00");
  const [destino, setDestino] = useState("");
  const [saving, setSaving] = useState(false);
  const [bkBusy, setBkBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  const enDesktop = mounted && typeof window !== "undefined" && !!window.gluuh;

  useEffect(() => {
    setMounted(true);
    getSetting<string>("backup.hora").then((h) => { if (h) setHora(h); }).catch(() => {});
    getSetting<string>("backup.destino").then((d) => { if (d) setDestino(d); }).catch(() => {});
  }, []);

  async function guardar() {
    setSaving(true);
    try {
      await setSetting("GLOBAL", "backup.hora", hora);
      await setSetting("GLOBAL", "backup.destino", destino);
      toast.success("Configuración de copias guardada");
    } catch (e) {
      toast.error(`No se pudo guardar: ${e instanceof Error ? e.message : e}`);
    } finally { setSaving(false); }
  }

  async function copiaAhora() {
    setBkBusy(true);
    const r = await exportarBackupLocal();
    setBkBusy(false);
    if (r.ok) toast.success(`Copia guardada en ${r.ruta ?? "el destino configurado"}`);
    else toast.error(r.error ?? "No se pudo hacer la copia");
  }

  return (
    <ZonaTecnica>
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Copias de seguridad"
          description="Copia local de los datos del negocio en el USB o carpeta del terminal."
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" aria-hidden /> Copia automática nocturna</CardTitle>
            <CardDescription>La copia la realiza la app de escritorio Gluuh en el terminal, a la hora indicada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* ponytail: el escritorio aún no lee backup.hora/backup.destino; el
                cableado (programar el volcado nocturno en apps/desktop) queda pendiente. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bk-hora">Hora de la copia</Label>
                <Input id="bk-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bk-destino">Carpeta o USB de destino</Label>
                <Input id="bk-destino" value={destino} onChange={(e) => setDestino(e.target.value)} placeholder={"E:\\ o D:\\backups-gluuh"} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" onClick={guardar} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><HardDriveDownload className="h-4 w-4" aria-hidden /> Copia manual</CardTitle>
            <CardDescription>Vuelca ahora mismo todos los datos al destino configurado.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={copiaAhora}
                disabled={bkBusy || !enDesktop}
                title={enDesktop ? undefined : "Disponible en la app de escritorio"}
              >
                <HardDriveDownload className="h-4 w-4" aria-hidden /> {bkBusy ? "Copiando…" : "Hacer copia ahora"}
              </Button>
              {mounted && !enDesktop && (
                <span className="text-[12.5px] text-amber-500">
                  Solo disponible desde la app de escritorio (Gluuh Desktop). En la nube tus datos ya se respaldan de serie.
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Archive className="h-4 w-4" aria-hidden /> Qué contiene cada copia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[12.5px] text-(--text-secondary)">
            <p>Cada copia es una carpeta con fecha (<code>gluuh-backup-AAAA-MM-DD</code>) que incluye:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Los datos del negocio en <strong>CSV legibles</strong> (carta, mesas, pedidos, facturas, caja, clientes…), abribles con Excel.</li>
              <li>Las <strong>imágenes de producto</strong> en la subcarpeta <code>imagenes/</code>.</li>
              <li>Un <code>manifest.json</code> con la fecha y el detalle de lo exportado.</li>
            </ul>
            <p>Se conservan las <strong>30 copias</strong> más recientes; las anteriores se eliminan automáticamente.</p>
          </CardContent>
        </Card>
      </div>
    </ZonaTecnica>
  );
}
