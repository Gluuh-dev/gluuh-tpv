import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  calcularImpuestosIncluidos,
  construirUrlQR,
  encadenarRegistros,
  formatImporte,
  generarQrVerifactuDataUrl,
  LEYENDA_VERIFACTU,
  type LineaFiscal,
  type Territorio,
} from "@gluuh/core";

// El motor VERIFACTU usa node:crypto → este handler debe ejecutarse en Node.
export const runtime = "nodejs";

interface LineaDto {
  precio: number;
  tipo: number;
  cantidad: number;
}

interface FacturaDto {
  orderId?: string;
  lineas: LineaDto[];
}

// Mapeo de territorios forales al tipo de impuesto peninsular
const TERR: Record<string, Territorio> = {
  PENINSULA_BALEARES: "PENINSULA_BALEARES",
  CANARIAS: "CANARIAS",
  CEUTA_MELILLA: "CEUTA_MELILLA",
  FORAL_PV: "PENINSULA_BALEARES",
  FORAL_NAVARRA: "PENINSULA_BALEARES",
};

function fechaHoy(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const aaaa = d.getFullYear();
  return `${dd}-${mm}-${aaaa}`;
}

export async function POST(req: Request) {
  try {
    // ── 1. Autenticación con el token del llamante ──────────────────────────
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supa = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    // ── 2. Cuerpo de la petición ─────────────────────────────────────────────
    const body = (await req.json()) as FacturaDto;
    if (!body.lineas?.length) {
      return NextResponse.json({ ok: false, error: "Lineas vacías" }, { status: 400 });
    }

    // ── 3. Datos fiscales del local ──────────────────────────────────────────
    const { data: loc } = await supa
      .from("location")
      .select("tenant_id,cif,razon_social,territorio_fiscal,serie_factura")
      .limit(1)
      .maybeSingle();

    const nif = loc?.cif && loc.cif !== "PENDIENTE" ? loc.cif : "B00000000";
    const nombre = (loc?.razon_social as string | null) ?? undefined;
    const serie = (loc?.serie_factura as string | null) ?? "FA";
    const territorio: Territorio =
      TERR[(loc?.territorio_fiscal as string) ?? "PENINSULA_BALEARES"] ?? "PENINSULA_BALEARES";
    const tenantId = loc?.tenant_id as string | null;

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "Tenant no encontrado" }, { status: 500 });
    }

    // ── 4. Número correlativo + huella anterior (con un único reintento) ─────
    async function obtenerSiguienteNumero(): Promise<{ numero: number; huellaAnterior: string }> {
      const { data: last } = await supa
        .from("invoice")
        .select("numero,huella")
        .eq("serie", serie)
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle();
      return {
        numero: ((last as { numero: number; huella: string } | null)?.numero ?? 0) + 1,
        huellaAnterior: (last as { numero: number; huella: string } | null)?.huella ?? "",
      };
    }

    // ── 5. Cálculo fiscal ────────────────────────────────────────────────────
    const lineasFiscales: LineaFiscal[] = body.lineas.map((l) => ({
      importe: l.precio * l.cantidad,
      tipo: l.tipo,
    }));
    const impuestos = calcularImpuestosIncluidos(lineasFiscales, territorio);

    const fecha = fechaHoy();
    // Nota: usamos new Date().toISOString() como aproximación del huso horario
    // local; en producción se debería calcular con la zona horaria del local.
    const fechaHoraHuso = new Date().toISOString();

    // ── 6. Primera tentativa de inserción ────────────────────────────────────
    async function intentarInsertar(
      numero: number,
      huellaAnterior: string,
    ): Promise<{ data: { id: string } | null; error: unknown; numSerieFactura: string; huella: string; qrUrl: string; qrDataUrl: string }> {
      const numSerieFactura = `${serie}-${new Date().getFullYear()}-${numero}`;

      const cadena = encadenarRegistros(
        [
          {
            idEmisorFactura: nif,
            numSerieFactura,
            fechaExpedicionFactura: fecha,
            tipoFactura: "F2",
            cuotaTotal: formatImporte(impuestos.cuotaTotal),
            importeTotal: formatImporte(impuestos.importeTotal),
            fechaHoraHusoGenRegistro: fechaHoraHuso,
          },
        ],
        huellaAnterior,
      );
      const registro = cadena[0]!;

      const qrInput = {
        nif,
        numSerieFactura,
        fechaExpedicion: fecha,
        importeTotal: formatImporte(impuestos.importeTotal),
        entorno: "pruebas" as const,
      };
      const qrUrl = construirUrlQR(qrInput);
      const qrDataUrl = await generarQrVerifactuDataUrl(qrInput, { width: 200 });

      const { data, error } = await supa
        .from("invoice")
        .insert({
          tenant_id: tenantId,
          order_id: body.orderId ?? null,
          serie,
          numero,
          num_serie_factura: numSerieFactura,
          fecha_expedicion: fecha,
          nif_emisor: nif,
          nombre_emisor: nombre ?? null,
          tipo_factura: "F2",
          base_total: impuestos.baseTotal,
          cuota_total: impuestos.cuotaTotal,
          importe_total: impuestos.importeTotal,
          huella: registro.huella,
          huella_anterior: huellaAnterior || null,
          qr_url: qrUrl,
          fecha_hora_huso: fechaHoraHuso,
          estado_aeat: "NO_ENVIADA",
        })
        .select("id")
        .single();

      return { data: data as { id: string } | null, error, numSerieFactura, huella: registro.huella, qrUrl, qrDataUrl };
    }

    let { numero, huellaAnterior } = await obtenerSiguienteNumero();
    let result = await intentarInsertar(numero, huellaAnterior);

    // Reintento único en caso de colisión UNIQUE (carrera)
    if (result.error) {
      const errMsg = typeof result.error === "object" && result.error !== null && "message" in result.error
        ? String((result.error as { message: string }).message)
        : String(result.error);
      const esConflicto = errMsg.includes("unique") || errMsg.includes("duplicate") || errMsg.includes("23505");
      if (esConflicto) {
        ({ numero, huellaAnterior } = await obtenerSiguienteNumero());
        result = await intentarInsertar(numero, huellaAnterior);
      }
    }

    if (result.error || !result.data) {
      const msg = typeof result.error === "object" && result.error !== null && "message" in result.error
        ? String((result.error as { message: string }).message)
        : "Error insertando factura";
      return NextResponse.json({ ok: false, error: msg }, { status: 200 });
    }

    const invoiceId = result.data.id;

    // ── 7. Líneas de impuesto ────────────────────────────────────────────────
    if (impuestos.desglose.length > 0) {
      await supa.from("invoice_tax_line").insert(
        impuestos.desglose.map((d) => ({
          tenant_id: tenantId,
          invoice_id: invoiceId,
          tipo: d.tipo,
          base: d.base,
          cuota: d.cuota,
        })),
      );
    }

    // ── 8. Respuesta (valores REALMENTE insertados, coherentes también tras reintento) ──
    return NextResponse.json({
      ok: true,
      numSerieFactura: result.numSerieFactura,
      huella: result.huella,
      qrUrl: result.qrUrl,
      qrDataUrl: result.qrDataUrl,
      leyenda: LEYENDA_VERIFACTU,
      impuestos,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
