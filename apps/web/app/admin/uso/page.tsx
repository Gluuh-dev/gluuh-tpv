"use client";

// Uso global (consola de plataforma): qué empresa usa más el online. Ranking
// por pedidos en 30 días (RPC admin_uso_empresas, 0091) con última venta,
// última sincronización y última copia de seguridad. Clic → pestaña Uso.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { supabaseBrowser } from "@/app/lib/supabaseBrowser";
import { urlEmpresa, type ResumenEmpresa } from "@/app/lib/admin-empresas";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface UsoFila {
  tenant_id: string;
  pedidos_7d: number;
  pedidos_30d: number;
  importe_30d: number;
  ultima_venta: string | null;
  ultima_conexion: string | null;
  ultima_copia: string | null;
}

const eur = (n: number) => Number(n).toFixed(2).replace(".", ",") + " €";
function haceCuanto(iso: string | null): string {
  if (!iso) return "nunca";
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 3) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
}
// Copia de seguridad: verde <24 h, ámbar <48 h, rojo más vieja o nunca (criterio del panel D2).
function estadoCopia(iso: string | null): { variant: "success" | "warning" | "destructive"; texto: string } {
  if (!iso) return { variant: "destructive", texto: "nunca" };
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 24) return { variant: "success", texto: haceCuanto(iso) };
  if (h < 48) return { variant: "warning", texto: haceCuanto(iso) };
  return { variant: "destructive", texto: haceCuanto(iso) };
}

export default function UsoGlobal() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<ResumenEmpresa[]>([]);
  const [uso, setUso] = useState<Record<string, UsoFila>>({});
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const [{ data: r }, { data: u }] = await Promise.all([
        sb.rpc("admin_resumen_empresas"),
        sb.rpc("admin_uso_empresas"),
      ]);
      setEmpresas(((r as ResumenEmpresa[] | null) ?? []).filter((e) => !e.es_plantilla));
      setUso(Object.fromEntries(((u as UsoFila[] | null) ?? []).map((f) => [f.tenant_id, f])));
      setCargando(false);
    })();
  }, []);

  // Ranking: la que más pedidos hace en 30 días arriba.
  const filas = [...empresas].sort((a, b) => (uso[b.id]?.pedidos_30d ?? 0) - (uso[a.id]?.pedidos_30d ?? 0));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-surface-muted"><Activity className="h-4.5 w-4.5 text-muted-foreground" aria-hidden /></span>
        <div>
          <h1 className="text-lg font-semibold">Uso</h1>
          <p className="text-[13px] text-muted-foreground">Quién usa más el online: pedidos, sincronización y copias de seguridad por empresa.</p>
        </div>
      </div>

      <Card>
        <CardContent className="px-0 pt-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead className="text-right">Pedidos 7 d</TableHead>
              <TableHead className="text-right">Pedidos 30 d</TableHead>
              <TableHead className="text-right">Vendido 30 d</TableHead>
              <TableHead>Última venta</TableHead>
              <TableHead>Última sincro.</TableHead>
              <TableHead>Última copia</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {cargando && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Cargando…</TableCell></TableRow>}
              {!cargando && filas.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Sin empresas.</TableCell></TableRow>}
              {filas.map((e) => {
                const f = uso[e.id];
                const copia = estadoCopia(f?.ultima_copia ?? null);
                return (
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => router.push(`${urlEmpresa(e)}/uso`)}>
                    <TableCell>
                      <span className="font-medium">{e.nombre}</span>
                      {!e.activo && <Badge variant="destructive" className="ml-2">Suspendida</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{f?.pedidos_7d ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{f?.pedidos_30d ?? 0}</TableCell>
                    <TableCell className="text-right tabular-nums">{eur(f?.importe_30d ?? 0)}</TableCell>
                    <TableCell className="text-muted-foreground">{haceCuanto(f?.ultima_venta ?? null)}</TableCell>
                    <TableCell className="text-muted-foreground">{haceCuanto(f?.ultima_conexion ?? null)}</TableCell>
                    <TableCell><Badge variant={copia.variant}>{copia.texto}</Badge></TableCell>
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
