# Herramientas › Cartas Digitales (SmartMenu / carta QR)

> **Carta digital** accesible por **QR/URL**: el cliente ve la carta en su móvil, con marca, alérgenos y añadidos, y puede pedir/pagar (Scan&Pay). Es el SmartMenu citado en [locales.md §9](../administracion/locales.md). Nuestro equivalente: `app/kiosko` + carta pública.

Capturas: `Cartas Digitales` (listado) + `Editar Carta Digital`.

---

## A. Listado
**Id · Nombre · Tarifa 1/2/3 · Enlace Válido · Licencia**: `Sabores de La Palma` / LOCAL / … / Enlace Válido `No` / Licencia `Sí`.

## B. Editor
| Bloque | Campos |
|--------|--------|
| **Carta Digital** | Nombre · Descripción · Texto en Pie · **Color** (`#6cc9c7`) · **Color de Fondo** · **Estilo Avanzado** (CSS) · Imagen |
| **Términos y Condiciones** | texto legal |
| **Tarifas 1/2/3** | hasta 3 [tarifas](../administracion/tarifas.md) seleccionables |
| **Código de Moneda** | `EUR` (ISO 4217) |
| ☑ **Mostrar añadidos** · ☑ **Mostrar alérgenos** | qué se enseña al cliente |
| **Categorías de la Carta** | qué categorías aparecen (buscar/añadir/ordenar) |
| **Acceso a la Carta** | **URL** (`https://smartmenu.agorapos.com/?id=72e8vytm`) + **QR** + Descargar QR |
| **Opciones de Pedidos** | Texto al Completar Pago · Categoría de Sugerencias · Texto al Mostrar Sugerencias (venta cruzada) |
| **Vista Previa** | render en vivo |

> Es la **carta pública por QR** con marca propia, multi‑idioma ([recursos.md](recursos.md)), alérgenos ([alergenos.md](../productos/alergenos.md)) y sugerencias. El flujo de pedido/pago lo define [config-pago-pedidos.md](config-pago-pedidos.md).

## Mapeo a nuestro modelo

```sql
create table digital_menu (
  id uuid primary key default gen_random_uuid(), tenant_id uuid,
  nombre text, descripcion text, pie text,
  color text, color_fondo text, css text, imagen_url text,
  terminos text, moneda text default 'EUR',
  price_list_1 uuid, price_list_2 uuid, price_list_3 uuid,
  mostrar_anadidos boolean default true, mostrar_alergenos boolean default true,
  slug text,                      -- ?id=... del enlace público
  texto_pago text, sugerencias_category_id uuid, sugerencias_texto text
);
create table digital_menu_category (digital_menu_id uuid, category_id uuid, orden int);
```

- Carta pública servida por `apps/web` (ruta `/carta/[slug]`), QR generado por `@gluuh/core` (ya hace QR VERIFACTU). 🟡 kiosko existe; carta QR pública + pedido online falta.

## Mejoras sobre Ágora

- **Misma base de marca** que el backoffice/ticket (color/logo del local), no un editor aparte.
- Fotos por producto, filtros (vegano/picante), e **idiomas** reutilizando recursos.
- Pedido/pago integrado con el cobro offline‑first y VERIFACTU; enlace público con caché/CDN.
