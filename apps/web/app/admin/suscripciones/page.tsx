"use client";

// Suscripciones (consola de plataforma). Vista de todas las empresas ordenadas
// por caducidad: primero las caducadas y las que caducan pronto, para saber a
// quién hay que renovar. Pulsa una empresa para su ficha (renovar allí).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, AlertTriangle } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { estadoSuscripcion, fechaCorta, type ResumenEmpresa } from "@/app/lib/admin-empresas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Orden: caducada/caduca-pronto primero (por días ascendentes), luego activas,
// y "sin licencia" al final.
function ordenar(a: ResumenEmpresa, b: ResumenEmpresa): number {
  const da = estadoSuscripcion(a.licencia_hasta).dias;
  const db = estadoSuscripcion(b.licencia_hasta).dias;
  if (da === null && db === null) return 0;
  if (da === null) return 1;
  if (db === null) return -1;
  return da - db;
}

export default function Suscripciones() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<ResumenEmpresa[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabaseBrowser().rpc("admin_resumen_empresas").then(({ data }) => {
      setEmpresas(((data as ResumenEmpresa[] | null) ?? []).filter((e) => !e.es_plantilla).sort(ordenar));
      setCargando(false);
    });
  }, []);

  const atencion = empresas.filter((e) => { const d = estadoSuscripcion(e.licencia_hasta).dias; return d !== null && d <= 30; });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-surface-muted"><CreditCard className="h-4.5 w-4.5 text-muted-foreground" aria-hidden /></span>
        <div>
          <h1 className="text-lg font-semibold">Suscripciones</h1>
          <p className="text-[13px] text-muted-foreground">Estado y caducidad de todas las empresas. Renueva desde la ficha de cada una.</p>
        </div>
      </div>

      {atencion.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[13px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div><strong>{atencion.length}</strong> {atencion.length === 1 ? "empresa necesita" : "empresas necesitan"} atención (caducada o caduca en ≤30 días).</div>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Todas las empresas ({empresas.length})</CardTitle></CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Estado</TableHead><TableHead>Caduca</TableHead><TableHead>Próximo pago</TableHead><TableHead>Ciclo</TableHead><TableHead className="text-right">Precio</TableHead></TableRow></TableHeader>
            <TableBody>
              {cargando && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Cargando…</TableCell></TableRow>}
              {!cargando && empresas.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Sin empresas.</TableCell></TableRow>}
              {empresas.map((e) => {
                const sub = estadoSuscripcion(e.licencia_hasta);
                const pagoDias = e.proximo_pago ? Math.floor((new Date(e.proximo_pago).getTime() - Date.now()) / 86_400_000) : null;
                const pagoPronto = pagoDias !== null && pagoDias <= 15;
                return (
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => router.push(`/admin/empresas/${e.id}`)}>
                    <TableCell className="font-medium">{e.nombre}</TableCell>
                    <TableCell><Badge variant={sub.variant}>{sub.texto}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{fechaCorta(e.licencia_hasta)}</TableCell>
                    <TableCell className={pagoPronto ? "font-medium text-amber-500" : "text-muted-foreground"}>{fechaCorta(e.proximo_pago)}</TableCell>
                    <TableCell className="text-muted-foreground">{e.ciclo_pago ? e.ciclo_pago.toLowerCase() : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{e.precio_periodo != null ? `${Number(e.precio_periodo).toFixed(2).replace(".", ",")} €` : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
