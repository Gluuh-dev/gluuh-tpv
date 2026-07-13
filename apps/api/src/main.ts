// Carga apps/api/.env ANTES que nada (Nest no lo hace solo). En producción las
// variables vienen del entorno real y dotenv no las pisa: solo rellena las que
// falten. Sin esto, GLUUH_API_TOKEN quedaría undefined y el guard —que falla
// cerrado— devolvería 401 en todos los endpoints.
import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ServiceTokenGuard } from "./auth.guard";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS ACOTADO: antes era `enableCors()` sin opciones = reflejaba cualquier
  // Origin, así que cualquier web podía disparar POSTs contra /fiscal/*.
  // Orígenes permitidos por entorno (coma-separados); sin configurar = ninguno.
  const origenes = (process.env.CORS_ORIGINS ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  app.enableCors(origenes.length ? { origin: origenes, credentials: false } : { origin: false });

  // Guard de servicio en TODA la API (falla cerrado sin GLUUH_API_TOKEN).
  app.useGlobalGuards(new ServiceTokenGuard());

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`Gluuh API escuchando en http://localhost:${port}`);
}

void bootstrap();
