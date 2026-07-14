import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

// ─────────────────────────────────────────────────────────────────────────────
//  FILAS GRISES MIENTRAS LLEGAN LOS DATOS.
//
//  Existe por un fallo que parecía cosmético y no lo era: **el panel mentía**.
//
//  Una página que hace `useEffect` + fetch empieza con la lista **vacía**. Y "vacía" no es
//  lo mismo que "no hay nada": mientras los datos venían de camino, el panel enseñaba
//
//      «Aún no hay empleados»          «Sin descuentos»
//      «Aún no hay tarifas»            «Sin movimientos de efectivo»
//
//  El dueño abre el panel desde casa con una 4G regular, y durante dos segundos lee que su
//  plantilla, su carta o su caja **han desaparecido**. Y llama.
//
//  Una zona en blanco se entiende. Una página que **afirma algo falso**, no. Por eso el
//  arreglo de fondo es `!loading && lista.length === 0` — y esto es lo que se pinta mientras
//  tanto, para que además no dé un salto.
//
//  (No hace falta ninguna librería para esto: `Skeleton` ya estaba en el proyecto. Lo que
//  faltaba era **acordarse de mirar si aún se está cargando**.)
// ─────────────────────────────────────────────────────────────────────────────

export function FilasCargando({ filas = 6, columnas = 4 }: { filas?: number; columnas?: number }) {
  return (
    <>
      {Array.from({ length: filas }, (_, f) => (
        <TableRow key={`cargando-${f}`}>
          {Array.from({ length: columnas }, (_, c) => (
            <TableCell key={`cargando-${f}-${c}`} className="py-3">
              {/* La primera columna, más ancha: casi siempre es el nombre. Así el esqueleto
                  se parece a lo que va a aparecer y la tabla no pega un salto. */}
              <Skeleton className={c === 0 ? "h-4 w-40" : "h-4 w-20"} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
