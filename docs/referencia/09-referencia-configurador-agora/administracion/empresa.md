# Administración › Empresa

> Datos fiscales y de contacto del **titular** (la sociedad que factura). En Ágora es una ficha única por empresa; en nuestro modelo multi‑tenant es el `tenant` (organización). Estos datos **encabezan todas las facturas y tickets** y alimentan el registro VERIFACTU (emisor).

Captura: `Empresa` (Sabores de La Palma).

---

## Ágora — qué muestra

**Datos administrativos**
- Nombre Fiscal — `SABORES DE LA PALMA S.L.U.`
- Nombre Comercial — `SABORES DE LA PALMA`
- CIF — `B13637558`

**Ubicación**
- Dirección — `CTR. NACIONAL 340, KM 342 S/N`
- Población — `CARCHUNA`
- Provincia — `GRANADA`
- Código Postal — `18730`

**Contacto**
- Contacto (persona) — `ALBERTO`
- Teléfono — `958 62 39 03`
- Email — `info@granadalapalma.com`
- Página Web — `https://granadalapalma.com`

---

## Qué necesitamos

Todos esos campos, **más** lo que VERIFACTU/IGIC exige y Ágora no muestra aquí:

| Campo | Obligatorio | Nota |
|-------|:--:|------|
| Nombre fiscal (razón social) | ✅ | Emisor en factura/VERIFACTU |
| Nombre comercial | ⬜ | Cabecera del ticket si difiere |
| NIF/CIF | ✅ | Validar formato ES |
| Dirección, población, provincia, CP | ✅ | Domicilio fiscal |
| País | ✅ | Por defecto ES; relevante para IGIC (Canarias) |
| **Régimen fiscal del territorio** | ✅ | PENINSULA / CANARIAS(IGIC) / CEUTA‑MELILLA(IPSI) / FORAL — **clave para resolver el impuesto** |
| Persona de contacto, teléfono, email, web | ⬜ | Operativo |
| Logo | ⬜ | Para ticket/factura A4 (ver [04 — Impresión](../../04-impresion-y-tickets/)) |
| **Certificado VERIFACTU (mTLS) / entorno AEAT** | ✅ | No va aquí en Ágora, pero es del emisor; lo gestiona `apps/api` |

---

## Mapeo a nuestro modelo

- Tabla `tenant` (organización / titular) en Supabase — multi‑tenant con RLS por `tenant_id`.
- El **territorio fiscal** (`PENINSULA_BALEARES` | `CANARIAS` | `CEUTA_MELILLA` | `FORAL_PV` | `FORAL_NAVARRA`) decide el impuesto vía `@gluuh/core` (`ivaAuto`) y la tabla `tax_rate`/`resolver_iva()`. **Sabores de La Palma es Granada → península → IVA**, pero el sistema debe soportar Canarias→IGIC (mercado objetivo). Ver [03 — Catálogo](../../03-catalogo-productos-y-modificadores/) y [07 — Configuración](../../07-configuracion-y-administracion/).
- Datos de emisor → cabecera de plantillas de ticket/factura y campos del registro VERIFACTU (`@gluuh/core` `fiscal/`).

## Mejoras sobre Ágora

- **Validación en vivo del NIF/CIF** y aviso si el territorio fiscal no concuerda con la provincia (p. ej. provincia canaria → sugerir IGIC).
- **Subir logo aquí** y previsualizar cómo queda en ticket 80mm y factura A4.
- **Un solo sitio para el emisor**: que el territorio fiscal elegido aquí propague automáticamente los tipos por defecto (no reescribir % en cada producto).
- Multi‑local real: estos son datos de la **empresa**; lo específico de cada local (dirección de la sede de venta si difiere, series, cierre) vive en *Editar Local* → [`locales.md`](locales.md).
