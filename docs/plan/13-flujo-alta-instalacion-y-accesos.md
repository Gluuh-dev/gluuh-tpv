# 13 — Flujo de alta, instalación e identidades

> **Estado:** origen de decisiones; consolidado y aprobado en el [plan 14](14-plan-definitivo-reparacion-identidad-seguridad.md)
>
> **Fecha:** 17-07-2026
>
> **Alcance:** conversación y alternativas de diseño. Ante cualquier conflicto manda el plan 14.

## 1. Objetivo

Definir un recorrido sencillo para que:

1. Gluuh dé de alta una empresa desde `admin.gluuh.com`.
2. El propietario reciba y active su acceso al backoffice.
3. Un código de instalación permita levantar una sola instalación autorizada del nodo.
4. Cada TPV, comandera, KDS o pantalla se vincule al nodo correcto.
5. Los trabajadores se identifiquen dentro de un dispositivo ya vinculado.
6. Puedan revocarse, reinstalarse o recuperarse nodos y terminales sin compartir contraseñas maestras.

La idea principal es no mezclar **quién paga**, **qué instalación está autorizada**, **qué aparato es** y **qué persona lo está usando**.

## 2. Descripción original, ordenada y limpiada

El flujo descrito por el propietario de Gluuh es el siguiente:

1. Una empresa se pone en contacto con Gluuh y comunica qué necesita.
2. Se acuerdan módulos contratados, límites, duración y forma de pago de la suscripción.
3. Gluuh crea la empresa desde `admin.gluuh.com`.
4. Se registra el email del propietario o responsable.
5. El propietario verifica su email y recibe un acceso inicial que podrá cambiar.
6. Al crear la empresa se genera un código largo de instalación, con formato `0000-0000-00000-0000-0000`.
7. En el local, el instalador introduce ese código para instalar y levantar el nodo.
8. El nodo prepara la empresa, módulos y datos iniciales necesarios para trabajar localmente.
9. Cada TPV se conecta al nodo mediante su dirección en la red local y una identidad propia, por ejemplo `tpv1`, `tpv2`, etc.
10. Una vez conectado el terminal, los trabajadores se identifican dentro del TPV con sus cuentas, PIN o pulsera para atribuir acciones y aplicar permisos.

La duda principal es si durante la instalación del nodo hacen falta también el email y la contraseña del propietario o si el código largo, al ser de un solo uso, debería bastar.

## 3. Modelo propuesto: cinco identidades distintas

| Identidad | Representa | Se usa cuándo | No debe servir para |
|---|---|---|---|
| **Administrador de plataforma** | El propietario/desarrollador de Gluuh | Crear empresas, planes, módulos, licencias y soporte | Operar como trabajador permanente del bar |
| **Cuenta del propietario** | La persona responsable de la empresa cliente | Entrar al backoffice desde casa o desde el local | Identificar un nodo o un TPV concreto |
| **Identidad del nodo** | Una instalación local autorizada, normalmente una por local | Sincronizar, servir la aplicación por LAN y administrar dispositivos locales | Atribuir ventas a un camarero |
| **Identidad del dispositivo** | `tpv1`, `tpv2`, `cocina1`, `comandera1`, etc. | Cargar su módulo, caja, impresoras y configuración | Entrar como propietario o trabajador |
| **Operario activo** | Camarero, encargado, cocina o propietario que usa el aparato | Firmar ventas, cobros, anulaciones, aperturas de cajón y cambios | Mantener conectado técnicamente al dispositivo |

Esto permite que el TPV permanezca conectado durante meses aunque cambie el camarero activo muchas veces al día.

## 4. Flujo objetivo propuesto

### 4.1 Alta comercial en `admin.gluuh.com`

Gluuh crea:

- Empresa y datos fiscales.
- Uno o varios locales.
- Plan, módulos, límites de dispositivos y vigencia.
- Datos de facturación de la suscripción y forma de pago comercial.
- Cuenta del propietario.
- Perfiles iniciales recomendados.
- Una orden de instalación para el primer nodo del local.

**Recomendación:** no enviar una contraseña generada por Gluuh. Enviar una invitación de un solo uso para verificar el email y permitir que el propietario elija su propia contraseña. Así Gluuh nunca conoce ni transmite la contraseña definitiva.

La «forma de pago de Gluuh» debe quedar separada de las formas de pago del restaurante —efectivo, tarjeta, Bizum— porque son conceptos distintos.

### 4.2 Activación de la cuenta del propietario

