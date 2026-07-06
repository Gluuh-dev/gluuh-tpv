# Herramientas › Copias de Seguridad

> Backup de la base de datos: creación/descarga manual y **programación automática**. Capturas: `Crear/Descargar Copia de Seguridad` y `Configurar Copias de Seguridad`.

---

## Ágora — qué muestra

**Crear/Descargar:** botón **Iniciar copia de seguridad** + lista de **Copias Disponibles** (nombre `auto_AAMMDD_HHMMSS`, fecha, tamaño ~295 MiB) con **Descargar** / **Eliminar**.

**Configurar:** ☑ **Realizar copias automáticas** · **Nº de copias a mantener** (`2`) · **Frecuencia** (`Cada 24 horas` / `A horas específicas`).

## Qué significa para nosotros

Ágora corre con **BD local** (servidor LAN, [01](../../01-arquitectura-y-plataforma/)) → necesita su propio backup. En Gluuh la **fuente de verdad es Supabase (PostgreSQL gestionado con backups automáticos)**, así que el backup en la nube viene de serie; lo que conviene cubrir es:

- **Export/backup bajo demanda** del tenant (cumplimiento/portabilidad RGPD) — un export firmado.
- Si se despliega **servidor LAN/edge** (offline), su SQLite/Postgres local necesita rotación de copias como hace Ágora.

```sql
-- no es tabla de negocio; es operación de infraestructura
-- config: { auto: bool, retener: int, frecuencia: '24h'|horas[] }
```

🟡 Supabase cubre el backup canónico; falta export por tenant + estrategia del edge local.

## Mejoras sobre Ágora

- Backups **cifrados** y verificados (restore de prueba periódico).
- Retención por niveles (diaria/semanal/mensual), no solo "N copias".
- Export de datos del tenant a formato abierto para portabilidad (RGPD).
