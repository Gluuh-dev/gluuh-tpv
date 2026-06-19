# Herramientas › VERIFACTU (configuración + visor) ★

> Configuración del emisor **VERIFACTU** (certificado mTLS, NIF) y **visor de facturas** emitidas con verificación de la **cadena de huellas**. Es nuestro **diferenciador** y ya existe parcialmente en el repo (`@gluuh/core` motor + *Visor Verifactu* en `apps/web`, commit reciente). Ver [07 — Facturación y cumplimiento legal](../../../07-facturacion-y-cumplimiento-legal.md).

Capturas: `Configuración Verifactu` (listado + editor) + `Visor de Verifactu`.

---

## 1. Configuración Verifactu

**Listado** — Id · Nombre Fiscal · Cif.

**Editor:** **Nombre Fiscal** · **CIF** · **Activado el** (fecha) · **Certificado** (adjuntar el certificado digital mTLS del emisor).

> El **certificado** es el que autentica el envío a la AEAT (mTLS). Datos del emisor coherentes con [Empresa](../administracion/empresa.md). En Gluuh lo gestiona `apps/api` (cliente AEAT con mTLS); el certificado **nunca** en el cliente.

```sql
create table verifactu_config (
  id uuid primary key default gen_random_uuid(), tenant_id uuid,
  nombre_fiscal text, nif text, activado_en date,
  entorno text default 'PRODUCCION',     -- PRUEBAS | PRODUCCION
  certificado_ref text                   -- referencia segura (no el .p12 en claro)
);
```

## 2. Visor de Verifactu

**Buscar Facturas** — **Entorno** (`Producción`/Pruebas) · **Desde/Hasta** · búsqueda por **Serie/Nº**. Tabla **Fecha · Número · Estado · Detalles · CSV · Base · Cuota · Total · Propina · Cadena Correcta** + **Exportar a XML** y vista lista/detalle.

> Columnas clave:
> - **CSV** = Código Seguro de Verificación (cotejo AEAT).
> - **Estado** = enviada/aceptada/rechazada/encolada.
> - **Cadena Correcta** = ✅/❌ **verificación de la huella encadenada** (que ningún registro se haya alterado ni falte) — el corazón de VERIFACTU.
> - **Exportar a XML** = el registro de facturación en el formato AEAT.

> **Ya implementado** en parte: el motor (huella SHA‑256 encadenada + QR, vector oficial AEAT) en `@gluuh/core`, y el *Visor Verifactu* en `apps/web` (commit `097da8b`). ✅ motor + visor básico / 🟡 falta panel de estado de envío y verificación de cadena completa.

## Mejoras sobre Ágora

- **Panel de salud de la cadena**: huecos, registros encolados offline ([01 §4](../../01-arquitectura-y-plataforma/)), enviados/rechazados a la AEAT, reintentos.
- **Reverificación** de la cadena bajo demanda (recalcular huellas y comparar) — auditoría interna.
- Soporte de **entorno de pruebas vs producción** claramente separado, con aviso visual.
- Integración con el **cobro offline** (serie por terminal, [series.md](../administracion/series.md)) para que la cadena no tenga huecos.
