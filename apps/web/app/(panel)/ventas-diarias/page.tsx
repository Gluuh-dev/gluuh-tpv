"use client";

// VENTAS POR JORNADA — el día del BAR, no el del calendario.
//
// ─────────────────────────────────────────────────────────────────────────────
//  Esta página agrupaba por `created_at.slice(0, 10)`. O sea, por fecha de calendario.
//
//  Un bar que cierra el viernes a las 2 de la mañana cobra sus últimas cañas a la 1:30.
//  Para el calendario esa venta es del SÁBADO. Para el bar es del VIERNES: la noche del
//  viernes, la caja del viernes, el turno del viernes.
//
//  Resultado: **el cierre de todos los fines de semana estaba mal.** Parte de la noche del
//  viernes se contaba como sábado, y parte de la del sábado como domingo. El dueño cuadraba
//  la caja a mano cada lunes sin entender por qué le bailaban cien euros.
//
//  Ahora se agrupa por JORNADA (migración 0103): la venta pertenece a la jornada en la que
//  se cobra, y la jornada la abre y la cierra el bar — no la medianoche.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { AvisoTruncado, fechaDesde, LIMITE_INFORME, RANGO_DEFECTO, SelectorRango, type Rango } from "@/components/selector-rango";
import { TrendingUp, Receipt, Coins, AlertTriangle } from "lucide-react";
import { eur } from "@/app/lib/money";

interface RawOrder {
  total: number;
  created_at: string;
  jornada: {
    id: string;
    numero: number;
    abierta_en: string;
    cerrada_en: string | null;
    tipo_cierre: string | null;
    arqueo_pendiente: boolean;
  } | null;
}

interface Fila {
  clave: string;
  numero: number | null;
  dia: string;          // el día en que ABRIÓ la jornada: ese es el día del bar
  abierta: boolean;
  sinArquear: boolean;
  tickets: number;
  total: number;
}

function agruparPorJornada(orders: RawOrder[]): Fila[] {
  const acc: Record<string, Fila> = {};

  for (const o of orders) {
    const j = o.jornada;
    // Sin jornada no debería quedar ninguna venta (la 0103 las agrupó y un trigger asigna
    // las nuevas). Si apareciera alguna, se enseña por su fecha en vez de esconderla: una
    // venta que no sale en ningún informe es dinero que nadie echa de menos.
    const clave = j ? j.id : `sin-jornada:${o.created_at.slice(0, 10)}`;

    acc[clave] ??= {
      clave,
      numero: j?.numero ?? null,
      dia: (j?.abierta_en ?? o.created_at).slice(0, 10),
      abierta: !!j && j.cerrada_en === null,
      sinArquear: !!j?.arqueo_pendiente,
      tickets: 0,
      total: 0,
    };
    acc[clave]!.tickets += 1;
    acc[clave]!.total += Number(o.total);
  }

  return Object.values(acc).sort((a, b) => b.dia.localeCompare(a.dia) || (b.numero ?? 0) - (a.numero ?? 0));
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const conDiaDeLaSemana = (dia: string) => {
  const d = new Date(`${dia}T12:00:00`);
  return `${DIAS[d.getDay()]} ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
};

export default function VentasPorJornadaPage() {
  const [loading, setLoading] = useState(true);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [rango, setRango] = useState<Rango>(RANGO_DEFECTO);
  const [truncado, setTruncado] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    setLoading(true);
    (async () => {
      const { data } = await sb
        .from("sales_order")
        .select("total,created_at,jornada:jornada_id(id,numero,abierta_en,cerrada_en,tipo_cierre,arqueo_pendiente)")
        .eq("estado", "COBRADA")
        .eq("tipo_operacion", "VENTA")   // invitaciones y autoconsumo NO son venta
        .gte("created_at", fechaDesde(rango))
        .order("created_at", { ascending: false })
        .limit(LIMITE_INFORME);

      const rows = (data as unknown as RawOrder[] | null) ?? [];
      setTruncado(rows.length === LIMITE_INFORME);
      setFilas(agruparPorJornada(rows));
      setLoading(false);
    })();
  }, [rango]);

  const totalAcumulado = filas.reduce((s, f) => s + f.total, 0);
  const totalTickets = filas.reduce((s, f) => s + f.tickets, 0);
  const ticketMedio = totalTickets > 0 ? totalAcumulado / totalTickets : 0;
  const sinArquear = filas.filter((f) => f.sinArquear).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Ventas por jornada"
        description="El día del bar, no el del calendario: lo que se cobra a la 1:30 del sábado es la noche del viernes."
      />

      <SelectorRango valor={rango} onCambio={setRango} />
      <AvisoTruncado visible={truncado} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Total acumulado" value={loading ? "…" : eur(totalAcumulado)} />
        <StatCard icon={<Receipt className="h-4 w-4" />} label="Nº tickets" value={loading ? "…" : String(totalTickets)} />
        <StatCard icon={<Coins className="h-4 w-4" />} label="Ticket medio" value={loading ? "…" : eur(ticketMedio)} />
      </div>

      {/* Una jornada que cerró el reloj es una caja que NADIE CONTÓ. No se puede dejar
          pasar en silencio: un descuadre que no se ve el día siguiente ya no se reconstruye. */}
      {!loading && sinArquear > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-amber-200">
            <strong>{sinArquear} jornada(s) sin arquear.</strong> Se cerraron solas a la hora de
            respaldo porque nadie le dio a &laquo;Cerrar día&raquo;, así que <strong>nadie contó
            la caja</strong> de esas noches.
          </p>
        </div>
      )}

      {!loading && filas.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-8 w-8" />}
          title="Sin datos todavía"
          description="Aún no hay tickets cobrados registrados."
        />
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jornada</TableHead>
                  <TableHead className="text-right">Nº tickets</TableHead>
                  <TableHead className="text-right">Total €</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-3">
                      <div className="space-y-2.5">
                        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {filas.map((f) => (
                  <TableRow key={f.clave}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{conDiaDeLaSemana(f.dia)}</span>
                        {f.numero !== null && (
                          <span className="text-xs text-muted-foreground">nº {f.numero}</span>
                        )}
                        {f.abierta && <Badge variant="outline" className="text-emerald-500">en curso</Badge>}
                        {f.sinArquear && <Badge variant="outline" className="text-amber-500">sin arquear</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{f.tickets}</TableCell>
                    <TableCell className="text-right tabular-nums">{eur(f.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
