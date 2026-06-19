import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatImporte, verificarCadena, type RegistroEncadenado } from "@gluuh/core";

// El motor VERIFACTU usa node:crypto → este handler debe ejecutarse en Node
// (no puede correr en el navegador, por eso la verificación es server-side).
export const runtime = "nodejs";

interface InvoiceRow {
  serie: string;
  numero: number;
  num_serie_factura: string;
  nif_emisor: string;
  fecha_expedicion: string;
  tipo_factura: string;
  cuota_total: number | string;
  importe_total: number | string;
  huella: string;
  huella_anterior: string | null;
  fecha_hora_huso: string | null;
}

function aRegistro(r: InvoiceRow): RegistroEncadenado {
  return {
    idEmisorFactura: r.nif_emisor,
    numSerieFactura: r.num_serie_factura,
    fechaExpedicionFactura: r.fecha_expedicion,
    tipoFactura: r.tipo_factura,
    cuotaTotal: formatImporte(Number(r.cuota_total)),
    importeTotal: formatImporte(Number(r.importe_total)),
    fechaHoraHusoGenRegistro: r.fecha_hora_huso ?? "",
    huellaRegistroAnterior: r.huella_anterior ?? "",
    huella: r.huella,
  };
}

export async function GET(req: Request) {
  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });

    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
    );

    // RLS filtra por tenant. Orden por serie y número para reconstruir cada cadena.
    const { data, error } = await supa
      .from("invoice")
      .select(
        "serie,numero,num_serie_factura,nif_emisor,fecha_expedicion,tipo_factura,cuota_total,importe_total,huella,huella_anterior,fecha_hora_huso",
      )
      .order("serie", { ascending: true })
      .order("numero", { ascending: true })
      .limit(5000);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 });

    const rows = (data as InvoiceRow[] | null) ?? [];

    // Agrupar por serie y verificar cada cadena por separado.
    const porSerie = new Map<string, InvoiceRow[]>();
    for (const r of rows) {
      const g = porSerie.get(r.serie) ?? [];
      g.push(r);
      porSerie.set(r.serie, g);
    }

    const porFactura: Record<string, { ok: boolean; huellaOk: boolean; enlaceOk: boolean }> = {};
    let todoOk = true;

    for (const grupo of porSerie.values()) {
      const registros = grupo.map(aRegistro);
      // La primera factura cargada puede no ser el génesis: usamos su propia
      // huella_anterior como inicial (su enlace no se puede verificar aquí,
      // pero su huella sí se recalcula).
      const res = verificarCadena(registros, registros[0]?.huellaRegistroAnterior ?? "");
      res.registros.forEach((d, i) => {
        const num = grupo[i]!.num_serie_factura;
        const ok = d.huellaOk && d.enlaceOk;
        porFactura[num] = { ok, huellaOk: d.huellaOk, enlaceOk: d.enlaceOk };
        if (!ok) todoOk = false;
      });
    }

    return NextResponse.json({ ok: true, todoOk, total: rows.length, porFactura });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
