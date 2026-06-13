import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { readFileSync } from "node:fs";
import * as https from "node:https";
import { URL } from "node:url";

/**
 * Endpoints del web service VERIFACTU de la AEAT.
 * ⚠️ RECONFIRMAR las URLs exactas en el portal de desarrolladores de la AEAT
 * antes de usar en real (cambian por versión). Ver docs/07 §3.4.
 */
export const AEAT_ENDPOINTS = {
  pruebas:
    "https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP",
  produccion:
    "https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP",
} as const;

export interface RespuestaAeat {
  status: number;
  body: string;
}

/**
 * Cliente de envío a la AEAT mediante SOAP sobre HTTPS con autenticación mutua
 * (mTLS) usando el CERTIFICADO ELECTRÓNICO del obligado/representante.
 *
 * El envío real requiere:
 *   - AEAT_CERT_PATH: ruta a un certificado .p12/.pfx
 *   - AEAT_CERT_PASSWORD: su contraseña
 *   - AEAT_ENTORNO: "pruebas" | "produccion"
 *
 * Sin certificado configurado, lanza un error claro (no se puede enviar).
 */
@Injectable()
export class AeatService {
  private readonly logger = new Logger(AeatService.name);

  async enviarSoap(soapXml: string): Promise<RespuestaAeat> {
    const entorno = (process.env.AEAT_ENTORNO ?? "pruebas") as keyof typeof AEAT_ENDPOINTS;
    const endpoint = AEAT_ENDPOINTS[entorno] ?? AEAT_ENDPOINTS.pruebas;
    const certPath = process.env.AEAT_CERT_PATH;
    const passphrase = process.env.AEAT_CERT_PASSWORD;

    if (!certPath) {
      throw new ServiceUnavailableException(
        "Falta AEAT_CERT_PATH. El envío VERIFACTU a la AEAT requiere certificado electrónico (mTLS). " +
          "Configura AEAT_CERT_PATH y AEAT_CERT_PASSWORD. Ver docs/07 §3.4.",
      );
    }

    const pfx = readFileSync(certPath);
    const url = new URL(endpoint);
    const agent = new https.Agent({ pfx, passphrase });

    const payload = Buffer.from(soapXml, "utf8");

    return new Promise<RespuestaAeat>((resolve, reject) => {
      const req = https.request(
        {
          host: url.hostname,
          port: url.port || 443,
          path: url.pathname + url.search,
          method: "POST",
          agent,
          headers: {
            "Content-Type": "text/xml; charset=utf-8",
            "Content-Length": payload.length,
            // SOAPAction puede ser requerido por el servicio; reconfirmar valor.
            SOAPAction: "",
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c as Buffer));
          res.on("end", () =>
            resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }),
          );
        },
      );
      req.on("error", (e) => {
        this.logger.error(`Error enviando a la AEAT: ${e.message}`);
        reject(e);
      });
      req.write(payload);
      req.end();
    });
  }
}
