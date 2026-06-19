# Infraestructura — cuentas, bases de datos, servicio local y hardware

> Lo que necesitamos para **funcionar bien** desde el primer día: el modelo de **cuentas** (empresa + usuarios), las **bases de datos**, el **servicio que se instala en el PC del local**, y cómo **conectamos, detectamos y configuramos impresoras y pantallas**. Análisis para tenerlo claro antes de empezar a construir. Complementa [`../implementacion/`](../implementacion/) (modelo de datos y arquitectura) y [`../01-arquitectura-y-plataforma/`](../01-arquitectura-y-plataforma/).

---

## El modelo en una frase

> **Cuenta de empresa (en la nube)** ← acceden **usuarios personales** (con su rol). En el local se **instala un servicio en el PC** que se **da de alta con usuario y contraseña** de esa empresa; ese servicio se convierte en el **nodo local** (servidor LAN + puente de hardware) del negocio, y los **terminales** (TPV, comandera, KDS, pantalla) trabajan contra él y/o contra la nube.

```
                       ☁ NUBE (Supabase)
         Cuenta EMPRESA (tenant)  ← usuarios personales (login)
                   │  datos canónicos, auth, sync
                   ▼
   🖥 PC del local: SERVICIO GLUUH (se instala, login usuario+contraseña)
        = nodo local del tenant: servidor LAN + puente de hardware
                   │ LAN
     ┌─────────────┼───────────────┬───────────────┐
   TPV          Comandera         KDS            Pantalla     🖨 impresoras / cajón / datáfono
 (Tauri)         (PWA/Expo)      (PWA)          cliente       (vía el servicio)
```

---

## Documentos

| # | Documento | Qué resuelve |
|---|-----------|--------------|
| 01 | [`cuentas-y-acceso.md`](cuentas-y-acceso.md) | Cuenta de **empresa** (tenant) + **usuarios personales**; alta, invitaciones, roles; cómo el **servicio del PC** se conecta con usuario/contraseña; autenticación (Supabase Auth + tokens de servicio/dispositivo); multi‑local. |
| 02 | [`bases-de-datos.md`](bases-de-datos.md) | Stack de datos: **Supabase (PostgreSQL en la nube, canónico)** + **BD local (SQLite/edge)** + **PowerSync**; qué dato vive dónde; multi‑tenant RLS; storage (logos, certificados), realtime, backups; por qué este stack. |
| 03 | [`servicio-local-pc.md`](servicio-local-pc.md) | El **servicio que se instala en el PC** del local: qué es, instalación, login con la cuenta de empresa, qué hace (servidor LAN, **puente de hardware**, print server, cache offline), autodescubrimiento, actualización y seguridad. |
| 04 | [`hardware-deteccion-y-configuracion.md`](hardware-deteccion-y-configuracion.md) | Cómo **conectamos, detectamos y configuramos** impresoras de ticket y pantallas (cliente/KDS/visor) en la app: tipos de conexión, autodetección, asignación a estación/documento, impresión de prueba. |

> Convención: cada documento explica **para qué sirve · cómo lo resolvemos · qué necesitamos · prioridad**. El esquema SQL detallado vive en [`../implementacion/modelo-de-datos.md`](../implementacion/modelo-de-datos.md); la arquitectura técnica en [`../implementacion/arquitectura.md`](../implementacion/arquitectura.md); el modelo de roles de dispositivo en [`../implementacion/conexion-y-roles-dispositivo.md`](../implementacion/conexion-y-roles-dispositivo.md).
