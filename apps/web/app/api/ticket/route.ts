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

// Seguridad M4: este endpoint calcula el preview fiscal (QR/huella) y NO es
// anónimo. Era un endpoint de CÓMPUTO (hash + QR con node:crypto) abierto a
// cualquiera: superficie de abuso de CPU gratis. Desde el 12-07 el TPV envía el
// Bearer de la sesión en cobrar() y aquí se exige (PERMISIVO=false).
//
// Si esto empieza a devolver 401 en producción, lo más probable NO es la sesión:
// es que el Worker de Cloudflare no tenga NEXT_PUBLIC_SUPABASE_URL /
// PUBLISHABLE_KEY en el entorno de RUNTIME (se necesitan aquí, en servidor).
// Por eso ese caso se registra con un mensaje distinto y explícito.
const PERMISIVO = false;

async function haySesionValida(req: Request): Promise<boolean> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error(
      "[/api/ticket] FALTA CONFIGURACIÓN: NEXT_PUBLIC_SUPABASE_URL/PUBLISHABLE_KEY no están " +
        "en el entorno del SERVIDOR. No se puede validar la sesión → el cobro fallará. " +
        "Añádelas a los secretos de runtime del Worker.",
    );
    return false;
  }
  const supa = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await supa.auth.getUser();
  return !error && !!data.user;
}

interface LineaDto {
  nombre: string;
  precio: number;
  tipo: number;
  cantidad: number;
}
interface CerrarCuentaDto {
  lineas: LineaDto[];
  territorio: Territorio;
}

/**
 * Cierra una cuenta y genera el ticket fiscal: desglose de impuestos (IVA/IGIC),
 * registro VERIFACTU (huella encadenada) y la imagen del QR de cotejo.
 *
 * DEMO: el NIF, la serie y la fecha son fijos/derivados aquí. En producción la
 * numeración correlativa y el encadenamiento por dispositivo los gestiona el
 * backend (ver docs/06 §4.4 y docs/07).
 */
export async function POST(req: Request) {
  if (!(await haySesionValida(req))) {
    if (!PERMISIVO) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    console.warn("[/api/ticket] petición sin sesión válida (modo permisivo M4)");
  }

  const body = (await req.json()) as CerrarCuentaDto;

  if (!body.lineas?.length) {
    return NextResponse.json({ error: "Cuenta vacía" }, { status: 400 });
  }

  const lineasFiscales: LineaFiscal[] = body.lineas.map((l) => ({
    importe: l.precio * l.cantidad,
    tipo: l.tipo,
  }));
  const impuestos = calcularImpuestosIncluidos(lineasFiscales, body.territorio ?? "CANARIAS");

  const nif = "B12345678";
  const fecha = "12-06-2026"; // dd-mm-aaaa (demo)
  const numSerieFactura = `F2-2026-${Math.floor(performance.now()).toString().slice(-6)}`;

  const cadena = encadenarRegistros(
    [
      {
        idEmisorFactura: nif,
        numSerieFactura,
        fechaExpedicionFactura: fecha,
        tipoFactura: "F2",
        cuotaTotal: formatImporte(impuestos.cuotaTotal),
        importeTotal: formatImporte(impuestos.importeTotal),
        fechaHoraHusoGenRegistro: "2026-06-12T21:05:00+01:00",
      },
    ],
    "",
  );
  const registro = cadena[0]!;

  const qrInput = {
    nif,
    numSerieFactura,
    fechaExpedicion: fecha,
    importeTotal: formatImporte(impuestos.importeTotal),
    entorno: "pruebas" as const,
  };
  const qrDataUrl = await generarQrVerifactuDataUrl(qrInput, { width: 200 });

  return NextResponse.json({
    emisor: { nif, nombre: "Bar La Palma" },
    numSerieFactura,
    fecha,
    impuestos,
    verifactu: {
      leyenda: LEYENDA_VERIFACTU,
      huella: registro.huella,
      qrUrl: construirUrlQR(qrInput),
      qrDataUrl,
    },
  });
}
