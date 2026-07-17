import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { FiscalService, type PreviewTicketDto } from "./fiscal.service";
import { AeatService } from "./aeat.service";
import type { Territorio } from "@gluuh/core";

// Worker de la OUTBOX AEAT (F6 entrega 6.4; migraciones 0118/0119, plans/020).
//
// Bucle: tomar eventos con LEASE (outbox_tomar: `skip locked`, reintomable si el
// worker muere) → reconstruir el DTO desde el SNAPSHOT de la factura → VERIFICAR
// que la huella recalculada coincide con la almacenada → enviar por mTLS →
// clasificar. NUNCA se marca ACEPTADA sin el acuse en la mano.
//
// Apagado por defecto: solo corre con OUTBOX_AEAT=1 (y la cola solo se llena si
// /api/factura emitió con VERIFACTU_ENVIO=1). Sin certificado configurado, los
// eventos quedan REINTENTABLE con un error claro — nada se pierde ni se inventa.
//
// Habla con PostgREST a pelo (fetch + service key): cero dependencias nuevas.

const INTERVALO_MS = 60_000;

interface EventoOutbox { id: number; tenant_id: string; invoice_id: string; intentos: number }
interface FacturaBd {
  id: string; location_id: string | null; serie: string; numero: number;
  num_serie_factura: string; fecha_expedicion: string; nif_emisor: string;
  nombre_emisor: string | null; tipo_factura: "F1" | "F2"; huella: string;
  huella_anterior: string | null; fecha_hora_huso: string;
}

