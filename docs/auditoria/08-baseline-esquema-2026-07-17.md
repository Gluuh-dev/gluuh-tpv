# 08 — Baseline del esquema y drift hasta 0110

> **Fecha de verificación:** 17-07-2026, por MCP en **solo lectura** sobre
> `gxcqihslbicrszgzudjs`. Cierra el pendiente del plan
> [`docs/plan/14`](../plan/14-plan-definitivo-reparacion-identidad-seguridad.md) §16
> («baseline viva y drift hasta 0110») y la entrega 0.1 de la guía 19.
> Ninguna base fue modificada.

## Números verificados

| Qué | Valor |
|---|---|
| Tablas en `public` (nube) | 82 |
| Ficheros locales en `supabase/migrations/` | 110 (hasta `0110`) |
| Entradas en el historial remoto de migraciones | 35 |
| Tablas/vistas y RPC en los tipos generados | 82 / 43 |
| Usos literales `.from()`/`.rpc()` en el código verificados contra el contrato | 667 — todos existen (`pnpm contrato:check`) |

## Clasificación del drift (regla: guía 19 §2 — no reescribir historia, no aplicar 0105–0107 a ciegas)

| Rango | Estado en nube | Historial remoto | Clasificación |
|---|---|---|---|
| `0001`–`0104` | Objetos presentes (probado por operación real; ver `AHORA.md`) | Solo 35 entradas, muchas con nombre sin número | **HISTÓRICO ACEPTADO** — se aplicaron fuera de banda (scripts/SQL editor) antes de usar la CLI. La verdad operativa es la BD viva + tipos generados. |
| `0105` (credencial usuario/contraseña por terminal) | **NO aplicada**: 0 columnas `device.usuario/clave_hash`, 0 RPC `fijar/verificar_clave_dispositivo` | No consta | **RECHAZADA** (plan 14). No aplicar jamás. El flujo en código quedó retirado el 17-07: `apps/nodo/auth.mjs` responde 410 en `/dispositivo`, `dispositivos/generar` solo emite código efímero. La nota de `AHORA.md` («aplicada en nube y nodo») era **falsa para la nube**; puede seguir aplicada en nodos existentes — su retirada allí es F4 (entrega 4.4), con migración nueva e idempotente. |
| `0106` (semilla formas de pago) | `admin_sembrar_formas_pago` existe y funciona | No consta | **HISTÓRICO ACEPTADO** — aplicada fuera de banda. |
| `0107` (semilla terminal por defecto) | `admin_sembrar_terminal_defecto` **existe pero está ROTA**: referencia `device.usuario` y llama a `fijar_clave_dispositivo`, objetos inexistentes → falla SIEMPRE en ejecución | No consta | **PARTE CREDENCIAL RECHAZADA** (plan 14). Nunca sembró un terminal en la nube: el caller (`crear-empresa`) descartaba el error. La llamada muerta se eliminó del código el 17-07. La función rota se retira de la nube en F4 con migración idempotente (no en F0). |
| `0108`–`0110` | Aplicadas y con objetos verificados (`menu.category_id`, `customer.tarifa_id/descuento_pct/saldo`, `clientes_stats`) | Constan | **AL DÍA**. |

## Contrato compilado y gates (cómo se mantiene esta verdad)

- `supabase/types/database.types.ts` — generado desde la nube, UTF-8 sin BOM, LF.
  Confirma la clasificación: contiene `clientes_stats` y `admin_sembrar_terminal_defecto`,
  **no** contiene las RPC de `0105`.
- `pnpm tipos:generar` / `pnpm tipos:check` — regeneración reproducible y gate de
  drift contra la nube (requiere `SUPABASE_ACCESS_TOKEN`; sin él, gate manual).
- `pnpm contrato:check` — sin red: cualquier `.from()`/`.rpc()` literal que no exista
  en el contrato rompe. Es lo que impide que `0105` «reaparezca» al regenerar tipos.

## Consecuencias operativas ya conocidas

1. **Ningún terminal por defecto existe en empresas creadas desde la nube** (la
   semilla 0107 nunca funcionó). El alta de terminales es siempre `/conectar`
   con código efímero — que a su vez está roto por el hook JWT desactivado
   (ver `AHORA.md` §emparejado). Son dos averías distintas.
2. Los nodos instalados pueden tener `0105`/`0107` aplicadas localmente; el
   inventario y su retirada idempotente pertenecen a F4, no a F0.
3. Toda migración futura debe terminar con `tipos:generar` + `contrato:check`
   en verde (documentado en `supabase/README.md`).
