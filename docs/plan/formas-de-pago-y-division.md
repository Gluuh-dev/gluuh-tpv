# Formas de pago y división de cuentas — cómo gestionarlo en el TPV

> Documento de diseño para decidir **cómo gestionar los tipos de pago** (una
> cuenta con varias formas) y la **división de cuentas** en la SPA `apps/tpv`.
> Sale del inventario del 19-07-2026. La nube ya tiene casi todo resuelto; la SPA
> es hoy demo. Aquí está lo que hay, las opciones y **las decisiones abiertas**.

## En una frase

Pagar una cuenta con **varias formas** (efectivo + tarjeta + bizum) y **dividirla**
(a partes iguales, por importe o por productos) **ya está construido y probado en
el TPV Next y en la nube**. Lo que falta es **cablearlo en la SPA** y decidir un
puñado de reglas de producto (límites, redondeos, IVA por persona).

---

## 1. Estado: qué existe hoy

| Capa | Pago múltiple | Formas configurables | División |
|---|---|---|---|
| **Nube** (Supabase) | `payment` + RPC `cobrar_cuenta` (atómica) | tabla `payment_method` + semilla `0106` | `cuenta_parte` (0123) + `separar_cuenta` (0124) |
| **TPV Next** (`app/tpv`) | ✅ hasta 3 formas, propina, descuento, cambio | ✅ lee `payment_method` | ✅ los 3 modos, con reaparición en la mesa |
| **SPA** (`apps/tpv`) | ⚠️ UI portada, **no persiste** | ❌ **4 formas a fuego** | ⚠️ modal en construcción (`DividirCuenta*`) |

**Importante**: en el Next la fiscalidad está **apagada a propósito**
(`VERIFACTU_ACTIVO = false`); hoy los pagos se insertan directos en `payment` y
las RPC atómicas (`cobrar_cuenta`, `emitir_factura_fiscal`) **existen pero aún no
se llaman**. Activarlas es "lo último antes de vender".

---

## 2. Pago múltiple (varias formas en una cuenta)

**Modelo** (idéntico en Next y SPA): una lista de pagos `{ formaPagoId, importe }`,
tope **3** (`MAX_PAGOS`). Se calcula:

```
importeACobrar = total + propina − descuento
pagado         = Σ importes
falta          = importeACobrar − pagado
aDevolver      = pagado − importeACobrar        (cambio, solo efectivo)
puedeCobrar    = pagado ≥ importeACobrar − 0.005
```

Reglas ya codificadas:
- Tocar una forma sin teclear nada → aplica **lo que falta**.
- La **tarjeta se limita a lo que falta** (no da cambio); el efectivo sí (vuelta).
- El **descuento** se limita al total; la **propina** no tiene tope.
- **Efectivo rápido**: botón "Exacto" + billetes sugeridos, con desglose del cambio.
- Al persistir (Next): una fila en `payment` **por forma**, cada una con su
  `client_id` (idempotencia). La propina va **restada del primer importe** para no
  contarla dos veces. Abre cajón si alguna forma tiene `abre_cajon`.

**El camino atómico** (para cuando se cablee): `cobrar_cuenta(order, pagos,
operario, client_id)` valida **Σ(pagos) == total** al céntimo, con candado
`FOR UPDATE` (dos terminales no cobran dos veces) e idempotencia por `client_id`.
Hoy el Next **no la usa** (insert directo); la SPA tampoco persiste.

---

## 3. Formas de pago configurables

**Tabla `payment_method`**: `nombre, tipo (EFECTIVO/TARJETA/BIZUM/VALE/OTRO),
activo, orden, abre_cajon, cuenta_arqueo`. Semilla mínima al crear empresa
(`0106`): Efectivo (abre cajón), Tarjeta, Bizum. Se gestionan en el panel
(`(panel)/formas-pago`).

- **Next**: las **lee** de `payment_method` (con un fallback Contado+Tarjeta si la
  tabla viniera vacía). Cada forma sabe si abre cajón y si cuenta en el arqueo.
- **SPA**: hoy **hardcodea** 4 (Contado / Tarjeta / Bizum / Pago QR) en
  `CobrarModal.tsx`. **Primer cableado pendiente**: leer `payment_method` del nodo.

---

## 4. División de cuentas — los 3 modos

Regla de oro: **`Σ(cobrado) + pendiente = total`** siempre. Se divide **el
pendiente**, no el total. Persiste en `cuenta_parte` (una fila por parte), que
**reaparece al volver a la mesa** (el plano resta lo ya cobrado y la mesa queda
`POR_COBRAR` con solo lo que falta).

