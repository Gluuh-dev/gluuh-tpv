# Reparación F0–F8 — seguimiento de mejoras

> **Qué es esto:** el registro vivo de la ejecución del plan maestro
> [`docs/implementacion/19-plan-maestro-reparacion-f0-f8.md`](../implementacion/19-plan-maestro-reparacion-f0-f8.md)
> (decisión canónica: [`docs/plan/14`](../plan/14-plan-definitivo-reparacion-identidad-seguridad.md);
> planes técnicos: `plans/016–026`). Cada entrega que se termina se apunta aquí con
> **qué mejoró de verdad** y cómo se verificó. Si no está aquí, no está hecho.
>
> **Orden vinculante:** el de la guía 19 (F0→F8). La tabla de `plans/README.md` es
> del mismo lote pero su ruta crítica NO manda; ante conflicto, guía 19.
>
> **Regla:** ninguna migración remota sin aprobación expresa. Bases autorizadas:
> Supabase `gxcqihslbicrszgzudjs` y Postgres del nodo `127.0.0.1:55432/gluuh`.

## Estado por entrega

| Entrega | Qué aporta | Estado | Mejora conseguida |
|---|---|---|---|
| 0.1 Tipos y contrato (plan 016) | El código compila contra el esquema real | **DONE 17-07** | Tipos UTF-8 sin BOM; clientes tipados (`GluuhContractDatabase`); drift de `0105` verificado por MCP y clasificado (`docs/auditoria/08`); flujo `0105` retirado del código; gates `pnpm tipos:generar/tipos:check/contrato:check` (666 usos literales verificados); typecheck 12/12, tests 91/91 |
| 0.2 Harness de migraciones | Esquema limpio reproducible en 55432 | **IMPLEMENTADO / ejecución BLOQUEADA** | `scripts/verificar-migraciones-nodo.mjs` con triple guarda (host/puerto/base fijos + `GLUUH_DB_DESECHABLE=1`). No ejecutado: no hay nodo desechable autorizado (guía 19 §6.2 — no se crea otra base) |
| 0.3 Diseño SQL de F1 (doc 20) | DDL revisable de identidad global | **DONE 17-07 — esperando PUERTA 1** | `docs/implementacion/20`: DDL completo, preflight ya ejecutado (0 duplicados), funciones v2 fail-closed con mismas firmas, grants, RLS, matriz de 13 casos, rollout y pruebas-que-fallan-antes |
| F1 (5 entregas) | Cuenta global, sesión, permisos fail-closed | **1.1–1.4 APLICADAS EN NUBE 17-07** · 1.5 contract pendiente de canary · nodo pendiente | 0111–0114 aplicadas por MCP (backfill: 2 cuentas, perfiles materializados, 4 asignaciones, ledger verde). Smoke en nube: identidad desconocida → tenant NULL y permisos false; anon sin EXECUTE en jornada/heartbeat; propietario intacto. Panel fail-closed, selector de empresa y contexto tras login desplegables con el código actual. Falta: aplicar en el nodo + `prueba-identidad-fail-closed.mjs`, y el contract (retirar unicidades globales) tras canary |
| F2 (4 entregas) | Alta del Titular, contraseña temporal, MFA | **2.1–2.3 núcleo APLICADO/ESCRITO 17-07** · 2.4 TODO | 0115 aplicada (invitaciones un-solo-uso, canje atómico, estados de alta). Rutas emitir/canjear + /invitacion/[token] + /elegir-empresa. `debe_cambiar_password` server-side. 2.3: /seguridad con **sesiones de la cuenta + revocación** (`sesion_registro`/`revocar_sesion`) y **MFA TOTP** (Supabase Auth, offline-compatible); cambiar contraseña **revoca el resto de sesiones** (`signOut others`). PENDIENTE: MFA obligatorio para cuentas Gluuh (enforcement), cifrado+PDF de temporal (STOP: gestión de claves), cuenta provisional offline (2.4), PIN del titular |
| F3 (4 entregas) | Orden de instalación, nodo, licencia | **3.1/3.2 núcleo APLICADO EN NUBE 17-07** · 3.3 licencia (puerta 5) y 3.4 instalador TODO | 0116 aplicada (la ejecutó el usuario) y **probada en vivo**: canje OK crea `nodo_instancia`, segundo canje INVALIDA. Rutas: `/api/admin/orden-instalacion` (emitir, solo plataforma; código viaja una vez) y `/api/instalacion/activar` con flujo orden→legacy (instaladores actuales no se rompen). Falta: entitlements/licencia (3.3 — decisiones comerciales), instalador W11/BitLocker/HTTPS + claves del nodo (3.4) |
| F4 (4 entregas) | Emparejado v2, PIN, retirada 0105/0107 | **4.1/4.3 núcleo + 4.4 parcial APLICADOS EN NUBE 17-07** · 4.2 (Electron/safeStorage) BLOQUEADA: `apps/desktop/*` sucio por otra sesión | 0117 aplicada y probada: credencial rotatoria/revocable (access 12 h + refresh; legacy 365d→30d), `sesion_operario`, PIN con bloqueo POR TERMINAL (antes: 5 fallos bloqueaban la empresa entera), fuera `admin_sembrar_terminal_defecto` y la semilla `tecnico/1212`/`admin/1111`. Rutas `/api/dispositivos/renovar` y `/revocar`. `PERFILES_RECOMENDADOS` materializados (con fail-closed, `{}` ya no es «todo»). PENDIENTE: clientes adopten access+refresh y `validar_pin_terminal(device_id)` (va con 4.2), retirada final del JWT legacy + rotación de `DEVICE_JWT_SECRET`, retirar 0105/0107 EN LOS NODOS |
| F5 (3 entregas) | LAN/media/IPC, soporte, backups | **5.1/5.2 núcleo ESCRITO 17-07** (nodo apagado: probar al levantarlo) · IPC=4.2 bloqueada · 5.3 soporte/backups TODO | Gateway: `/nodo/health` público mínimo; `/nodo/estado` solo local o con token del bar; acciones solo POST + Origin propio (anti-CSRF). Media: subir exige token firmado por el nodo, tope 15 MB en streaming, solo formatos de carta, escritura temporal+rename; servir la carta sigue público por diseño. Descargador: allowlist de UN origen (el Supabase del bar) → SSRF muerto sin lista negra, contención de ruta, timeout y tope por fichero. Prueba: `apps/nodo/pruebas/prueba-superficie-lan.mjs` |
| F6 (4 entregas) | Venta atómica, fiscal, outbox AEAT | **6.1 núcleo + 6.3 + 6.4 APLICADOS EN NUBE 17-07** · adopción TPV y 6.2 (revocar escrituras) pendientes de migrar callers · precios server-side pendiente puerta 6 | 0118+0119 aplicadas y probadas en vivo. `cobrar_cuenta`: candado+pagos+estado en una transacción, suma validada en servidor, doble cobro → YA_COBrada, reintento idempotente (client_id anclado al primer pago). `emitir_factura_fiscal`: factura+desglose+outbox atómicos, COLISION/EXISTE. `/api/factura` con F1/F2 real en la huella. `OutboxWorker` en apps/api: lease skip-locked, XML desde snapshot con guardia huella-reproducible, clasificación ACEPTADA/RECHAZADA/REINTENTABLE, apagado por defecto. API Nest ya tenía guard+CORS (12-07); DTO acepta tipoFactura (antes F2 fijo también allí). TECHO: `total`/precios siguen del TPV hasta el comando completo (puerta 6) |
| F7 (3 entregas) | Sync durable, cursores, conflictos | **7.1 + 7.2 + 7.3 núcleo HECHOS 17-07** (0120 en nube; nodo pendiente de aplicar y probar) · conflictos visibles con UI y backoffice local completo TODO | 7.1: `/sync/upload` responde 501 (adiós ACK falso). 7.2: foto paginada + cursor compuesto (updated_at, PK) con checkpoint por página; `prueba-cursores.mjs` PURA en verde (2.501 filas mismo timestamp). 7.3: **tombstones** — 0120 aplicada (trigger en 60 tablas de catálogo, humo verde); el sincronizador borra lo enterrado y NUNCA lo re-sube (resurrección por backup antiguo, muerta); LWW si la edición local es posterior a la lápida |
| F8 (4 entregas) | Provisionado/updater/impresión, CI, deuda | **8.1 parcial + 8.3 núcleo HECHOS 17-07** · updater/impresión (desktop sucio) TODO | Provisionado paginado por PK (muere el `limit=5000` silencioso). CI: **lint a 0 errores por primera vez** (45 warnings = baseline que solo baja) + gates nuevos: `contrato:check`, `prueba-cursores`, numeración de migraciones única, y **runner Windows** (encoding/paths/runtime real del bar). Falta: harness DB 55432 en CI (necesita nodo desechable), matrices RLS/dinero como gates (las pruebas existen; el harness las cablea) |

