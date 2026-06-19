# Implementación — cómo lo construimos (plan unificado)

> Convierte la **referencia** ([`../09-referencia-configurador-agora/`](../09-referencia-configurador-agora/)) y las **mejoras** ([`../mejoras/`](../mejoras/)) en un plan **construible**: fases priorizadas, **modelo de datos unificado** (todos los DDL consolidados) y **arquitectura técnica**. Complementa la guía de construcción ([`../08-roadmap-de-implementacion/`](../08-roadmap-de-implementacion/)).

---

## Documentos

| Documento | Qué contiene |
|-----------|--------------|
| [`plan-por-fases.md`](plan-por-fases.md) | Fases F0–F8 con módulos, criterios de hecho (DoD), dependencias y checklist maestro, ajustado al estado real del repo y a las mejoras. |
| [`modelo-de-datos.md`](modelo-de-datos.md) | **Esquema completo unificado** (multi‑tenant RLS): todas las tablas de las fichas consolidadas y reconciliadas en un solo modelo coherente. |
| [`arquitectura.md`](arquitectura.md) | Arquitectura técnica: superficies (web config / apps táctiles), offline‑first + sync, motor fiscal `@gluuh/core`, informes (RPC), agente de hardware, multi‑tenant. |
| [`conexion-y-roles-dispositivo.md`](conexion-y-roles-dispositivo.md) | Cómo cada equipo se conecta y elige su rol (TPV/comandero/KDS…): modelo de Ágora (IP:puerto + Tipo) y nuestra propuesta de **emparejamiento por QR** sin IPs. |

---

## Principios de implementación

1. **Una base de código React (`apps/web`)** sirve backoffice + TPV + comandera + KDS + carta; **Tauri/Expo** solo envuelven donde hay hardware. Cero duplicación de lógica fiscal (`@gluuh/core`).
2. **Backend valida toda escritura** (NestJS): RBAC, fiscalidad, numeración legal. Nada "sucio" entra en Postgres.
3. **Configurabilidad por `setting`** (GLOBAL/LOCAL/DEVICE) en vez de columnas por flag.
4. **Construir poco y bien por fase**, verificable, antes de ampliar. Lo ya hecho en `apps/web` y `@gluuh/core` se reutiliza.
5. **Cumplimiento de serie**: VERIFACTU + IGIC cuadrados; serie por terminal para offline.

> Estado de partida real (del repo): `apps/web` avanzada (TPV, comandera, kiosko, cocina, kds, backoffice con 11 informes reales y Visor VERIFACTU); `@gluuh/core` con motor fiscal probado (vector AEAT); `apps/api`, `packages/sync` y móvil/escritorio en esqueleto.
