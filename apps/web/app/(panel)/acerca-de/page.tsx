"use client";

// Acerca de / Licencia — el "Acerca de…" estilo Ágora (guía 15 §9): a quién está
// licenciado, estado y CADUCIDAD de la suscripción, código de instalación,
// módulos contratados y la identidad de este equipo.
import { useEffect, useState } from "react";
import { BadgeCheck, KeyRound, MonitorSmartphone, Puzzle } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { MODULOS, modulosInactivos, type DefModulo } from "@/app/lib/modulos";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Empresa { nombre: string; cif: string | null; codigo_instalacion: string | null; licencia_hasta: string | null; licencia_modulos: string[] }
interface Disp { id: string; nombre: string; modulo?: string }

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

// Estado de la suscripción: activa (verde) · caduca pronto <30 días (ámbar) ·
// caducada (rojo) · sin licencia registrada (neutro).
function estadoLicencia(hasta: string | null): { variant: "success" | "warning" | "destructive" | "secondary"; texto: string; detalle: string } {
  if (!hasta) return { variant: "secondary", texto: "Sin licencia registrada", detalle: "La activa Gluuh en el alta o en la renovación." };
  const dias = Math.floor((new Date(hasta).getTime() - Date.now()) / 86_400_000);
  if (dias < 0) return { variant: "destructive", texto: "Suscripción caducada", detalle: `Caducó el ${fecha(hasta)} — contacta con Gluuh para renovar.` };
  if (dias <= 30) return { variant: "warning", texto: "Caduca pronto", detalle: `Caduca el ${fecha(hasta)} (quedan ${dias} días).` };
  return { variant: "success", texto: "Suscripción activa", detalle: `Caduca el ${fecha(hasta)}.` };
}

export default function AcercaDe() {
  const [emp, setEmp] = useState<Empresa | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());
  const [disp, setDisp] = useState<Disp | null>(null);
  const [version, setVersion] = useState("web");

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.from("tenant").select("nombre,cif,codigo_instalacion,licencia_hasta,licencia_modulos").limit(1).maybeSingle()
      .then(({ data }) => { if (data) setEmp(data as Empresa); });
    modulosInactivos().then(setOff).catch(() => setOff(new Set()));
    // Identidad de este equipo: Desktop (preload) o navegador (gluuh_device).
    if (window.gluuh) {
      setVersion(window.gluuh.version || "desktop");
      if (window.gluuh.device) setDisp({ id: window.gluuh.device.id, nombre: window.gluuh.device.nombre });
      return;
    }
    try {
      const raw = localStorage.getItem("gluuh_device");
      if (raw) {
        const d = JSON.parse(raw) as { device_id?: string; nombre?: string; modulo?: string };
        if (d.device_id) setDisp({ id: d.device_id, nombre: d.nombre ?? "—", modulo: d.modulo });
      }
    } catch { /* sin dispositivo vinculado */ }
  }, []);

  const lic = estadoLicencia(emp?.licencia_hasta ?? null);

  // Estado por módulo, con el gating ya resuelto por modulosInactivos()
  // (desactivado a mano ∪ premium sin licencia).
  const estadoModulo = (clave: string, def: DefModulo): { label: string; variant: "success" | "secondary" | "outline" } => {
    if (def.proximamente) return { label: "próximamente", variant: "outline" };
    if (off.has(clave)) return def.requiereLicencia ? { label: "no contratado", variant: "outline" } : { label: "desactivado", variant: "secondary" };
    return def.requiereLicencia ? { label: "contratado", variant: "success" } : { label: "incluido", variant: "secondary" };
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Acerca de Gluuh TPV" description={emp ? `Licenciado a ${emp.nombre}${emp.cif ? ` — CIF ${emp.cif}` : ""} · versión ${version}` : "Cargando…"} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" aria-hidden /> Licencia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={lic.variant}>{lic.texto}</Badge>
            <span className="text-[13px] text-(--text-secondary)">{lic.detalle}</span>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-(--text-muted)">Código de instalación</div>
            <p className="mt-0.5 font-mono text-[15px] font-semibold tracking-wider">{emp?.codigo_instalacion ?? "—"}</p>
            <p className="mt-1 text-[12px] text-(--text-muted)">Con este código se activa cada equipo del local (lo custodia el técnico).</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Puzzle className="h-4 w-4" aria-hidden /> Módulos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border-muted">
            {(Object.entries(MODULOS) as [string, DefModulo][]).map(([clave, def]) => {
              const e = estadoModulo(clave, def);
              return (
                <div key={clave} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-medium">{def.nombre}</div>
                    <div className="truncate text-[12px] text-(--text-muted)">{def.descripcion}</div>
                  </div>
                  <Badge variant={e.variant}>{e.label}</Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><MonitorSmartphone className="h-4 w-4" aria-hidden /> Este equipo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-[13px]">
          {disp ? (
            <p className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-success" aria-hidden />
              Dispositivo <strong>{disp.nombre}</strong>{disp.modulo ? ` (${disp.modulo})` : ""} · ID <span className="font-mono text-[12px]">{disp.id}</span>
            </p>
          ) : (
            <p className="text-(--text-secondary)">Este equipo no está vinculado como dispositivo (solo sesión de usuario). Se vincula en Dispositivos → código de 6 dígitos.</p>
          )}
          <p className="text-[12px] text-(--text-muted)">Entorno fiscal: VERIFACTU en modo prueba — la activación real la hace el técnico al pasar a facturar en firme.</p>
        </CardContent>
      </Card>
    </div>
  );
}