## Diario de mejoras

### 17-07-2026 — F0 en marcha (sesiones Codex + chat)

- `supabase/types/database.types.ts` regenerado: **UTF-8 sin BOM** (antes UTF-16 LE,
  ESLint lo trataba como binario). CLI `supabase` fijada en `2.101.0` (devDependency raíz).
- `packages/supabase/src/index.ts`: exporta `Database`, `GluuhContractDatabase`
  (transitorio), `GluuhSupabaseClient` y `GluuhSupabaseClientEstricto`. Consumidores
  abiertos documentados en el propio fichero (los Insert omiten `tenant_id` porque lo
  completa `set_tenant_id()`).
- Factorías tipadas: `supabaseBrowser.ts`, `supabaseServidor.ts` (conserva la
  selección runtime nube/nodo), `apps/mobile/src/supabase.ts`, `createGluuhClient`.

### 17-07-2026 (tarde) — F0 entregada hasta la puerta de aprobación

- **Verdad del esquema establecida** (MCP solo lectura): `0105` NO está en la nube
  (la nota de `AHORA.md` era falsa — corregida); `0106/0107` fuera de banda;
  `0108–0110` al día. Consolidado en `docs/auditoria/08-baseline-esquema-2026-07-17.md`.
- **Bug confirmado y saneado**: `admin_sembrar_terminal_defecto` (nube) rota desde
  siempre — referencia objetos de `0105` inexistentes; el caller descartaba el error.
  Ninguna empresa creada desde la nube tuvo terminal por defecto. Llamada muerta
  eliminada de `crear-empresa`; la función se retira en F4.
