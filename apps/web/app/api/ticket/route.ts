import { NextResponse } from "next/server";
import {
  calcularImpuestosIncluidos,
  construirUrlQR,
  encadenarRegistros,
  formatImporte,
  generarQrVerifactuDataUrl,
  LEYENDA_VERIFACTU,
  type LineaFiscal,
  type Territorio,
} from "@servio/core";

// El motor VERIFACTU usa node:crypto → este handler debe ejecutarse en Node.
export const runtime = "nodejs";

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
