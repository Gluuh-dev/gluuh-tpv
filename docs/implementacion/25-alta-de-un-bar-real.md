# 25 — Dar de alta un bar REAL, de cero a cobrar

> **Para qué**: onboarding de un cliente de verdad. Todas las piezas ya existen y
> están probadas por separado; lo que faltaba era **el guion que las une**.
> Si algo aquí no cuadra con el código, manda el código y se corrige este fichero.

**Regla que manda sobre todo**: solo se tocan el Supabase del proyecto
(`gxcqihslbicrszgzudjs`) y el Postgres del nodo (**55432**). Ninguna otra BD.

---

## Resumen en una línea

`/admin` crea la empresa (y le clona una carta de plantilla) → el instalador ata el
nodo a esa empresa con el **código de instalación** → el dueño ajusta la carta en el
panel (o la importa por CSV) → los terminales se emparejan → **el bar cobra sin internet**.

---

## Paso 1 · Crear la empresa (consola de plataforma)

**La empresa SOLO la crea Gluuh**, desde `/admin/empresas/nueva` (decisión de `0078`:
ningún signup crea empresas; el trigger `handle_new_user` solo provisiona si llega
`empresa_nombre` en la metadata).

En esa pantalla se rellena, en un paso:

- **Datos**: nombre, usuario del backoffice, email de contacto, CIF, dirección, población, provincia, CP, teléfono.
- **Duración** (meses de suscripción) y **módulos contratados**.
- **Qué importar de la plantilla**: `Familias y productos`, `Impuestos`, `Formas de pago`, `Plantillas de ticket`.

El alta crea de una vez:

| Se crea | Dónde |
|---|---|
| `tenant` (la empresa) | `handle_new_user` / `crear-empresa` |
| `app_user` con rol **PROPIETARIO** | ídem |
| `location` (CIF `PENDIENTE`, territorio, `regimen_facturacion=VERIFACTU`, serie `F`) | ídem |
| **Código de instalación** `0000-0000-00000-0000-0000` | `0078` (único por empresa) |
| **Clave técnica** | `aprovisionar()` |
| **Carta clonada de la plantilla** | `app/lib/clonar-plantilla.ts` (remapea familia→categoría→producto, m2m, formatos, modificadores) |

⚠️ **El "pack de entrega" se muestra UNA sola vez**: usuario + password inicial +
código de instalación + clave técnica. **Apuntarlo ahí mismo.**

> El territorio fiscal por defecto es `PENINSULA_BALEARES`. **Para un bar canario hay
> que cambiarlo a `CANARIAS`** en `location.territorio_fiscal`, o todo el IGIC saldrá
> mal (el % lo resuelve `resolver_iva(clase, territorio)`).

---

## Paso 2 · Instalar el nodo en el bar

En el mini-PC de debajo de la barra:

```powershell
# El instalador de verdad (asistente de 4 páginas)
C:\gluuh-paquete\dist\GluuhServidor-1.0.0.exe
# o, desde el repo:
.\supabase\nodo\Instalar-Gluuh.ps1
```

Se le da el **código de instalación** del paso 1: eso ata esa instalación a esa
empresa y **acota el login de operarios a ese tenant** (`verificar_clave_operario`
con `p_tenant`), aunque usuario+clave coincidan en otra empresa.

⛔ **Pendiente y crítico**: esto hay que probarlo **en una máquina limpia** (sin Node,
sin Postgres, sin el repo) y **cobrar una mesa**. Es la única prueba que falta.

---

## Paso 3 · La carta real

El bar arranca con la **carta de la plantilla** (paso 1). Para poner la suya hay dos vías:

### a) A mano, en el panel
`(panel)/familias`, `categorias`, `productos`, `modificadores`, `menus`,
`alergenos`, `tarifas`, `ordenar-productos`. Bien para retoques.

### b) Importada por CSV (recomendado si la carta es grande)

Casi todos los TPV del mercado (Ágora, Glop, Revo, SumUp, Square) exportan a CSV/Excel.