1. El propietario recibe un email de invitación.
2. Abre el enlace de un solo uso.
3. Verifica su email.
4. Define su contraseña o registra una passkey.
5. Entra por primera vez y revisa los datos de la empresa.

Debe existir recuperación de contraseña independiente del nodo. Perder el nodo no puede impedir al propietario entrar en el backoffice en la nube.

### 4.3 Código de instalación del nodo

La propuesta recomendada es que el código largo sea:

- De alta entropía y generado aleatoriamente.
- De un solo uso real.
- Asociado a una empresa **y a un local concreto**.
- Asociado al tipo de instalación `NODO`.
- Con fecha de emisión, caducidad, canje y revocación.
- Inutilizable después de un canje correcto.
- Sustituible por un código de recuperación nuevo si hay que reinstalar.

Durante una instalación normal debería bastar con el código. Pedir además email y contraseña del propietario aporta poca seguridad y obliga a entregar al técnico una credencial personal que no necesita.

El código no debe convertirse en la contraseña permanente del nodo. Su única función es intercambiarse una vez por una credencial propia del nodo, revocable y limitada a esa empresa/local.

Estados funcionales propuestos:

`EMITIDO → CANJEANDO → CANJEADO`

Salidas adicionales: `CADUCADO`, `REVOCADO` y `FALLIDO_RECUPERABLE`.

### 4.4 Qué hace el instalador del nodo

1. Comprueba internet, fecha/hora, espacio, permisos y puertos necesarios.
2. Pide el código largo.
3. Muestra la empresa y el local encontrados para confirmación humana.
4. Canjea el código una sola vez.
5. Recibe una identidad propia del nodo; nunca una clave global de Supabase.
6. Instala y arranca exclusivamente el Postgres local autorizado en `55432`.
7. Aplica el esquema local compatible.
8. Provisiona la empresa, el local, módulos y configuración inicial.
9. Verifica conteos, servicios y capacidad de operar sin internet.
10. Muestra un resumen: nombre del nodo, dirección LAN, estado y siguiente paso para conectar terminales.

El instalador solo debe marcarse como completado cuando el nodo esté realmente listo. Un provisionado parcial debe quedar como instalación incompleta y reanudable.

### 4.5 Conexión del primer TPV

Hay dos modelos posibles:

| Modelo | Ventajas | Problemas |
|---|---|---|
| **IP + usuario `tpv1` + contraseña permanente** | Es familiar y fácil de explicar | Contraseña en post-it, reutilización, fuerza bruta, recuperación más difícil y más secretos que mantener |
| **IP/autodescubrimiento + código de emparejado de un solo uso** | No deja una contraseña reutilizable, se revoca fácilmente y sirve para todos los módulos | Hay que generar o mostrar el código antes de conectar el aparato |

**Recomendación:** conservar `tpv1`, `tpv2`, etc. como nombres visibles, pero usar emparejado de un solo uso como credencial inicial.

Recorrido recomendado:

1. El instalador de Gluuh Desktop busca el nodo en la LAN.
2. Si no lo encuentra, permite escribir su IP o nombre local.
3. El nodo o el backoffice genera un código corto de emparejado, válido pocos minutos y para un único uso.
4. El TPV introduce el código.
5. El nodo entrega una credencial permanente de dispositivo, guardada de forma segura por Gluuh Desktop.
6. El terminal queda identificado como `tpv1`, con su módulo, local, caja, impresoras y permisos técnicos.
7. En los siguientes arranques entra directamente a su pantalla y solo pide identificar al trabajador.

El código largo de instalación no debería escribirse en cada TPV: pertenece al alta del nodo. Cada terminal recibe una identidad propia desde el nodo ya autorizado.

### 4.6 Segundo TPV y otros dispositivos

Para añadir `tpv2`, una comandera o un KDS:

1. Un propietario o encargado autorizado crea el dispositivo desde el panel o desde utilidades del TPV.
2. Elige módulo, nombre, local, estación e impresoras.
3. Se genera un nuevo código corto de un solo uso.
4. El aparato encuentra el nodo o recibe su IP y canjea el código.
5. El nodo entrega una credencial diferente de la de `tpv1`.

Revocar `tpv2` no debe desconectar `tpv1`. Cada aparato tiene identidad, configuración y registro de actividad propios.

### 4.7 Entrada de trabajadores dentro del TPV

Una vez vinculado el dispositivo:

