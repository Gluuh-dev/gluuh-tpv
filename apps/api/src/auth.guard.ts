import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";

/**
 * Guard de servicio para TODA la API.
 *
 * Esta API la llaman NUESTROS clientes (la web y el nodo local), nunca un
 * navegador anónimo. Exige `Authorization: Bearer <GLUUH_API_TOKEN>`.
 *
 * Antes NO había ninguna: `POST /fiscal/enviar` remitía registros a la AEAT
 * firmados con el certificado electrónico de la empresa sin autenticación
 * ninguna. FALLA CERRADO: si no hay `GLUUH_API_TOKEN` en el entorno, se deniega
 * todo (mejor una API inútil que una API abierta remitiendo a Hacienda).
 *
 * Cuando `/sync/upload` se implemente de verdad (docs/implementacion/16), este
 * guard pasará a validar además el JWT de Supabase para acotar por tenant.
 */
@Injectable()
export class ServiceTokenGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const esperado = process.env.GLUUH_API_TOKEN;
    if (!esperado) throw new UnauthorizedException("API sin GLUUH_API_TOKEN configurado");

    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new UnauthorizedException();

    // Comparación en tiempo constante (evita distinguir el token por latencia).
    const a = Buffer.from(token);
    const b = Buffer.from(esperado);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException();
    return true;
  }
}
