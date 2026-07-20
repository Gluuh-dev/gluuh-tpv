import { useMemo, useState } from "react";
import { Search, Star, X, Lock } from "lucide-react";
import { CATALOGO, disponibles, totalInformes, leerFavoritos, guardarFavoritos, type Informe, type SeccionInforme } from "./informes";

// CATÁLOGO DE INFORMES, al estilo del de Ágora: columnas por grupo, estrella para
// marcar favoritos y un buscador arriba. Los que aún no podemos servir salen
// ATENUADOS y con candado, diciendo qué les falta — un informe que abre una
// pantalla vacía hace desconfiar también de los que sí funcionan.

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function FilaInforme({
  inf, fav, onFav, onAbrir,
}: Readonly<{ inf: Informe; fav: boolean; onFav: () => void; onAbrir: () => void }>) {
  const listo = !!inf.va;
  return (
    <div className={`flex items-center gap-2 border-b border-line px-2.5 py-2 last:border-b-0 ${listo ? "" : "opacity-45"}`}>
      <button type="button" onClick={onFav} aria-label={fav ? `Quitar ${inf.nombre} de favoritos` : `Marcar ${inf.nombre} como favorito`}
        aria-pressed={fav}
        className="flex-none rounded p-0.5 transition-transform active:scale-90">
        <Star size={15} className={fav ? "fill-amber text-amber" : "text-muted"} />
      </button>

      <button type="button" onClick={onAbrir} disabled={!listo} title={inf.falta}
        className="min-w-0 flex-1 truncate text-left text-[12.5px] text-paper transition-transform disabled:cursor-not-allowed active:enabled:scale-[.99]">
        {inf.nombre}
      </button>

      {!listo && <Lock size={12} className="flex-none text-muted" aria-label="Pendiente" />}
    </div>
  );
}

export function CatalogoInformes({ onAbrir }: Readonly<{ onAbrir: (s: SeccionInforme) => void }>) {
  const [busq, setBusq] = useState("");
  const [favs, setFavs] = useState<string[]>(leerFavoritos);

  const alternarFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
    setFavs(next);
    guardarFavoritos(next);
  };

  const q = sinAcentos(busq.trim());
  const grupos = useMemo(
    () => CATALOGO
      .map((g) => ({ ...g, informes: g.informes.filter((i) => !q || sinAcentos(i.nombre).includes(q)) }))
      .filter((g) => g.informes.length),
    [q],
  );
  const favoritos = useMemo(
    () => CATALOGO.flatMap((g) => g.informes).filter((i) => favs.includes(i.id) && (!q || sinAcentos(i.nombre).includes(q))),
    [favs, q],
  );

  return (
    <div className="space-y-3 p-4">
      {/* Buscador + recuento honesto */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-0 flex-1 items-center sm:max-w-sm">
          <Search size={14} className="absolute left-2.5 text-muted" />
          <input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar informe…"
            aria-label="Buscar informe"
            className="h-9 w-full rounded-md border border-line bg-paper/5 pl-8 pr-8 text-[12.5px] text-paper outline-none placeholder:text-muted focus:border-brand" />
          {busq && (
            <button type="button" onClick={() => setBusq("")} aria-label="Limpiar"
              className="absolute right-2 text-muted transition-transform active:scale-90"><X size={14} /></button>
          )}
        </label>
        <span className="ml-auto text-[11.5px] text-muted">
          <b className="text-paper">{disponibles}</b> de {totalInformes} disponibles
        </span>
      </div>

      {favoritos.length > 0 && (
        <section className="rounded-lg border border-line">
          <h3 className="flex items-center gap-1.5 border-b border-line px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted">
            <Star size={12} className="fill-amber text-amber" /> Favoritos
          </h3>
          <div className="grid gap-x-4 sm:grid-cols-2 xl:grid-cols-4">
            {favoritos.map((i) => (
              <FilaInforme key={`f-${i.id}`} inf={i} fav onFav={() => alternarFav(i.id)}
                onAbrir={() => i.va && onAbrir(i.va)} />
            ))}
          </div>
        </section>
      )}

      {grupos.length === 0 && (
        <p className="py-10 text-center text-[12.5px] text-muted">Ningún informe se llama así.</p>
      )}

      {/* Columnas por grupo, como Ágora */}
      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {grupos.map((g) => (
          <section key={g.titulo} className="rounded-lg border border-line">
            <h3 className="border-b border-line px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted">{g.titulo}</h3>
            {g.informes.map((i) => (
              <FilaInforme key={i.id} inf={i} fav={favs.includes(i.id)} onFav={() => alternarFav(i.id)}
                onAbrir={() => i.va && onAbrir(i.va)} />
            ))}
          </section>
        ))}
      </div>

      <p className="pt-1 text-[11.5px] leading-relaxed text-muted">
        Los informes atenuados necesitan datos o un módulo que todavía no está activo; al
        pasar por encima se ve qué falta. Marca con la estrella los que uses a diario.
      </p>
    </div>
  );
}
