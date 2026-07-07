"use client";

// Configuración local del TERMINAL (config.json de la app de escritorio):
// IP/URL del servidor y carpeta de copia de seguridad. Solo tiene efecto dentro
// de Gluuh Desktop (window.gluuh); en navegador se muestra el aviso. Guardar el
// «servidor» recarga la app a la nueva URL.
import { useEffect, useState } from "react";
import { MonitorCog, TriangleAlert } from "lucide-react";
import { toast } from "@/app/lib/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConfigTerminal() {
  const [mounted, setMounted] = useState(false);
  const [servidor, setServidor] = useState("");
  const [backupDestino, setBackupDestino] = useState("");
  const [cfg, setCfg] = useState<GluuhConfigTerminal | null>(null);
  const [guardando, setGuardando] = useState(false);

  const enDesktop = mounted && typeof window !== "undefined" && !!window.gluuh;

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!enDesktop) return;
    void window.gluuh!.leerConfigTerminal().then((c) => {
      setCfg(c);
      setServidor(c.servidor ?? "");
      setBackupDestino(c.backup?.destino ?? "");
    });
  }, [enDesktop]);

  async function guardar() {
    if (!window.gluuh) return;
    setGuardando(true);
    const nuevo: GluuhConfigTerminal = {
      ...cfg,
      servidor: servidor.trim() || undefined,
      backup: { ...cfg?.backup, destino: backupDestino.trim() || undefined },
    };
    const r = await window.gluuh.guardarConfigTerminal(nuevo);
    setGuardando(false);
    if (!r.ok) { toast.error(`No se pudo guardar la configuración del terminal: ${r.error ?? ""}`); return; }
    const cambioServidor = (servidor.trim() || undefined) !== (cfg?.servidor ?? undefined);
    setCfg(nuevo);
    toast.success(cambioServidor ? "Terminal guardado: la app se recargará al nuevo servidor." : "Configuración del terminal guardada.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MonitorCog className="h-4 w-4" aria-hidden /> Servidor y terminal
        </CardTitle>
        <CardDescription>
          IP del equipo donde corre la web y carpeta de copias de seguridad de este terminal (app de escritorio).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!enDesktop ? (
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-500">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              Esto se configura <strong>desde la app de escritorio</strong> de cada terminal (guarda su <code>config.json</code>).
              En el navegador no hay terminal local que configurar.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="ct-servidor">IP / URL del servidor</Label>
              <Input
                id="ct-servidor"
                value={servidor}
                onChange={(e) => setServidor(e.target.value)}
                placeholder="http://192.168.1.10:3100"
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                El equipo donde corre la web. Al cambiarla, la app se recarga sola a la nueva dirección.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-backup">Carpeta de copias de seguridad</Label>
              <Input
                id="ct-backup"
                value={backupDestino}
                onChange={(e) => setBackupDestino(e.target.value)}
                placeholder="E:\\backups-gluuh"
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">Carpeta o USB donde se vuelca la copia diaria. Vacío = sin copia automática.</p>
            </div>
            <Button onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar terminal"}</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