const TERR: Record<string, Territorio> = {
  PENINSULA_BALEARES: "PENINSULA_BALEARES",
  CANARIAS: "CANARIAS",
  CEUTA_MELILLA: "CEUTA_MELILLA",
  FORAL_PV: "PENINSULA_BALEARES",
  FORAL_NAVARRA: "PENINSULA_BALEARES",
};

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("OutboxAeat");
  private timer: NodeJS.Timeout | null = null;
  private trabajando = false;

  constructor(
    private readonly fiscal: FiscalService,
    private readonly aeat: AeatService,
  ) {}

  onModuleInit() {
    if (process.env.OUTBOX_AEAT !== "1") {
      this.log.log("Worker AEAT APAGADO (OUTBOX_AEAT != 1).");
      return;
    }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      this.log.error("Worker AEAT sin SUPABASE_URL/SUPABASE_SECRET_KEY: no arranca.");
      return;
    }
    this.timer = setInterval(() => void this.ciclo(), INTERVALO_MS);
    this.log.log(`Worker AEAT encendido (cada ${INTERVALO_MS / 1000}s, entorno ${process.env.AEAT_ENTORNO ?? "pruebas"}).`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** PostgREST con la clave de servicio. Devuelve el JSON o lanza. */
  private async rest<T>(ruta: string, init?: RequestInit): Promise<T> {
    const clave = process.env.SUPABASE_SECRET_KEY!;
    const res = await fetch(`${process.env.SUPABASE_URL}${ruta}`, {
      ...init,
      headers: {
        apikey: clave,
        authorization: `Bearer ${clave}`,
        "content-type": "application/json",
        ...init?.headers,
      },
    });
    if (!res.ok) throw new Error(`PostgREST ${res.status} en ${ruta.split("?")[0]}`);
    return (await res.json()) as T;
  }

  private async ciclo(): Promise<void> {
    if (this.trabajando) return; // un ciclo largo no se solapa con el siguiente
    this.trabajando = true;
    try {
      const eventos = await this.rest<EventoOutbox[]>("/rest/v1/rpc/outbox_tomar", {
        method: "POST",
        body: JSON.stringify({ p_max: 5, p_lease_min: 2 }),
      });
      for (const evento of eventos) await this.procesar(evento);
    } catch (e) {
      this.log.warn(`Ciclo fallido: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.trabajando = false;
    }
  }

  private async resolver(id: number, estado: string, error?: string): Promise<void> {
    await this.rest("/rest/v1/rpc/outbox_resolver", {
      method: "POST",
      body: JSON.stringify({ p_id: id, p_estado: estado, p_error: error ?? null }),
    });
  }

  private async procesar(evento: EventoOutbox): Promise<void> {
    try {
      const [factura] = await this.rest<FacturaBd[]>(
        `/rest/v1/invoice?id=eq.${evento.invoice_id}&select=id,location_id,serie,numero,num_serie_factura,fecha_expedicion,nif_emisor,nombre_emisor,tipo_factura,huella,huella_anterior,fecha_hora_huso`,
      );
      if (!factura) {
        await this.resolver(evento.id, "RECHAZADA", "factura inexistente");
        return;
      }

      // Snapshot fiscal: las líneas de impuesto tal como se emitieron (0118 las
      // hizo atómicas con la factura, así que SIEMPRE están).
      const lineas = await this.rest<{ tipo: number; base: number; cuota: number }[]>(
        `/rest/v1/invoice_tax_line?invoice_id=eq.${factura.id}&select=tipo,base,cuota`,
      );
      const [loc] = factura.location_id
        ? await this.rest<{ territorio_fiscal: string | null }[]>(
            `/rest/v1/location?id=eq.${factura.location_id}&select=territorio_fiscal`,
          )
        : [undefined];

      // La factura ANTERIOR de la cadena (para el bloque Encadenamiento del XML).
      const [anterior] = factura.huella_anterior
        ? await this.rest<{ num_serie_factura: string; fecha_expedicion: string; huella: string }[]>(
            `/rest/v1/invoice?huella=eq.${encodeURIComponent(factura.huella_anterior)}&select=num_serie_factura,fecha_expedicion,huella&limit=1`,
          )
        : [undefined];

      const dto: PreviewTicketDto = {
        lineas: lineas.map((l) => ({ importe: Number(l.base) + Number(l.cuota), tipo: Number(l.tipo) })),
        territorio: TERR[loc?.territorio_fiscal ?? "PENINSULA_BALEARES"] ?? "PENINSULA_BALEARES",
        nif: factura.nif_emisor,
        nombreRazonEmisor: factura.nombre_emisor ?? undefined,
        numSerieFactura: factura.num_serie_factura,
        fechaExpedicion: factura.fecha_expedicion,
        fechaHoraHusoGenRegistro: factura.fecha_hora_huso,
        tipoFactura: factura.tipo_factura,
        huellaRegistroAnterior: factura.huella_anterior ?? undefined,
        registroAnterior: anterior
          ? { numSerieFactura: anterior.num_serie_factura, fechaExpedicionFactura: anterior.fecha_expedicion, huella: anterior.huella }
          : undefined,
        entorno: process.env.AEAT_ENTORNO === "produccion" ? "produccion" : "pruebas",
      };

      // GUARDIA: la huella recalculada desde el snapshot tiene que ser LA MISMA
      // que se emitió. Si no lo es, algo cambió (redondeo, dato tocado…) y
      // enviar sería declarar una cadena que no cuadra. Se aparta, no se envía.
      const { soap, huella } = this.fiscal.construirEnvio(dto);
      if (huella !== factura.huella) {
        await this.resolver(evento.id, "REINTENTABLE", "huella no reproducible desde el snapshot: revisar antes de enviar");
        this.log.error(`Evento ${evento.id}: huella no reproducible (${factura.num_serie_factura}).`);
        return;
      }

      const respuesta = await this.aeat.enviarSoap(soap);
      if (respuesta.status === 200 && /Correcto/i.test(respuesta.body)) {
        await this.resolver(evento.id, "ACEPTADA");
        this.log.log(`Evento ${evento.id}: aceptado por la AEAT.`);
      } else if (respuesta.status >= 500) {
        await this.resolver(evento.id, "REINTENTABLE", `AEAT ${respuesta.status}`);
      } else {
        // 2xx sin "Correcto" o 4xx: rechazo FUNCIONAL — reintentarlo en bucle
        // no lo va a arreglar; que lo mire una persona.
        await this.resolver(evento.id, "RECHAZADA", `AEAT ${respuesta.status}: ${respuesta.body.slice(0, 300)}`);
        this.log.warn(`Evento ${evento.id}: rechazado (${respuesta.status}).`);
      }
    } catch (e) {
      // Red caída, certificado ausente, timeout… → reintentable, sin perder nada.
      const msg = e instanceof Error ? e.message : String(e);
      await this.resolver(evento.id, "REINTENTABLE", msg).catch(() => {
        /* si ni resolver funciona, el lease caducará y otro ciclo lo retomará */
      });
      this.log.warn(`Evento ${evento.id}: reintentable (${msg.slice(0, 120)}).`);
    }
  }
}
