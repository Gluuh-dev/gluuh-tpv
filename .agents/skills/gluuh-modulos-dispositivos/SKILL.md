---
name: gluuh-modulos-dispositivos
description: >-
  Sistema de módulos activables de Gluuh (kiosko, KDS, pantalla, cartelería,
  comandera, visor…) y emparejado de dispositivos por código de 6 dígitos:
  registro estático MODULOS, tabla tenant_module, gating del menú y las rutas,
  página Módulos, tokens de dispositivo y configuración por ámbitos con la
  tabla setting (DEVICE > LOCAL > GLOBAL). Úsala SIEMPRE que actives/desactives
  funcionalidades por tenant o plan, vincules pantallas o dispositivos, añadas
  un módulo nuevo, o necesites configuración por terminal/local/empresa.
---

# Módulos y dispositivos — guía de trabajo

Documento madre: `docs/implementacion/04-modulos-y-emparejado.md` (pasos, DDL,
criterios). Diseño: `docs/plan/03-sistema-de-modulos.md`.

## Arquitectura (decidida — no rediseñar)

- **Registro estático + activación en BD.** Los módulos son código nuestro,
  descritos en la constante `MODULOS` de `apps/web/app/lib/modulos.ts` (clave,
  nombre, ruta, `siempre`, `proximamente`, default). En BD solo vive la
  activación: tabla `tenant_module (tenant_id, modulo, activo, config jsonb)`.
  Sin marketplace, sin plugins dinámicos, sin tabla-catálogo.
- Módulos: `TPV` (siempre activo), `COMANDERA, COCINA, PANTALLA, VISOR, KIOSKO,
  CARTELERIA, RESERVAS` (funcionales) + `PAGOS, QR_MESA, DELIVERY, API, STOCK`
  (proximamente). Las rutas ya existen en `apps/web/app/`.
- **Gating en dos puntos**: (1) `app/lib/nav.ts` — cada entrada declara
  `modulo?:` y se filtra igual que ya se filtra por rol; (2) guard en el layout
  de cada ruta de pantalla → "Módulo no activado" con enlace a Configuración.
- **Plan de suscripción**: `PLANES: Record<Plan, Modulo[]>` en el mismo fichero;
  fuera de plan → tarjeta de upgrade (solo UI). `tenant.plan` ya existe.

## Configuración: usar `setting`, no inventar

Precedencia **DEVICE > LOCAL > GLOBAL** (tabla `setting`, migración 0023, RPCs
`setting_get`/`setting_set`, helper `apps/web/app/lib/settings.ts`). Convención
de claves: `modulo.<MODULO>.<clave>` (ej. `modulo.COCINA.estaciones`,
`impresora.uri`, `backup.destino`, `modulo.FISCAL.serie`).
`tenant_module.config` = valores de empresa; `setting` = matices por
local/terminal. Si vas a crear una tabla de configuración nueva: para.

## Emparejado por código (un solo mecanismo para TODO dispositivo)

```
TPV/backoffice: "Añadir pantalla" → fila en device (modulo, código 6 dígitos,
  expira 10 min)
Dispositivo: /conectar → teclea código → POST /api/dispositivos/canjear
  → { device_id, modulo, token } → guarda credencial → salta a su ruta
```

- Columnas en `device`: `modulo, codigo_vinculacion, codigo_expira,
  vinculado_at` (+ unique parcial sobre el código). Código de un solo uso.
- **Token de dispositivo**: JWT firmado con `DEVICE_JWT_SECRET` (lib `jose`),
  claims `tenant_id, device_id, modulo`, caducidad 1 año + renovación. Se emite
  en un route handler con `SUPABASE_SECRET_KEY` (patrón existente:
  `app/api/admin/crear-empresa/route.ts`). La web lo guarda en localStorage;
  el desktop en `userData/device.json`.
- Las pantallas de solo-lectura (cocina, pantalla, cartelería, visor) NO usan
  sesión Supabase: route handlers propios verifican el token y hacen de proxy.
- **Desvincular** (página Módulos) borra/invalida la fila → el token deja de
  pasar la comprobación `vinculado_at not null`.
- El mismo flujo sirve para el TPV de escritorio, tablets de comandera y kiosko.
  No crear mecanismos de identidad alternativos.

## UI

- `(panel)/modulos`: tarjeta por módulo (interruptor, dispositivos vinculados,
  Configurar → slide-over con campos concretos del `config`, NO un editor JSON).
- En el TPV: Utilidades → "Módulos y pantallas" (rol ENCARGADO/PROPIETARIO),
  con "Añadir pantalla" para generar el código sin salir de la venta.
- Estilo backoffice: skill `ui-kit-shadcn` (tokens, slide-overs).

## El porqué comercial (para no diluirlo)

Glop vende 21 módulos a ~135-250 € que se activan cargando un archivo de
licencia y reiniciando. Nuestro pitch es el contrario: interruptor, código de
6 dígitos y la tele de cocina funcionando en un minuto. Cualquier PR que meta
fricción aquí (login en pantallas, archivos, configuración técnica) va contra
la razón de ser del módulo.
