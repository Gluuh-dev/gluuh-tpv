# Estado — el tablero compartido

Esta carpeta existe para **trabajar desde dos sitios a la vez** (la sesión de Claude Code en
el escritorio y la del chat) sin pisarse y sin repetir errores ya pagados.

## Los dos ficheros

| | |
|---|---|
| **[AHORA.md](AHORA.md)** | **Empieza aquí.** Qué funciona, qué está a medias, qué sigue, y qué está esperándote a ti. Se **reescribe**. |
| **[TRAMPAS.md](TRAMPAS.md)** | Los fallos que ya nos comimos, y que **no dan error**. Se **añade**, no se borra. |

Si eres una sesión nueva y no tienes contexto: lee esos dos. Con eso puedes trabajar.

## Cómo se trabaja en paralelo

**1. Antes de tocar nada, lee `AHORA.md`.** Y mira la sección *En marcha*: si la otra sesión
tiene cogidos unos ficheros, no los toques. Coge otra cosa.

**2. Apúntate en *En marcha* ANTES de empezar**, con los ficheros que vas a tocar. Y quítate
al terminar. Es lo único que evita que dos sesiones reescriban lo mismo.

**3. Los números de migración se RESERVAN.**
Si escribes `supabase/migrations/0105_*.sql` sin avisar y la otra sesión hace lo mismo, git
mezcla las dos y acabas con **dos migraciones 0105** aplicándose en un orden que nadie
decidió. Coge el número de *Siguiente migración libre* en `AHORA.md`, **súbelo ahí primero**,
y luego escribe el fichero.

**4. Al terminar algo, actualiza `AHORA.md`** (mueve la línea de *En marcha* a *Funciona*, con
la prueba que lo demuestra) y **haz push**. Si no está en el remoto, para la otra sesión no
existe.

**5. Si encuentras un fallo que no daba error, apúntalo en `TRAMPAS.md`.** Ese fichero es el
que más caro ha salido de todo el repositorio.

## Lo que no se rompe, pase lo que pase

- **⚠️ ESTE REPOSITORIO ES PÚBLICO.** Cualquiera lo lee. **Ni una contraseña, ni una clave
  secreta, ni un token — en ningún fichero, ni siquiera en un comentario o en un ejemplo.**
  *(Casi se cuela una: una contraseña de Supabase, escrita en `AHORA.md` "para no olvidarla".
  Si se hubiera subido, habría quedado en el historial de git para siempre — borrar el
  fichero después no la borra.)*
  Los secretos van en `.env.local` (que está en `.gitignore`); en el repo sólo `.env.example`.
- **REGLA Nº1 — bases de datos.** Sólo el Supabase del proyecto (`gxcqihslbicrszgzudjs`) y el
  Postgres del nodo (`.nodo/pgdata`, puerto **55432**, base `gluuh`). Ninguna otra, **ni para
  probar**. Está en `CLAUDE.md` y manda sobre todo lo demás.
- **La nube se migra ANTES que los nodos.** Ya nos ha mordido: un nodo por delante de la nube
  **deja de subir las ventas del bar**.
- **El test del vector oficial de la AEAT** (`packages/core/src/fiscal/verifactu.test.ts`) es
  innegociable. Si se rompe, se para todo.
- **Español.** Código, comentarios y documentación.

## Dónde está lo demás

Esta carpeta es el **tablero vivo**. Lo que no cambia cada día vive en otro sitio:

| | |
|---|---|
| `docs/plan/` | las **decisiones** (por qué las cosas son como son). La 11 son las 11 decisiones del nodo. |
| `docs/implementacion/` | las **guías ejecutables** (17 = manual del nodo, 18 = endurecerlo). |
| `docs/sesiones/` | el **relato** de cada día. Histórico, no se toca. |
| `supabase/nodo/README.md` | las tripas del nodo y todas sus trampas, con el porqué. |
| `apps/nodo/pruebas/README.md` | qué demuestra cada prueba. |
