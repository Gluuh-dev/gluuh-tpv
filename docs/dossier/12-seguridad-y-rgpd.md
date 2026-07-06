# 12 — Seguridad y RGPD

> Cómo protegemos los datos del negocio, de sus clientes y de los pagos. Un TPV maneja dinero y datos personales: la seguridad y el cumplimiento del RGPD son requisitos, no opcionales. Complementa la fiscalidad ([07](07-facturacion-y-cumplimiento-legal.md)), la arquitectura ([04](04-arquitectura-tecnica.md)) y los pagos ([08](08-pasarelas-de-pago.md)).

---

## 1. Modelo de amenazas (qué protegemos)

| Activo | Amenaza | Impacto |
|--------|---------|---------|
| Datos de ventas/facturación de cada local | Acceso de otro tenant, manipulación | Legal (Verifactu) + confianza |
| Datos personales de clientes (fidelización, reservas, facturas) | Fuga, uso indebido | Multa RGPD + reputación |
| Datos de pago (tarjeta) | Robo de PAN | PCI‑DSS + fraude |
| Credenciales de empleados | Acceso no autorizado, fraude interno | Pérdidas + manipulación de caja |
| Integridad de los registros fiscales | Alteración (doble contabilidad) | Sanción de hasta 150.000 € |

---

## 2. Aislamiento multi‑tenant (seguridad de datos)

- **Row‑Level Security (RLS)** en PostgreSQL: cada query filtra por `tenant_id` automáticamente; **sin contexto → cero filas** (seguro por defecto). Una query con bug **no** puede filtrar datos de otro restaurante.
- El **JWT** porta `tenant_id` + `role`; se valida en cada petición y fija el contexto RLS.
- **Buckets de PowerSync** por tenant: cada dispositivo solo descarga sus datos.
- Defensa en profundidad: validación de `tenant_id` también en la capa de aplicación (NestJS guards), no solo en la BD.

> Detalle en [06 — Base de datos](06-base-de-datos-y-sincronizacion.md) §2.

---

## 3. Autenticación y autorización

- **Backoffice / propietario:** email + contraseña (hash con Argon2/bcrypt) + **2FA** recomendado.
- **Camarero (TPV/comandera):** **PIN** sobre una sesión de dispositivo ya autenticada (el dispositivo se registra una vez con credenciales del local). El PIN es UX local, no la credencial primaria.
- **RBAC** (roles y permisos granulares): admin plataforma, propietario, encargado, camarero, cocina. Permisos para acciones sensibles (anular, descuento, abrir cajón, cierre de caja, ver informes).
- **Auditoría:** registro inalterable de acciones sensibles (anulaciones, descuentos, accesos, aperturas de cajón) — exigible también por Verifactu (registro de eventos).
- **Auth:** Supabase Auth → Keycloak (escala); Auth0/Clerk para SSO/SAML de cadenas. Ver [05](05-stack-tecnologico.md) §11.

---

## 4. Seguridad de pagos (PCI‑DSS)

- **No almacenar el PAN** (número de tarjeta). Usar **tokenización** y SDKs de la pasarela (Stripe/Redsys) → el dato de tarjeta **nunca toca nuestros servidores**.
- Esto reduce nuestro alcance PCI al nivel más bajo (**SAQ‑A**).
- **SCA / 3D Secure 2** gestionado por la pasarela (ver [08](08-pasarelas-de-pago.md) §4).
- Datáfono semiintegrado: conserva su **propia certificación PCI** (el importe pasa por la DLL, no los datos de tarjeta).
- Comunicaciones con pasarelas siempre por **TLS**; validar **webhooks** con firma.

---

## 5. Cifrado y comunicaciones

| Dónde | Medida |
|-------|--------|
| En tránsito | **TLS 1.2+** en todas las comunicaciones (cliente↔nube, nube↔AEAT/pasarelas) |
| En reposo (nube) | Cifrado de disco en Postgres; secretos en gestor (Vault/Secrets Manager) |
| En reposo (dispositivo) | SQLite local cifrada (SQLCipher / cifrado del SO); datos sensibles mínimos en local |
| Certificados | Certificado electrónico para envío Verifactu/TicketBAI custodiado de forma segura |
| Secretos | Nunca en el código ni en el cliente; `connection_token` de Stripe efímero |

---

## 6. RGPD / LOPDGDD

