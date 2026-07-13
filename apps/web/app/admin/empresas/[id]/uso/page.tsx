"use client";

// Pestaña Uso de la empresa (consola de plataforma): actividad online real —
// pedidos por día (30 días, RPC admin_uso_empresa 0091), última venta, última
// sincronización de cada dispositivo y última copia de seguridad.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Activity, HardDriveDownload, MonitorSmartphone, Receipt } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { buscarEmpresa, type ResumenEmpresa } from "@/app/lib/admin-empresas";
import { EncabezadoEmpresa } from "../encabezado";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { eur } from "@/app/lib/money";

interface Uso {
  ventas_dia: { dia: string; pedidos: number; importe: number }[];
  pedidos_7d: number;
  pedidos_30d: number;
  importe_30d: number;
  ultima_venta: string | null;
  ultima_conexion: string | null;
  ultima_copia: string | null;
}
interface Disp { id: string; nombre: string; tipo: string; modulo: string | null; vinculado_at: string | null; ultima_conexion: string | null; version: string | null }

function haceCuanto(iso: string | null): string {
  if (!iso) return "nunca";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 3) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
}
const fechaHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export default function UsoEmpresa() {
  const { id } = useParams<{ id: string }>();
  const [emp, setEmp] = useState<ResumenEmpresa | null>(null);
  const [uso, setUso] = useState<Uso | null>(null);
  const [disp, setDisp] = useState<Disp[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data: r } = await sb.rpc("admin_resumen_empresas");
      const fila = buscarEmpresa(((r as ResumenEmpresa[] | null) ?? []), id);
      setEmp(fila);
      if (!fila) { setCargando(false); return; }
      const [{ data: u }, { data: d }] = await Promise.all([
        sb.rpc("admin_uso_empresa", { p_tenant: fila.id }),
        sb.rpc("admin_dispositivos_empresa", { p_tenant: fila.id }),
      ]);
      setUso((u as Uso | null) ?? null);
      setDisp((d as Disp[] | null) ?? []);
      setCargando(false);
    })();
  }, [id]);

  if (cargando) return <div className="grid h-64 place-items-center text-muted-foreground">Cargando…</div>;
  if (!emp) return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Empresas</Link>
      <p className="rounded-lg border border-border bg-surface p-6 text-center text-muted-foreground">No se encontró la empresa.</p>
    </div>
  );

  // Días con actividad primero (más recientes arriba); la RPC ya trae solo 30 días.
  const dias = [...(uso?.ventas_dia ?? [])].reverse();

  const tiles = [
    { icon: Receipt, l: "Pedidos (7 días)", v: uso?.pedidos_7d ?? 0 },
    { icon: Receipt, l: "Pedidos (30 días)", v: uso?.pedidos_30d ?? 0, sub: uso ? `${eur(uso.importe_30d)} vendidos` : undefined },
    { icon: Activity, l: "Última venta", v: haceCuanto(uso?.ultima_venta ?? null), sub: fechaHora(uso?.ultima_venta ?? null) },
    { icon: MonitorSmartphone, l: "Última sincronización", v: haceCuanto(uso?.ultima_conexion ?? null), sub: fechaHora(uso?.ultima_conexion ?? null) },
    { icon: HardDriveDownload, l: "Última copia de seguridad", v: haceCuanto(uso?.ultima_copia ?? null), sub: fechaHora(uso?.ultima_copia ?? null) },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <EncabezadoEmpresa emp={emp} tab="uso" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map((x) => (
          <div key={x.l} className="rounded-lg border border-border bg-surface p-3.5">
            <x.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
            <div className="mt-1.5 truncate text-lg font-semibold tabular-nums">{x.v}</div>
            <div className="text-[11px] text-muted-foreground">{x.sub ? `${x.l} · ${x.sub}` : x.l}</div>
          </div>
        ))}
      </div>

      {/* Actividad por día */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" aria-hidden /> Actividad (últimos 30 días)</CardTitle></CardHeader>
        <CardContent className="px-0 pt-0">
          {dias.length === 0 ? (
            <p className="px-6 py-4 text-[13px] text-muted-foreground">Sin pedidos en los últimos 30 días.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Día</TableHead><TableHead className="text-right">Pedidos</TableHead><TableHead className="text-right">Importe</TableHead></TableRow></TableHeader>
              <TableBody>
                {dias.map((d) => (
                  <TableRow key={d.dia}>
                    <TableCell>{new Date(d.dia).toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short" })}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.pedidos}</TableCell>
                    <TableCell className="text-right tabular-nums">{eur(d.importe)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Última conexión por dispositivo (sincronización) */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MonitorSmartphone className="h-4 w-4" aria-hidden /> Sincronización por dispositivo</CardTitle></CardHeader>
        <CardContent className="px-0">
          {disp.length === 0 ? (
            <p className="px-6 py-3 text-[13px] text-muted-foreground">Sin dispositivos vinculados.</p>
          ) : (
            <div className="divide-y divide-border-muted">
              {disp.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 px-6 py-2.5 text-[13px]">
                  <div className="min-w-0">
                    <div className="font-medium">{d.nombre} <span className="text-[11px] font-normal text-muted-foreground">{d.modulo ?? d.tipo}</span></div>
                    <div className="text-[11px] text-muted-foreground">{d.version ? `v${d.version} · ` : ""}última conexión {haceCuanto(d.ultima_conexion)}</div>
                  </div>
                  <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{fechaHora(d.ultima_conexion)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
