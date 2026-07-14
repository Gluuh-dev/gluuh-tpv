import { NextResponse } from "next/server";
import { quienLlama } from "@/app/lib/supabaseServidor";
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

// Seguridad M4: este endpoint calcula el preview fiscal (QR/huella) y NO es anónimo. Era un
// endpoint de CÓMPUTO (hash + QR con node:crypto) abierto a cualquiera: superficie de abuso
// de CPU gratis. Desde el 12-07 el TPV envía el Bearer de la sesión en cobrar().
//
// ⚠ ESTA RUTA ESTÁ EN EL CAMINO DE CADA COBRO. `cobrar()` la llama ANTES de tocar nada, y
// si devuelve 401 el TPV aborta: «No se pudo calcular el ticket. No se ha cobrado nada.»
//
// Y hasta hoy validaba la sesión contra `NEXT_PUBLIC_SUPABASE_URL` — LA NUBE — con un token
// firmado por el NODO. La nube lo rechaza, porque no es su firma. Resultado: **un bar con
// nodo no podía cobrar desde el TPV**. Ni sin internet (no llega), ni con él (lo rechazan).
// Nadie lo había visto porque las pruebas del nodo escriben en la base directamente.
//
// `quienLlama` pregunta a QUIEN CORRESPONDE: al nodo si estamos en un nodo, a la nube si
// no. Ver `lib/supabaseServidor.ts`.
const PERMISIVO = false;

const haySesionValida = async (req: Request): Promise<boolean> => (await quienLlama(req)) !== null;

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