```bash
# 1) SIMULACIÓN: dice qué haría, no toca nada
DIRECT_URL="postgresql://…" node scripts/importar-catalogo.mjs carta.csv --tenant <uuid>

# 2) Escribir de verdad
DIRECT_URL="postgresql://…" node scripts/importar-catalogo.mjs carta.csv --tenant <uuid> --aplicar
```

- Plantilla para rellenar: `scripts/plantillas/carta-ejemplo.csv`.
- Columnas: `familia | categoria | producto | precio | clase_fiscal | estacion | alcohol`
  (acepta sinónimos: `PVP`, `Artículo`, `Categoría`… y precios ES/EN).
- **El % de impuesto no se importa**: se guarda `clase_fiscal` y el porcentaje lo pone
  `resolver_iva(clase, territorio)`. Así el IGIC canario sale solo.
- **Idempotente**: el 2º pase reporta 0 cambios.
- Aborta si `DIRECT_URL` es local y el puerto no es 55432 (REGLA Nº1).

---

## Paso 4 · Trabajadores

`(panel)/empleados` (alta, rol, **PIN**) y `(panel)/perfiles` (permisos).
Roles: `PROPIETARIO`, `ENCARGADO`, `CAMARERO`, `COCINA`.

Para invitar a alguien con acceso al **backoffice**, `(panel)/invitaciones` emite una
**invitación de un solo uso** (`0115`): el token viaja una vez, en la BD solo queda su
hash SHA-256, caduca a los 7 días, y el invitado **crea su propia contraseña**.
Nunca se reparten contraseñas por WhatsApp.

El TPV lee los operarios reales del nodo (`listar_operarios` + `validar_pin`); sin
terminal emparejado enseña un equipo de ejemplo **marcado como demo**.

---

## Paso 5 · Emparejar los terminales

`(panel)/dispositivos` + el código de instalación. Cada TPV (tablet/PC) abre la SPA
que sirve el nodo por wifi local. A partir de aquí **no hace falta internet**.

---

## Paso 6 · Comprobar antes de dejar el bar

- [ ] `location.territorio_fiscal` correcto (**CANARIAS** si toca) → comprobar que un producto muestra el % esperado.
- [ ] La carta se ve en el TPV (familias, categorías, precios).
- [ ] Cada operario entra con **su** PIN.
- [ ] **Cobrar una mesa de verdad**: ticket impreso + factura con huella y QR.
- [ ] Comanda a cocina/barra por estación.
- [ ] Abrir y cerrar **jornada** (Z, arqueo).
- [ ] Tirar el cable de internet → **sigue cobrando**. (Es el argumento de venta.)
- [ ] Volver a enchufar → las ventas suben sin duplicar (idempotencia por `client_id`).

---

## Qué NO está resuelto todavía (sé honesto con el cliente)

| Hueco | Estado |
|---|---|
| El `.exe` en **máquina limpia** + cobrar | ⛔ **sin probar** — la prueba que falta |
| **Datáfono integrado** (tarjeta) | ❌ hoy se cobra en el datáfono y se confirma a mano |
| **Bizum / Pago QR** reales | ❌ falta PSP/pasarela; la UI ya tiene el hueco |
| Importar **menús** por CSV | ❌ los menús se hacen en el panel |
| TPV de **Vite** con datos reales | ❌ va con datos demo; el que opera de verdad es el de Next + nodo |

---

## Referencias

- Estado vivo: `docs/estado/AHORA.md` · Trampas: `docs/estado/TRAMPAS.md`
- Alta e invitaciones: `supabase/migrations/0115_invitaciones_y_alta_titular.sql`
- Código de instalación: `0078_instalacion_por_codigo.sql`, `0104_empresa_por_codigo_instalacion.sql`
- Emparejado y operarios: `0117_emparejado_v2_y_operario.sql`
- Impuestos por territorio: `0012_catalogo_fiscal.sql` (`tax_rate`, `resolver_iva`)
- Clonado de plantilla: `apps/web/app/lib/clonar-plantilla.ts`