1. El TPV muestra la lista de operarios disponibles para el local.
2. El trabajador se identifica con PIN, pulsera o el mecanismo decidido.
3. Su perfil determina qué puede hacer.
4. Sus ventas y acciones quedan atribuidas a su identidad.
5. Al bloquear o cambiar de trabajador no se pierde la cuenta abierta.

La cuenta del trabajador no conecta técnicamente el dispositivo al nodo. Solo identifica a la persona que está operando en ese momento.

Para acciones especialmente sensibles puede pedirse una reautorización, por ejemplo:

- Anular una venta.
- Aplicar un descuento superior al permitido.
- Abrir el cajón sin cobro.
- Cerrar jornada o caja.
- Cambiar configuración técnica.

## 5. Mejoras funcionales recomendadas

### 5.1 Un código por nodo/local, no un código eterno por empresa

Una cadena con tres locales necesita tres nodos y tres altas controlables. El contrato comercial pertenece a la empresa; la activación técnica debe pertenecer al local/nodo.

### 5.2 Invitación del propietario en vez de contraseña entregada

Evita enviar contraseñas por email, WhatsApp o papel. La verificación del email y la creación de contraseña ocurren en el mismo primer acceso.

### 5.3 Autodescubrimiento con alternativa manual

La experiencia ideal es «Nodo encontrado: Gluuh La Alameda». La IP manual debe mantenerse como recuperación cuando mDNS o la red no funcionen.

### 5.4 Emparejado universal

El mismo mecanismo debe servir para TPV, KDS, comandera, kiosko, pantalla y visor. Cambian el módulo y los permisos, no el sistema de identidad.

### 5.5 Sin cuentas técnicas predeterminadas

No sembrar `tecnico/1212`, `admin/1111` ni contraseñas iguales para todos los clientes. El soporte de Gluuh debería usar una sesión temporal, revocable, autorizada por el cliente y registrada en auditoría.

### 5.6 Recuperación diseñada desde el principio

Debe haber procedimientos distintos para:

- Reinstalar un terminal conservando su identidad.
- Sustituir un terminal robado o averiado.
- Reinstalar el nodo sin borrar la base existente.
- Sustituir físicamente el nodo por otro.
- Cambiar la red o IP del local.
- Trabajar temporalmente si no hay internet durante la recuperación.

### 5.7 Estado visible y comprensible

Desde `admin.gluuh.com` y el panel del cliente debería verse:

- Nodo conectado/desconectado y última señal.
- Versión instalada.
- Local y módulos asignados.
- Terminales vinculados y revocados.
- Última sincronización correcta.
- Última copia de seguridad.
- Instalación pendiente, completada o con error.

## 6. Reglas que deben quedar como invariantes

1. La cuenta personal del propietario nunca se instala como secreto del nodo.
2. La clave global `service_role` nunca sale al ordenador del cliente.
3. El código de instalación no vuelve a funcionar después del canje.
4. Un nodo solo puede actuar para su empresa y local.
5. Un dispositivo solo puede actuar con su identidad y módulos.
6. Un operario no puede convertirse en propietario por faltar datos o perfil.
7. Revocar un dispositivo no afecta a los demás.
8. Reinstalar no puede borrar ventas, facturas ni la cadena fiscal sin confirmación y procedimiento extraordinario.
9. El nodo debe cobrar y facturar sin internet después del provisionado inicial.
10. Toda acción administrativa o de soporte debe quedar atribuida y auditada.

## 7. Preguntas pendientes para cerrar el diseño

Las preguntas se responderán por bloques. No se implementará el flujo hasta cerrar al menos los bloques A–F.

### Bloque A — Contrato y empresa

- **A1.** ¿Una empresa puede tener varios locales desde el primer lanzamiento o inicialmente siempre tendrá uno?
- **A2.** ¿El plan se contrata por empresa, por local o con una base de empresa más suplementos por local/dispositivo?
- **A3.** ¿La forma de pago de la suscripción se registra solamente como dato administrativo o quieres cobro automático desde el principio?
- **A4.** ¿La Plantilla Base se clona siempre o debe poder elegirse otra plantilla por tipo de negocio?
- **A5.** ¿Qué datos mínimos deben estar completos antes de permitir generar el instalador?

### Bloque B — Propietario y backoffice

- **B1.** ¿Prefieres enviar una contraseña temporal generada o una invitación para que el propietario cree su contraseña?
- **B2.** ¿El propietario debe verificar el email antes de que pueda instalarse el nodo?
- **B3.** ¿Puede haber más de un propietario con acceso remoto?
- **B4.** ¿El propietario entra siempre con email o quieres permitir también un nombre de usuario?
- **B5.** ¿Quieres que la passkey o segundo factor sea opcional u obligatorio para propietarios?

