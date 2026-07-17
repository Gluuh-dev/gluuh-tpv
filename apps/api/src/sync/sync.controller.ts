import { Body, Controller, NotImplementedException, Post } from "@nestjs/common";

interface SyncOp {
  op: string; // PUT | PATCH | DELETE
  table: string;
  id: string;
  data?: Record<string, unknown> | null;
}
interface UploadDto {
  ops: SyncOp[];
}

/**
 * Write-path de sincronización (recibe la cola de escritura de PowerSync).
 *
 * ESQUELETO. En producción, por cada operación hay que:
 *   1) Tomar el tenant_id del JWT y forzar el contexto RLS (SET app.tenant_id).
 *   2) Validar permisos (rol) y reglas de negocio/fiscales.
 *   3) Aplicar el cambio en PostgreSQL con idempotencia (client_id).
 *   4) Asignar numeración fiscal correlativa y generar el registro VERIFACTU
 *      donde corresponda (ver FiscalService).
 *
 * Ver docs/06 §4 (sincronización) y docs/04 §3.2 (camino de escritura).
 */
@Controller("sync")
export class SyncController {
  @Post("upload")
  upload(@Body() dto: UploadDto): never {
    const ops = dto?.ops ?? [];
    // F7 entrega 7.1 (plans/021): este endpoint devolvía `estado: "ok"` SIN
    // PERSISTIR NADA. Un conector que confiara en ese acuse vaciaba su cola y
    // las operaciones del bar desaparecían en silencio — pérdida de datos pura.
    // Hasta que exista el write-path real (validación, idempotencia, aplicación
    // transaccional), la respuesta honesta es 501: el conector conserva su cola
    // y reintenta. NUNCA volver a acusar recibo de lo que no se guardó.
    throw new NotImplementedException(
      `sync/upload no implementado: ${ops.length} operación(es) NO persistidas; conserva tu cola y reintenta`,
    );
  }
}