### 6.1 Bases jurídicas por finalidad
| Dato / finalidad | Base jurídica |
|------------------|---------------|
| Datos en factura (NIF, nombre, domicilio) | **Obligación legal** (art. 6.1.c) — facturación fiscal |
| Gestión de la relación (reservas, pedidos) | **Ejecución de contrato** (art. 6.1.b) |
| Fidelización / marketing | **Consentimiento** (art. 6.1.a) — explícito y revocable |
| Datos de pago | Obligación + PCI |

### 6.2 Principios aplicados
- **Minimización:** un **ticket B2C no necesita datos personales**; solo se piden NIF/domicilio si el cliente quiere factura.
- **Limitación del plazo:** tras las obligaciones fiscales/mercantiles (4‑6‑10 años) → **bloqueo** y luego **supresión** automatizada.
- **Información al interesado** (art. 13): avisos de privacidad en carta digital, reservas, fidelización.
- **Derechos** (acceso, rectificación, supresión, portabilidad): procesos para atenderlos.

### 6.3 Como encargado/responsable del tratamiento
- Somos **encargado del tratamiento** de los datos que el restaurante (responsable) gestiona en nuestra plataforma → **contrato de encargo (DPA)** con cada cliente.
- **Registro de actividades de tratamiento (RAT)**.
- **Subencargados** (Supabase, Stripe, PowerSync, etc.): listados y con garantías adecuadas (transferencias internacionales con SCC si aplica).
- **Brechas de seguridad:** procedimiento de notificación en **72 h** a la AEPD.

### 6.4 Retención alineada con la fiscalidad
- Registros fiscales/Verifactu: **≥ 6 años** (ver [07](07-facturacion-y-cumplimiento-legal.md) §9).
- Datos de fidelización/marketing: mientras haya consentimiento; borrado al revocarlo.

---

## 7. Seguridad operativa y del software

- **SDLC seguro:** revisión de código, dependencias auditadas (Dependabot/Snyk), secretos fuera del repo.
- **Backups** Postgres con PITR; pruebas de restauración periódicas.
- **Observabilidad:** logs centralizados, alertas, detección de anomalías (Sentry + métricas).
- **Actualizaciones:** OTA en móvil (Expo), auto‑update firmado en escritorio (Tauri) — sin parar el servicio.
- **Principio de mínimo privilegio** en accesos a infraestructura.
- **Inalterabilidad fiscal:** el motor Verifactu impide editar/borrar registros sin dejar rastro (registro de eventos) — requisito legal y de seguridad a la vez.
- **Rate limiting** y protección anti‑abuso en la API; validación estricta de entradas (Zod).

---

## 8. Checklist de cumplimiento

**Seguridad técnica**
- [ ] RLS por `tenant_id` activa y testeada (test de fuga entre tenants).
- [ ] JWT con `tenant_id`+`role`; guards en API; buckets PowerSync por tenant.
- [ ] PINs y contraseñas con hashing fuerte; 2FA en backoffice.
- [ ] TLS en todo; secretos en gestor; SQLite local cifrada.
- [ ] Webhooks de pago verificados por firma.

**Pagos (PCI)**
- [ ] No almacenar PAN; tokenización vía pasarela (SAQ‑A).
- [ ] SCA/3DS gestionado por la pasarela.

**RGPD**
- [ ] DPA con cada cliente; RAT; lista de subencargados.
- [ ] Minimización en tickets; consentimiento para fidelización.
- [ ] Políticas de retención/bloqueo/borrado automatizadas.
- [ ] Procedimiento de brechas (72 h) y atención de derechos.

**Fiscal/auditoría**
- [ ] Registro de eventos inalterable (Verifactu).
- [ ] Trazabilidad de acciones sensibles (anulaciones, descuentos, cajón).

---

## 9. Fuentes

RGPD (Reglamento UE 2016/679) y **LOPDGDD (LO 3/2018)** · AEPD (aepd.es) · Verifactu/registro de eventos (sede.agenciatributaria.gob.es — ver [07](07-facturacion-y-cumplimiento-legal.md)) · PCI‑DSS / SAQ‑A (pcisecuritystandards.org) · PSD2/SCA (ver [08](08-pasarelas-de-pago.md)) · buenas prácticas multi‑tenant RLS (ver [06](06-base-de-datos-y-sincronizacion.md)).