### Bloque C — Código de instalación

- **C1.** ¿El código largo autoriza una empresa completa o una instalación concreta de un local?
- **C2.** ¿Debe caducar si no se usa? ¿En cuánto tiempo?
- **C3.** Si el instalador falla después de canjearlo, ¿debe poder reanudarse con el mismo código durante una ventana corta?
- **C4.** ¿Quién puede emitir un código de recuperación: solo Gluuh o también el propietario?
- **C5.** ¿El código se entrega al técnico, al propietario o a ambos?
- **C6.** ¿Quieres generar un instalador personalizado por empresa o un único instalador universal que pide el código?

### Bloque D — Nodo y local

- **D1.** ¿Habrá siempre un nodo por local?
- **D2.** ¿El nodo puede vivir en el TPV principal o prefieres mini-PC dedicado como instalación recomendada?
- **D3.** ¿Qué nombre verá el cliente: `Servidor Gluuh`, `Nodo`, `Central del local` u otro?
- **D4.** ¿Debe existir funcionamiento provisional en nube si el nodo está averiado?
- **D5.** ¿Quién puede sustituir o reinstalar un nodo?
- **D6.** ¿Cuánto tiempo puede permanecer un nodo sin conectarse a la nube antes de avisar o limitar algo?

### Bloque E — Terminales y pantallas

- **E1.** ¿Confirmamos IP/autodescubrimiento + código de un solo uso, o quieres mantener usuario y contraseña permanente para `tpv1`?
- **E2.** ¿El primer `tpv1` se crea automáticamente al instalar el nodo o lo crea el instalador desde un asistente?
- **E3.** ¿Quién puede crear `tpv2` y otros aparatos: Gluuh, propietario y encargado, o solo algunos?
- **E4.** ¿El terminal queda vinculado para siempre hasta revocarlo o debe renovar su credencial periódicamente?
- **E5.** ¿Al reinstalar `tpv1` debe conservar caja, impresoras y nombre?
- **E6.** ¿Los móviles personales de camareros se emparejan como dispositivos o basta con iniciar sesión como trabajador?

### Bloque F — Trabajadores y operación diaria

- **F1.** ¿Cómo entra un trabajador al TPV: selección + PIN, usuario + PIN, pulsera o combinación configurable?
- **F2.** ¿El PIN identifica al trabajador en todo el local o puede repetirse entre trabajadores?
- **F3.** ¿Cuándo debe bloquearse el TPV: después de cobrar, por inactividad, al cambiar de mesa o solo manualmente?
- **F4.** ¿El propietario usa también PIN dentro del TPV aunque su acceso remoto sea email/contraseña?
- **F5.** ¿Qué acciones deben pedir autorización de encargado aunque el trabajador ya esté identificado?
- **F6.** ¿Se permitirá un modo rápido sin identificación individual en negocios pequeños?

### Bloque G — Soporte, recuperación y baja

- **G1.** ¿Gluuh podrá entrar remotamente para soporte? ¿Siempre con consentimiento temporal del cliente?
- **G2.** ¿Qué datos y acciones debe registrar el log de soporte?
- **G3.** ¿Qué sucede al terminar la suscripción: solo se bloquean módulos, se pasa a solo lectura o se detiene la venta?
- **G4.** ¿Qué exportación recibe el cliente si da de baja Gluuh?
- **G5.** ¿Quién puede revocar un nodo o terminal perdido?
- **G6.** ¿Qué procedimiento quieres para un negocio que pierde simultáneamente nodo e internet?

## 8. Decisiones que sustituyen documentación anterior si se aprueban

Este borrador cuestiona expresamente dos decisiones antiguas:

1. Usar el mismo código de instalación en todos los equipos. La propuesta nueva lo reserva para el nodo y usa emparejado por dispositivo para el resto.
2. Sembrar usuarios técnicos y contraseñas predeterminadas. La propuesta nueva usa invitación del propietario y soporte temporal auditado.

Hasta que el propietario responda las preguntas, los documentos anteriores siguen describiendo el comportamiento existente; este fichero representa el diseño candidato.

## 9. Siguiente paso de diseño

Responder primero B1, C1–C3 y E1. Esas decisiones determinan el resto del modelo de seguridad y la experiencia del instalador. Después se actualizarán los documentos maestros 14, 15 y 17 y, solo con aprobación expresa, se preparará el plan técnico de implementación.
