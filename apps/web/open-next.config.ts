import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Config mínima de OpenNext para Cloudflare. Sin caché incremental (R2) de
// momento: el backoffice/TPV no depende de ISR; si algún día se usa ISR
// pesado, añadir r2IncrementalCache aquí (necesita un bucket R2).
export default defineCloudflareConfig({});