- **Gates reproducibles**: `pnpm tipos:generar` / `tipos:check` (UTF-8, LF, atómico,
  drift contra nube) y `pnpm contrato:check` (los `.from()`/`.rpc()` literales deben
  existir en el contrato). `supabase/README.md` corregido (ya no llama espejo a
  `schema.sql`).
- **Harness 0.2** implementado con guardas REGLA Nº 1; ejecución bloqueada hasta
  tener nodo desechable.
- **Diseño SQL de F1** (`docs/implementacion/20`) listo para revisión. Preflight:
  0 duplicados; los 4 `app_user` sin perfil → el mapping rol→perfil (plan 018) es
  prerequisito del switch fail-closed.
- Verificación global: typecheck 12/12 · tests 91/91 · contrato verde.

### 17-07-2026 (noche) — F1 y F2 escritos hasta la puerta de aplicación

- **Puerta 1 superada** (aprobación del usuario: «sigue con el f1 y f2»).
- **Migraciones 0111–0115 escritas y reservadas** en `AHORA.md`; **ninguna aplicada**
  (puerta 4). Clave del diseño: 0112 **materializa los `true` implícitos** de todos
  los perfiles antes de que 0113 cambie la semántica a «ausente = denegado» —
  ningún perfil existente cambia de comportamiento y los camareros no pierden `cobrar`.
- **Panel fail-closed**: el bootstrap ya no cae a PROPIETARIO/permisos vacíos; estados
  explícitos cargando/error/identidad-incompleta con reintento. El menú no se monta
  sin identidad.
- **Contexto por sesión**: login → `mis_membresias` → contexto automático (1 empresa)
  o `/elegir-empresa` (varias). Todo degrada limpio si 0113 no está aplicada.
- **Invitaciones (F2)**: token de un solo uso (solo hash en BD), 7 días, canje atómico
  anti-carrera; cuenta existente = nueva membresía sin tocar contraseña.
- **`debe_cambiar_password` deja de ser metadata autolimpiable**: cambio server-side.
- Objetos pendientes declarados en DOS espejos que se retiran al aplicar la tanda:
  `EXCEPCIONES` del gate de contrato y `TablasPendientes/FuncionesPendientes` en
  `packages/supabase`.
- Verificación: typecheck 12/12 · tests 91/91 · contrato verde (679 usos).

## Puertas de aprobación pendientes (guía 19 §16)

1. Diseño SQL de F1 → bloquea toda migración.
2. Resolución de duplicados históricos de identidad.
3. Primera migración local de F1.
4. Aplicación de cada tanda en Supabase.
5. Reglas comerciales de licencia/suspensión (F3).
6. Política propina/redondeo/pago parcial (F6).
7. Series, rectificativas y entorno fiscal (F6).
8. Limpiezas destructivas de legacy (F4/F1 contract).
9. Activación de envío AEAT.
10. Despliegue en primer cliente.
