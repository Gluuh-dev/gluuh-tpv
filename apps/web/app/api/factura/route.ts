import { NextResponse } from "next/server";
import type { GluuhSupabaseClient } from "@gluuh/supabase";
import { comoElLlamante } from "@/app/lib/supabaseServidor";
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
import { resolverDestinatario, type ClienteFactura } from "@/app/lib/destinatario";

// El motor VERIFACTU usa node:crypto → este handler debe ejecutarse en Node.
export const runtime = "nodejs";

// Seguridad A2: las líneas fiscales NO se aceptan del cliente; se derivan del
// pedido real (order_line) a partir del orderId. El body queda mínimo.
interface FacturaDto {
  orderId?: string;
}

interface LineaBd {
  precio_unitario: number | string;
  cantidad: number | string;
  tipo_impositivo: number | string;
  product: { tipo_impositivo: number | string } | null;
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
    //
    // `comoElLlamante`, no `createClient(NEXT_PUBLIC_SUPABASE_URL, …)`: dentro del nodo,
    // eso pedía el local A LA NUBE con un token firmado por el nodo. La nube lo rechaza
    // → «Tenant no encontrado» → **VERIFACTU era imposible en un bar con nodo**. Justo
    // donde la ley obliga a emitir. Ver `lib/supabaseServidor.ts`.
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });

    const cliente = comoElLlamante(token);
    if (!cliente) return NextResponse.json({ ok: false, error: "Servidor sin configurar" }, { status: 500 });
    // Con tipo, no `const supa = ...` a secas: las funciones de más abajo (que se declaran
    // antes de esta comprobación, por el hoisting) no verían el estrechamiento.
    const supa: GluuhSupabaseClient = cliente;

    // ── 2. Cuerpo de la petición ─────────────────────────────────────────────
    const body = (await req.json()) as FacturaDto;
    if (!body.orderId) {
      return NextResponse.json({ ok: false, error: "orderId requerido" }, { status: 400 });
    }

    // ── 3. Datos fiscales del local ──────────────────────────────────────────
    const { data: loc } = await supa
      .from("location")
      .select("id,tenant_id,cif,razon_social,territorio_fiscal,serie_factura")
      .limit(1)
      .maybeSingle();
    const locationId = (loc as { id?: string } | null)?.id ?? null;

    const nif = loc?.cif && loc.cif !== "PENDIENTE" ? loc.cif : "B00000000";
    const nombre = (loc?.razon_social as string | null) ?? undefined;
    const serie = (loc?.serie_factura as string | null) ?? "FA";
    const territorio: Territorio =
      TERR[(loc?.territorio_fiscal as string) ?? "PENINSULA_BALEARES"] ?? "PENINSULA_BALEARES";
    const tenantId = loc?.tenant_id as string | null;

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "Tenant no encontrado" }, { status: 500 });
    }

    // ── 3b. Destinatario → ¿factura COMPLETA (F1) o SIMPLIFICADA (F2)? ───────
    // Se deriva del pedido REAL, nunca del body (misma regla A2 que las líneas): si el
    // pedido tiene cliente y ese cliente tiene NIF, la AEAT exige F1 con los datos del
    // destinatario. Sin NIF no cabe factura completa → F2 (ticket/simplificada).
    const { data: ord } = await supa
      .from("sales_order")
      .select("customer:customer_id(nif,nombre,direccion,codigo_postal,poblacion,provincia)")
      .eq("id", body.orderId)
      .maybeSingle();

    const dest = resolverDestinatario((ord as { customer: ClienteFactura | null } | null)?.customer);

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

    // ── 5. Cálculo fiscal desde el pedido REAL (nunca del body) ─────────────
    // El cliente lleva el token del llamante: RLS acota order_line al tenant,
    // así que un orderId ajeno devuelve 0 filas y se rechaza.
    const { data: lineasBdRaw, error: lineasErr } = await supa
      .from("order_line")
      .select("precio_unitario,cantidad,tipo_impositivo,product:product_id(tipo_impositivo)")
      .eq("order_id", body.orderId);
    if (lineasErr) {
      return NextResponse.json({ ok: false, error: lineasErr.message }, { status: 500 });
    }
    const lineasBd = (lineasBdRaw ?? []) as unknown as LineaBd[];
    if (!lineasBd.length) {
      return NextResponse.json(
        { ok: false, error: "Pedido inexistente o sin líneas" },
        { status: 404 },
      );
    }

    // % vigente del producto como verdad; snapshot de order_line si el producto
    // ya no existe. ponytail: el precio_unitario escrito por el TPV autenticado
    // sigue viniendo del navegador del personal (inserta order_line directo);
    // techo conocido — se cierra cuando el TPV pase por una RPC como el kiosko.
    const lineasFiscales: LineaFiscal[] = lineasBd.map((l) => ({
      importe: Number(l.precio_unitario) * Number(l.cantidad),
      tipo: Number(l.product?.tipo_impositivo ?? l.tipo_impositivo),
    }));
    const impuestos = calcularImpuestosIncluidos(lineasFiscales, territorio);

    const fecha = fechaHoy();
    // Nota: usamos new Date().toISOString() como aproximación del huso horario
    // local; en producción se debería calcular con la zona horaria del local.
    const fechaHoraHuso = new Date().toISOString();

    // ── 6. Una tentativa de emisión = UNA transacción (RPC 0118) ─────────────
    // Factura + desglose + evento outbox entran JUNTOS o no entra nada: se acabó
    // la factura sin impuestos con el error en un console.error. El envío AEAT
    // solo se encola con el flag encendido (apagado por defecto, plans/020).
    const encolarAeat = process.env.VERIFACTU_ENVIO === "1";

    async function intentarInsertar(
      numero: number,
      huellaAnterior: string,
    ): Promise<{ resultado: string; invoiceId: string | null; numSerieFactura: string; huella: string; qrUrl: string; qrDataUrl: string }> {
      const numSerieFactura = `${serie}-${new Date().getFullYear()}-${numero}`;

      const cadena = encadenarRegistros(
        [
          {
            idEmisorFactura: nif,
            numSerieFactura,
            fechaExpedicionFactura: fecha,
            // El MISMO F1/F2 que se persiste: la huella iba SIEMPRE como "F2",
            // así que la cadena de una factura completa no cuadraba con lo
            // guardado (plans/020). Huella, XML y fila ya cuentan lo mismo.
            tipoFactura: dest.tipoFactura,
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

      const { data, error } = await supa.rpc("emitir_factura_fiscal", {
        p_factura: {
          tenant_id: tenantId,
          location_id: locationId,
          order_id: body.orderId,
          serie,
          numero,
          num_serie_factura: numSerieFactura,
          fecha_expedicion: fecha,
          nif_emisor: nif,
          nombre_emisor: nombre ?? null,
          // F1 = completa (destinatario identificado) · F2 = simplificada (ticket).
          tipo_factura: dest.tipoFactura,
          dest_nif: dest.destNif,
          dest_nombre: dest.destNombre,
          dest_domicilio: dest.destDomicilio,
          base_total: impuestos.baseTotal,
          cuota_total: impuestos.cuotaTotal,
          importe_total: impuestos.importeTotal,
          huella: registro.huella,
          huella_anterior: huellaAnterior || null,
          qr_url: qrUrl,
          fecha_hora_huso: fechaHoraHuso,
        },
        p_lineas: impuestos.desglose.map((d) => ({ tipo: d.tipo, base: d.base, cuota: d.cuota })),
        p_encolar: encolarAeat,
      });
      if (error) throw new Error(error.message);
      const r = (Array.isArray(data) ? data[0] : null) as { resultado: string; invoice_id: string | null } | null;
      return {
        resultado: r?.resultado ?? "ERROR",
        invoiceId: r?.invoice_id ?? null,
        numSerieFactura,
        huella: registro.huella,
        qrUrl,
        qrDataUrl,
      };
    }

    // ── 6-bis. LA CARRERA POR EL NÚMERO DE FACTURA ───────────────────────────
    //
    // Dos camareros cobran a la vez. Los dos leen «la última es la 99» y los dos van a por
    // la 100. La base de datos sólo deja pasar a uno —hay `UNIQUE (tenant_id, serie,
    // numero)`, y esa restricción es LA garantía: la numeración no puede duplicarse pase lo
    // que pase—. El otro se lleva un 23505.
    //
    // Ese que choca **vuelve a leer**, y esto es lo importante: lee la 100 que acaba de
    // entrar, con su huella, y encadena la 101 SOBRE ELLA. La cadena de VERIFACTU no se
    // bifurca: el que gana define la cadena y el que pierde se engancha detrás.
    //
    // Lo que estaba mal era el número de intentos: **uno**. Con dos TPV cobrando a la vez
    // suele bastar; con cuatro en el pico de un sábado, no — y entonces el cobro FALLA en la
    // cara del camarero, con el cliente delante y la tarjeta en la mano. Ahora insiste.
    //
    // (Y la colisión se detecta por el CÓDIGO 23505, no buscando la palabra "unique" en el
    // texto del error: ese texto lo escribe Postgres y puede venir traducido.)
    const INTENTOS = 6;
    let numero = 0;
    let huellaAnterior = "";
    let result!: Awaited<ReturnType<typeof intentarInsertar>>;

    for (let i = 0; i < INTENTOS; i++) {
      ({ numero, huellaAnterior } = await obtenerSiguienteNumero());
      result = await intentarInsertar(numero, huellaAnterior);
      if (result.resultado !== "COLISION") break;

      // Una espera corta y DESIGUAL entre intentos. Si los dos reintentaran a la vez y con
      // el mismo ritmo, volverían a chocar en la misma milésima, una y otra vez.
      await new Promise((r) => setTimeout(r, 15 * (i + 1) + Math.random() * 25));
    }

    if (result.resultado === "NO_AUTORIZADO") {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
    }
    // Idempotencia (0118): el pedido YA tenía factura — un reintento tras un
    // timeout devuelve ESA, no consume otro número ni fabrica otra huella.
    if (result.resultado === "EXISTE" && result.invoiceId) {
      const { data: previa } = await supa
        .from("invoice")
        .select("num_serie_factura,huella,qr_url")
        .eq("id", result.invoiceId)
        .maybeSingle();
      const p = previa as { num_serie_factura: string; huella: string; qr_url: string } | null;
      return NextResponse.json({
        ok: true,
        yaEmitida: true,
        numSerieFactura: p?.num_serie_factura ?? "",
        huella: p?.huella ?? "",
        qrUrl: p?.qr_url ?? "",
        leyenda: LEYENDA_VERIFACTU,
        impuestos,
      });
    }
    if (result.resultado !== "OK" || !result.invoiceId) {
      return NextResponse.json({ ok: false, error: "No se pudo emitir la factura (numeración en conflicto persistente)" }, { status: 200 });
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
