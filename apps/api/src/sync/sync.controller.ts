import { Body, Controller, Post } from "@nestjs/common";

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
  upload(@Body() dto: UploadDto) {
    const ops = dto?.ops ?? [];
    // TODO: aplicar realmente. Por ahora solo acusamos recibo.
    return { recibidos: ops.length, estado: "ok" };
  }
}
