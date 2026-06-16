"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { nombreImpuesto } from "@/lib/fiscal-clases";

interface Tarifa { clase_fiscal: string; porcentaje: number }
const CLASE_LABEL: Record<string, string> = { GENERAL: "General", REDUCIDO: "Reducido", SUPERREDUCIDO: "Superreducido", EXENTO: "Exento" };

export default function Impuestos() {
  const sb = supabaseBrowser();
  const [territorio, setTerritorio] = useState("PENINSULA_BALEARES");
  const [rates, setRates] = useState<Tarifa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: loc } = await sb.from("location").select("territorio_fiscal").limit(1).maybeSingle();
      const terr = (loc as { territorio_fiscal: string } | null)?.territorio_fiscal ?? "PENINSULA_BALEARES";
      setTerritorio(terr);
      const { data } = await sb.from("tax_rate").select("clase_fiscal,porcentaje").eq("territorio", terr);
      const orden = ["GENERAL", "REDUCIDO", "SUPERREDUCIDO", "EXENTO"];
      setRates(((data as Tarifa[]) ?? []).sort((a, b) => orden.indexOf(a.clase_fiscal) - orden.indexOf(b.clase_fiscal)));
      setLoading(false);
    })();
    /* eslint-disable-next-line */
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Impuestos" description={`Tipos de ${nombreImpuesto(territorio)} que se aplican automáticamente a cada producto según su clase fiscal.`} />
      <Card>
        <CardContent className="px-0 py-0">
          <Table>
            <TableHeader><TableRow><TableHead>Clase fiscal</TableHead><TableHead className="text-right">{nombreImpuesto(territorio)}</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={2} className="py-6 text-center text-(--text-muted)">Cargando…</TableCell></TableRow>}
              {rates.map((r) => (
                <TableRow key={r.clase_fiscal}>
                  <TableCell className="font-medium">{CLASE_LABEL[r.clase_fiscal] ?? r.clase_fiscal}</TableCell>
                  <TableCell className="text-right"><Badge variant="secondary">{r.porcentaje}%</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-[13px] text-(--text-muted)">El territorio fiscal (IVA peninsular, IGIC en Canarias, IPSI en Ceuta/Melilla) se cambia en <b>Administración → Empresa y local</b>. Al cambiarlo, todos los productos recalculan su tipo automáticamente.</p>
    </div>
  );
}
