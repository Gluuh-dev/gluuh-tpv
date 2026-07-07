"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, ExternalLink, PanelLeftClose, PanelLeft, Monitor, ShieldAlert, ChevronRight } from "lucide-react";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import { useUI } from "../lib/ui-store";
import { NAV, puede, type NavEntry, type NavLink, type Rol } from "../lib/nav";
import { permite, permisoZona, type MapaPermisos } from "../lib/permisos";
import { modulosInactivos } from "../lib/modulos";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AssistantPanel } from "@/components/assistant-panel";
import { CommandPalette } from "@/components/command-palette";

interface SessionInfo { empresa: string; email: string; nombre: string; rol: Rol; permisos: MapaPermisos }

// Iniciales para el avatar (nombre o email).
const iniciales = (s: string) => s.trim().split(/[\s@.]+/).map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase() || "?";

export default function PanelLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [entrada, setEntrada] = useState("inicio");
  const [modulosOff, setModulosOff] = useState<Set<string>>(new Set());
  const { railOpen, menuOpen, toggleRail, toggleMenu, setMenuOpen } = useUI();

  useEffect(() => {
    modulosInactivos().then(setModulosOff).catch(() => setModulosOff(new Set()));
  }, []);

  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      const { data: t } = await sb.from("tenant").select("nombre").limit(1).maybeSingle();
      // En vivo: el usuario hereda los permisos de su perfil (perfil_id); sin
      // perfil = acceso completo. Editar el perfil se refleja al recargar.
      const { data: u } = await sb.from("app_user").select("nombre,rol,perfil(permisos)").eq("auth_user_id", session.user.id).maybeSingle();
      const perfilRel = (u as { perfil?: { permisos?: MapaPermisos } | null } | null)?.perfil;
      setInfo({ empresa: t?.nombre ?? "Mi empresa", email: session.user.email ?? "", nombre: u?.nombre ?? "", rol: (u?.rol as Rol) ?? "PROPIETARIO", permisos: perfilRel?.permisos ?? {} });
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    const e = NAV.find((n) => n.index === pathname || n.sections.some((sec) => sec.items.some((i) => i.href === pathname)));
    if (e) setEntrada(e.id);
  }, [pathname]);

  const nav = useMemo(() => {
    const rol = info?.rol ?? "PROPIETARIO";
    const permisos = info?.permisos ?? {};
    return NAV
      // El perfil puede ocultar zonas del menú (permiso panel.<id>); Inicio y Ayuda
      // siempre visibles y el PROPIETARIO lo ve todo (para no autobloquearse).
      .filter((e) => rol === "PROPIETARIO" || e.id === "inicio" || e.id === "ayuda" || permite(permisos, permisoZona(e.id)))
      .map((e) => ({
        ...e,
        sections: e.sections
          .map((sec) => ({
            ...sec,
            items: sec.items.filter((i) => puede(rol, i.roles) && !(i.modulo && modulosOff.has(i.modulo)) && (rol === "PROPIETARIO" || !i.perm || permite(permisos, i.perm))),
          }))
          .filter((sec) => sec.items.length > 0),
      })).filter((e) => e.sections.length > 0);
  }, [info?.rol, info?.permisos, modulosOff]);

  const activa = nav.find((e) => e.id === entrada) ?? nav[0];

  // Guardián de ruta: bloquea el acceso DIRECTO (por URL) a una página cuyo
  // permiso no concede el perfil — no basta con ocultarla del menú. Busca el item
  // de menú de mejor prefijo para la ruta actual y comprueba su zona (panel.<id>)
  // y su `perm`. PROPIETARIO nunca se bloquea; páginas fuera del menú no se tocan.
  const denegado = useMemo(() => {
    const rol = info?.rol;
    const permisos = info?.permisos ?? {};
    if (!info || rol === "PROPIETARIO") return false;
    let entry: NavEntry | null = null;
    let item: NavLink | null = null;
    let bestLen = -1;
    for (const e of NAV) for (const sec of e.sections) for (const i of sec.items) {
      if (i.href && (i.href === pathname || pathname.startsWith(`${i.href}/`)) && i.href.length > bestLen) {
        entry = e; item = i; bestLen = i.href.length;
      }
    }
    if (!entry) entry = NAV.find((e) => e.index === pathname) ?? null;
    if (!entry) return false;
    const zonaOk = entry.id === "inicio" || entry.id === "ayuda" || permite(permisos, permisoZona(entry.id));
    const itemOk = !item?.perm || permite(permisos, item.perm);
    return !(zonaOk && itemOk);
  }, [pathname, info]);

  // Migas de ruta para la cabecera (en toda página): entrada › lista › [detalle].
  const migas = useMemo(() => {
    const crumbs: { label: string; href?: string }[] = [];
    if (activa) crumbs.push({ label: activa.title, href: activa.index });
    let item: NavLink | null = null;
    let bestLen = -1;
    for (const e of NAV) for (const sec of e.sections) for (const i of sec.items) {
      if (i.href && (i.href === pathname || pathname.startsWith(`${i.href}/`)) && i.href.length > bestLen) { item = i; bestLen = i.href.length; }
    }
    if (item?.href) {
      crumbs.push({ label: item.label, href: item.href });
      if (pathname !== item.href) {
        const seg = pathname.slice(item.href.length + 1).split("/")[0];
        crumbs.push({ label: seg === "nuevo" ? "Nuevo" : "Editar" });
      }
    }
    return crumbs;
  }, [pathname, activa]);

  async function salir() { await supabaseBrowser().auth.signOut(); router.replace("/login"); }
  function abrirEntrada(e: NavEntry) {
    setEntrada(e.id);
    if (!e.direct) setMenuOpen(true);
    if (e.index) router.push(e.index);
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-background text-(--text-muted)">Cargando…</div>;

  const verSubmenu = menuOpen && activa && !activa.direct;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Menú principal (rail): w-60 expandido · w-12 colapsado */}
      <nav className={`flex shrink-0 flex-col gap-0.5 border-r border-border bg-surface py-2 transition-all duration-300 ${railOpen ? "w-60 px-2" : "w-12 items-center"}`}>
        <div className={`mb-1 flex h-11 items-center gap-2 ${railOpen ? "px-1.5" : "justify-center"}`}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand text-[15px] font-bold text-brand-foreground">G</div>
          {railOpen && <span className="text-[15px] font-semibold">Gluuh <span className="text-(--text-muted)">TPV</span></span>}
        </div>
        {nav.map((e) => {
          const Icon = e.icon;
          const act = e.id === activa?.id;
          return (
            <button key={e.id} onClick={() => abrirEntrada(e)} title={e.title}
              className={`flex h-9 items-center gap-2.5 rounded-md text-[13px] transition-colors ${railOpen ? "px-2.5" : "w-8 justify-center"} ${act ? "bg-surface-muted text-foreground" : "text-(--text-secondary) hover:bg-surface-overlay hover:text-foreground"}`}>
              <Icon className="h-4 w-4 shrink-0" />{railOpen && <span className="font-medium">{e.title}</span>}
            </button>
          );
        })}
        {/* Acciones inferiores: Ir al TPV · Contraer · usuario (avatar) + salir */}
        <div className="mt-auto flex flex-col gap-0.5">
          <a href="/tpv" title="Abrir la pantalla de venta"
            className={`flex h-9 items-center gap-2.5 rounded-md bg-brand text-[13px] font-medium text-brand-foreground transition-colors hover:bg-brand-hover ${railOpen ? "px-2.5" : "w-8 justify-center"}`}>
            <Monitor className="h-4 w-4 shrink-0" />{railOpen && <span>Ir al TPV</span>}
          </a>
          <button onClick={toggleRail} title={railOpen ? "Contraer" : "Expandir"}
            className={`flex h-9 items-center gap-2.5 rounded-md text-[13px] text-(--text-muted) transition-colors hover:bg-surface-overlay hover:text-foreground ${railOpen ? "px-2.5" : "w-8 justify-center"}`}>
            {railOpen ? <PanelLeftClose className="h-4 w-4 shrink-0" /> : <PanelLeft className="h-4 w-4 shrink-0" />}{railOpen && <span>Contraer</span>}
          </button>
          <div className={`mt-1 flex items-center gap-2 border-t border-border pt-2 ${railOpen ? "" : "flex-col"}`}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-surface-muted text-[12px] font-semibold text-foreground" title={info?.nombre || info?.email}>
              {iniciales(info?.nombre || info?.email || "")}
            </span>
            {railOpen && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium text-foreground">{info?.nombre || info?.email}</div>
                <div className="truncate text-[11px] capitalize text-(--text-muted)">{info?.rol?.toLowerCase()}</div>
              </div>
            )}
            <button onClick={salir} title="Cerrar sesión" aria-label="Cerrar sesión"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-(--text-muted) transition-colors hover:bg-surface-overlay hover:text-foreground">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Submenú al lado (w-56) */}
      {verSubmenu && (
        <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface md:flex">
          <div className="flex h-11 items-center border-b border-border px-3 text-[15px] font-semibold">{activa.title}</div>
          <div className="flex-1 space-y-3 overflow-y-auto px-2 py-2">
            {activa.sections.map((sec, si) => (
              <div key={si} className="space-y-0.5">
                {sec.title && <div className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-(--text-muted)">{sec.title}</div>}
                {sec.items.map((i, ii) => {
                  if (!i.href) return (
                    <div key={ii} className="flex h-8 items-center justify-between rounded-md px-2.5 text-[13px] text-(--text-muted) opacity-50" title="Próximamente">
                      {i.label}<span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px]">pronto</span>
                    </div>
                  );
                  const cls = `flex h-8 items-center justify-between rounded-md px-2.5 text-[13px] transition-colors ${pathname === i.href ? "bg-surface-muted font-medium text-foreground" : "text-(--text-secondary) hover:bg-surface-overlay hover:text-foreground"}`;
                  return i.blank
                    ? <a key={ii} href={i.href} target="_blank" rel="noreferrer" className={cls}>{i.label}<ExternalLink className="h-3.5 w-3.5 opacity-50" /></a>
                    : <Link key={ii} href={i.href} className={cls}>{i.label}</Link>;
                })}
              </div>
            ))}
          </div>
          <div className="border-t border-border p-2.5 text-[11px] text-(--text-muted)">
            <div className="truncate font-medium text-foreground">{info?.empresa}</div>
            <div className="capitalize">{info?.rol?.toLowerCase()}</div>
          </div>
        </aside>
      )}

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-surface px-3">
          <div className="flex min-w-0 items-center gap-1.5">
            {!activa?.direct && (
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} onClick={toggleMenu}>
                {menuOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
              </Button>
            )}
            <nav aria-label="Ruta" className="flex min-w-0 items-center gap-1 text-[13px]">
              {migas.map((m, i) => {
                const last = i === migas.length - 1;
                return (
                  <span key={`${m.label}-${i}`} className="flex min-w-0 items-center gap-1">
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-(--text-muted)" aria-hidden />}
                    {m.href && !last
                      ? <Link href={m.href} className="truncate text-(--text-secondary) transition-colors hover:text-foreground">{m.label}</Link>
                      : <span className={`truncate ${last ? "font-semibold text-foreground" : "text-(--text-secondary)"}`}>{m.label}</span>}
                  </span>
                );
              })}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-[13px]">
            <CommandPalette />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-5">
          {denegado ? (
            <div className="grid h-full place-items-center">
              <div className="max-w-sm rounded-lg border border-border bg-surface p-6 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface-muted">
                  <ShieldAlert className="h-5 w-5 text-(--text-muted)" aria-hidden />
                </div>
                <h1 className="mt-3 text-[16px] font-semibold">Sin acceso</h1>
                <p className="mt-1 text-[12.5px] text-(--text-secondary)">Tu perfil no tiene permiso para esta página. Si crees que es un error, habla con el administrador.</p>
              </div>
            </div>
          ) : children}
        </main>
      </div>
      <AssistantPanel />
    </div>
  );
}