| Modo | Qué hace | Cómo se cobra | Documento |
|---|---|---|---|
| **A partes iguales** (`IGUAL`) | Reparte el pendiente entre N (céntimos exactos) | Pago **parcial** por parte | Justificante (no fiscal) + **1 factura del remanente** al cerrar |
| **Por importe** (`IMPORTE`) | El cliente paga una cantidad; el resto queda pendiente | Pago **parcial** | Igual que `IGUAL` |
| **Por productos** (`PRODUCTOS`) | Saca líneas concretas a un **sub-pedido** (`separar_cuenta`, atómico) que **sale de la mesa** | Cobro completo del sub-pedido | **Factura propia** de esa parte |

Decisión ya tomada (17-07, `docs/plan/dividir-cuenta-y-ciclo.md`): **PRODUCTOS** =
factura propia que sale de la mesa; **IGUAL/IMPORTE** = pago parcial con
justificante y **una sola factura íntegra del remanente** al final. La pestaña
"Por productos" se **bloquea** si ya hay partes de dinero cobradas (no se mezclan).

Cierre: cuando el pendiente baja de ~0.009 €, se emite la factura del remanente
(los `payment` ya están), la mesa pasa a `LIBRE` y se vuelve al plano.

---

## 5. Qué falta cablear en la SPA (por orden sugerido)

1. **Formas de pago reales**: leer `payment_method` del nodo en vez de las 4 fijas
   (con los flags `abre_cajon`/`cuenta_arqueo`). Cambio pequeño y de valor alto.
2. **Persistir el cobro**: hoy `cobrar()` solo hace un toast. Escribir `payment`
   (o llamar `cobrar_cuenta` cuando se decida el camino atómico).
3. **División**: terminar `DividirCuenta*` (en construcción) y cablear los 3 modos
   contra `cuenta_parte` / `separar_cuenta`, con reaparición en la mesa.
4. **Migrar a las RPC atómicas** (`cobrar_cuenta` / `emitir_factura_fiscal`) al
   activar la fiscalidad — requiere extender `cobrar_cuenta` con **modo parcial**
   (`p_cerrar`), porque hoy exige `Σ==total` y por eso la división no la usa.

---

## 6. Decisiones de producto abiertas (a resolver antes de cablear)

1. **Límite de formas por cuenta**: hoy 3 fijo (heredado del mockup). ¿Se sube?
   ¿Configurable? Por qué 3.
2. **Propina**: ¿se redondea? ¿entra en el arqueo y/o en la base imponible? Hoy va
   por pago, sin redondeo, restada del primer importe.
3. **IVA en división por importe/iguales**: hoy **no se prorratea** el desglose
   fiscal — `PRODUCTOS` da base/cuota limpia (factura propia); `IGUAL`/`IMPORTE`
   se cobran con justificante no fiscal + factura íntegra al final. ¿Basta, o hace
   falta desglose fiscal por persona?
4. **Descuento global**: se refleja en lo cobrado pero **no se prorratea** en el
   desglose fiscal (marcado `ponytail` en el Next). A resolver antes de VERIFACTU.
5. **Reconciliación con el cliente delante**: si un cobro parcial falla, la parte
   sigue pendiente y la mesa queda `POR_COBRAR`. Falta definir el UX de "se cayó el
   pago de Ana, reintenta".
6. **Nexo cobro↔arqueo**: `cuenta_arqueo` es hoy solo un flag de clasificación; **no
   hay asiento automático** en `cash_move`. ¿Se genera al cobrar, o se calcula por
   consulta de `payment`?
7. **Tolerancias**: cierre `≤ 0.009 €` y "puede cobrar" a `−0.005 €` están como
   constantes sueltas; conviene fijarlas como regla explícita de negocio.

---

## Referencias

- División (modelo y flujo): `docs/plan/dividir-cuenta-y-ciclo.md`,
  `docs/plan/dividir-cuenta-flujo-ux.md`.
- Cobro atómico: migraciones `0118` (fiscal) y `0119` (`cobrar_cuenta`).
- División: migraciones `0123` (`cuenta_parte`) y `0124` (`separar_cuenta`).
- Formas de pago: `payment_method` + semilla `0106`; panel `(panel)/formas-pago`.
- SPA hoy: `apps/tpv/src/apartados/tpv/venta/CobrarModal.tsx` (3 huecos, formas a
  fuego) y `DividirCuenta*.tsx` (en construcción).
