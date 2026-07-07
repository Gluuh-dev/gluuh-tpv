"use client";

// Personal / empleados — patrón "tabla Ágora": lista en tabla y, al pulsar una
// fila, se abre un panel lateral (slide-over) con la edición del empleado. El
// botón "Nuevo empleado" abre el mismo panel en modo alta.
//   · alta:        RPC crear_empleado(p_nombre,p_email,p_rol,p_pin)
//   · datos/perm.: UPDATE directo sobre app_user (nombre,email,rol,activo,permisos)
//   · pulsera:     RPC asignar_pulsera(p_user_id,p_codigo)  (p_codigo="" => quita)
//   · desbloqueo:  UPDATE app_user (pin_intentos=0, pin_bloqueado_hasta=null)
//   · cambiar PIN: RPC cambiar_pin(p_user_id,p_pin)  ← ver nota más abajo.
import { useEffect, useState } from "react";
import { Check, LockOpen, UserPlus, X } from "lucide-react";
import { toast } from "@/app/lib/toast";
import { supabaseBrowser } from "../../lib/supabaseBrowser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/search-input";
import { PageHeader } from "@/components/ui/page-header";
import { type MapaPermisos } from "../../lib/permisos";

interface Permisos { modificar?: boolean; descuento?: boolean; borrar?: boolean; invitar?: boolean; cobrar?: boolean }
interface Empleado {
  id: string;
  nombre: string;
  email: string | null;
  rol: string;
  activo: boolean;
  permisos?: MapaPermisos | null;
  perfil_id?: string | null;
  pulsera_hash?: string | null;
  pin_bloqueado_hasta?: string | null;
}
interface Perfil { id: string; nombre: string; permisos?: MapaPermisos }

const ROLES = [
  { v: "CAMARERO", t: "Camarero/a" },
  { v: "COCINA", t: "Cocina" },
  { v: "ENCARGADO", t: "Encargado/a" },
];

const PERMISOS: [keyof Permisos, string][] = [
  ["modificar", "Modificar la cuenta (cantidades, precio, notas)"],
  ["descuento", "Aplicar descuentos"],
  ["borrar", "Borrar / anular cuenta"],
  ["invitar", "Invitaciones y consumo propio"],
  ["cobrar", "Cobrar"],
];

const rolTexto = (v: string) => ROLES.find((r) => r.v === v)?.t ?? v;

// Ausente/true = permitido; sólo cuenta como bloqueado un `false` explícito.
function resumenPermisos(p?: MapaPermisos | null): string {
  const activos = PERMISOS.filter(([k]) => p?.[k] !== false).length;
  return activos === PERMISOS.length ? "Todos" : `${activos} de ${PERMISOS.length}`;
}

const estaBloqueado = (e: Empleado) =>
  !!e.pin_bloqueado_hasta && new Date(e.pin_bloqueado_hasta).getTime() > Date.now();

type Borrador = { nombre: string; email: string; rol: string; activo: boolean; permisos: MapaPermisos; perfil_id: string | null };
type Editor = { modo: "alta" } | { modo: "editar"; id: string };

function Switch({ checked, onChange, label }: { checked: boolean; onChange(): void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} title={label}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${checked ? "bg-brand" : "bg-muted"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export default function Empleados() {
  const sb = supabaseBrowser();
  const [lista, setLista] = useState<Empleado[]>([]);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [busqueda, setBusqueda] = useState("");

  const [editor, setEditor] = useState<Editor | null>(null);
  const [b, setB] = useState<Borrador>({ nombre: "", email: "", rol: "CAMARERO", activo: true, permisos: {}, perfil_id: null });
  const [pin, setPin] = useState("");
  const [pulseraCodigo, setPulseraCodigo] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    const { data } = await sb
      .from("app_user")
      .select("id,nombre,email,rol,activo,permisos,perfil_id,pulsera_hash,pin_bloqueado_hasta")
      .order("nombre");
    setLista((data as Empleado[]) ?? []);
    // Perfiles = plantilla de permisos (0048). Si no está aplicada, no se muestra.
    const perf = await sb.from("perfil").select("id,nombre,permisos").order("nombre");
    setPerfiles(perf.error ? [] : ((perf.data as Perfil[]) ?? []));
  }
  useEffect(() => { void cargar(); /* eslint-disable-next-line */ }, []);

  const emp = editor?.modo === "editar" ? lista.find((e) => e.id === editor.id) ?? null : null;

  // Cerrar el panel con Escape.
  useEffect(() => {
    if (!editor) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
    // eslint-disable-next-line
  }, [editor]);

  function cerrar() { setEditor(null); }

  function abrirAlta() {
    setB({ nombre: "", email: "", rol: "CAMARERO", activo: true, permisos: {}, perfil_id: null });
    setPin(""); setPulseraCodigo("");
    setEditor({ modo: "alta" });
  }
  function abrirEditar(e: Empleado) {
    setB({ nombre: e.nombre, email: e.email ?? "", rol: e.rol, activo: e.activo, permisos: { ...(e.permisos ?? {}) }, perfil_id: e.perfil_id ?? null });
    setPin(""); setPulseraCodigo("");
    setEditor({ modo: "editar", id: e.id });
  }

  // Guardar del pie: alta => crear_empleado; edición => UPDATE de datos+permisos.
  async function guardar() {
    if (!editor) return;
    if (!b.nombre.trim()) { toast.error("El nombre es obligatorio."); return; }
    setGuardando(true);
    if (editor.modo === "alta") {
      if (pin.trim().length < 4) { toast.error("El PIN debe tener al menos 4 dígitos."); setGuardando(false); return; }
      const { error } = await sb.rpc("crear_empleado", {
        p_nombre: b.nombre.trim(), p_email: b.email.trim(), p_rol: b.rol, p_pin: pin.trim(),
      });
      setGuardando(false);
      if (error) { toast.error(error.message); return; }
      toast.success(`Empleado «${b.nombre.trim()}» creado con su PIN.`);
    } else {
      const { error } = await sb.from("app_user").update({
        nombre: b.nombre.trim(), email: b.email.trim() || null, rol: b.rol, activo: b.activo, permisos: b.permisos, perfil_id: b.perfil_id,
      }).eq("id", editor.id);
      setGuardando(false);
      if (error) { toast.error(error.message); return; }
      toast.success(`Cambios de «${b.nombre.trim()}» guardados.`);
    }
    await cargar();
    cerrar();
  }

  // El lector RFID "teclea" el código; se pasa por parámetro (no por estado)
  // para no perder el último carácter si escanea muy rápido. "" => quita.
  async function asignarPulsera(codigo: string | null) {
    if (!emp) return;
    const quitar = codigo === null || codigo.trim() === "";
    const { error } = await sb.rpc("asignar_pulsera", {
      p_user_id: emp.id, p_codigo: quitar ? "" : codigo!.trim(),
    });
    if (error) { toast.error(error.message); return; }
    toast.success(quitar ? `Pulsera quitada a ${emp.nombre}.` : `Pulsera asignada a ${emp.nombre}.`);
    setPulseraCodigo("");
    await cargar();
  }

  // El bloqueo del login por PIN es a nivel de TENANT (0054): al fallar se marca
  // en todas las filas del tenant. Para desbloquear de verdad hay que limpiar
  // todas las filas bloqueadas, no sólo la de este empleado (si no, otra fila con
  // la fecha futura seguiría bloqueando el login). La RLS acota al tenant.
  // ponytail: cerrojo por tenant; un solo UPDATE lo limpia entero.
  async function desbloquear() {
    const { error } = await sb
      .from("app_user")
      .update({ pin_intentos: 0, pin_bloqueado_hasta: null })
      .not("pin_bloqueado_hasta", "is", null);
    if (error) { toast.error(error.message); return; }
    toast.success("Login por PIN desbloqueado.");
    await cargar();
  }

  // Cambiar el PIN de un empleado ya existente. El PIN se hashea con bcrypt en el
  // servidor (crear_empleado usa crypt/gen_salt), imposible desde el navegador,
  // así que requiere una RPC dedicada. Si aún no existe, el toast mostrará el
  // error; no se escribe nada (nada que corromper).
  // ponytail: contrato cambiar_pin(p_user_id,p_pin); pendiente su migración.
  async function cambiarPin() {
    if (!emp) return;
    if (pin.trim().length < 4) { toast.error("El PIN debe tener al menos 4 dígitos."); return; }
    const { error } = await sb.rpc("cambiar_pin", { p_user_id: emp.id, p_pin: pin.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success(`PIN de ${emp.nombre} actualizado.`);
    setPin("");
  }

  const q = busqueda.trim().toLowerCase();
  const filtrada = q
    ? lista.filter((e) =>
        e.nombre.toLowerCase().includes(q) ||
        (e.email ?? "").toLowerCase().includes(q) ||
        rolTexto(e.rol).toLowerCase().includes(q))
    : lista;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Personal"
        description="Camareros, cocina y encargados con su PIN. Pulsa una fila para editar; cada acción queda registrada a su nombre."
        actions={
          <Button onClick={abrirAlta}><UserPlus aria-hidden /> Nuevo empleado</Button>
        }
      />

      {lista.length > 6 && (
        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por nombre, email o rol…"
          className="max-w-sm"
        />
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Pulsera</TableHead>
              <TableHead>Permisos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrada.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  {lista.length === 0 ? "Aún no hay empleados. Crea el primero con «Nuevo empleado»." : "Sin resultados."}
                </TableCell>
              </TableRow>
            )}
            {filtrada.map((e) => (
              <TableRow
                key={e.id}
                tabIndex={0}
                aria-label={`Editar ${e.nombre}`}
                onClick={() => abrirEditar(e)}
                onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrirEditar(e); } }}
                className="cursor-pointer focus:bg-muted/50 focus:outline-none"
              >
                <TableCell>
                  <div className="font-medium">{e.nombre}</div>
                  {e.email && <div className="text-xs text-muted-foreground">{e.email}</div>}
                </TableCell>
                <TableCell><Badge variant="secondary">{rolTexto(e.rol)}</Badge></TableCell>
                <TableCell>
                  <span className={e.activo ? "text-emerald-500" : "text-(--text-muted)"}>
                    {e.activo ? "Activo" : "Inactivo"}
                  </span>
                  {estaBloqueado(e) && (
                    <Badge className="ml-2 border-amber-500/20 bg-amber-500/15 text-amber-500">Bloqueado</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {e.pulsera_hash
                    ? <Check className="mx-auto h-4 w-4 text-emerald-500" aria-label="Con pulsera" />
                    : <span className="text-(--text-muted)" aria-label="Sin pulsera">—</span>}
                </TableCell>
                <TableCell className="text-(--text-secondary)">{resumenPermisos(e.permisos)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Panel lateral de edición / alta */}
      {editor && (editor.modo === "alta" || emp) && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={cerrar} aria-hidden="true" />
          <aside
            role="dialog" aria-modal="true"
            aria-label={editor.modo === "alta" ? "Nuevo empleado" : `Editar ${emp!.nombre}`}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background"
          >
            <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border px-3">
              <span className="flex-1 truncate text-[13px] font-semibold">
                {editor.modo === "alta" ? "Nuevo empleado" : emp!.nombre}
              </span>
              <button
                type="button" onClick={cerrar} aria-label="Cerrar" title="Cerrar"
                className="grid h-7 w-7 cursor-pointer place-items-center rounded text-foreground/80 hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              {/* Datos */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="emp-nombre">Nombre</Label>
                  <Input id="emp-nombre" value={b.nombre} onChange={(e) => setB({ ...b, nombre: e.target.value })} placeholder="Ana García" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emp-email">Email (opcional)</Label>
                  <Input id="emp-email" type="email" value={b.email} onChange={(e) => setB({ ...b, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Rol</Label>
                  <Select value={b.rol} onValueChange={(v) => setB({ ...b, rol: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r.v} value={r.v}>{r.t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {editor.modo === "alta" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="emp-pin">PIN (4+ dígitos)</Label>
                  <Input
                    id="emp-pin" required minLength={4} inputMode="numeric" value={pin}
                    onChange={(e) => setPin(e.target.value)} placeholder="1234"
                  />
                </div>
              ) : (
                <>
                  {/* Activo */}
                  <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
                    <Label className="text-[13px]">Empleado activo</Label>
                    <Switch checked={b.activo} onChange={() => setB({ ...b, activo: !b.activo })} label="Activar / desactivar empleado" />
                  </div>

                  {/* Bloqueo por intentos */}
                  {estaBloqueado(emp!) && (
                    <div className="space-y-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-3">
                      <p className="text-[12px] text-amber-600 dark:text-amber-400">
                        El login por PIN está bloqueado por intentos fallidos.
                      </p>
                      <Button variant="outline" size="sm" onClick={() => void desbloquear()}>
                        <LockOpen aria-hidden /> Desbloquear
                      </Button>
                    </div>
                  )}

                  {/* Cambiar PIN */}
                  <div className="space-y-1.5">
                    <Label htmlFor="emp-pin-nuevo">Cambiar PIN</Label>
                    <div className="flex gap-2">
                      <Input
                        id="emp-pin-nuevo" inputMode="numeric" value={pin}
                        onChange={(e) => setPin(e.target.value)} placeholder="Nuevo PIN (4+ dígitos)"
                      />
                      <Button variant="outline" disabled={pin.trim().length < 4} onClick={() => void cambiarPin()}>Guardar PIN</Button>
                    </div>
                  </div>

                  {/* Perfil + permisos */}
                  <div className="space-y-2">
                    <Label>Perfil</Label>
                    {perfiles.length > 0 ? (
                      <Select value={b.perfil_id ?? undefined} onValueChange={(id) => { const p = perfiles.find((x) => x.id === id); setB((s) => ({ ...s, perfil_id: id, permisos: p ? { ...(p.permisos ?? {}) } : s.permisos })); }}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Sin perfil — permisos manuales" /></SelectTrigger>
                        <SelectContent>{perfiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Crea perfiles en Administración → Perfiles y permisos para asignarlos aquí.</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">El perfil decide sus permisos del TPV y a qué zonas del panel entra. Abajo puedes ajustar los del TPV para este empleado.</p>
                    <Label className="pt-1">Permisos rápidos del TPV</Label>
                    <div className="space-y-1.5">
                      {PERMISOS.map(([k, t]) => (
                        <label key={k} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-[13px]">
                          <input
                            type="checkbox"
                            checked={b.permisos[k] !== false}
                            onChange={(e) => setB((s) => ({ ...s, permisos: { ...s.permisos, [k]: e.target.checked } }))}
                          />
                          {t}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Pulsera */}
                  <div className="space-y-1.5">
                    <Label htmlFor="emp-pulsera">Pulsera (RFID/NFC)</Label>
                    <p className="text-[11px] text-muted-foreground">
                      {emp!.pulsera_hash ? "Este empleado tiene una pulsera asignada." : "Sin pulsera. Acércala al lector (o teclea su código) y asigna."}
                    </p>
                    <div className="flex gap-2">
                      <Input
                        id="emp-pulsera" value={pulseraCodigo}
                        onChange={(e) => setPulseraCodigo(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") void asignarPulsera(e.currentTarget.value); }}
                        placeholder="Código de la pulsera"
                      />
                      <Button variant="outline" disabled={!pulseraCodigo.trim()} onClick={() => void asignarPulsera(pulseraCodigo)}>Asignar</Button>
                      {emp!.pulsera_hash && (
                        <Button variant="ghost" onClick={() => void asignarPulsera(null)}>Quitar</Button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border p-3">
              <Button variant="ghost" size="sm" onClick={cerrar}>Cerrar</Button>
              <Button size="sm" disabled={guardando} onClick={() => void guardar()}>
                {guardando ? "Guardando…" : editor.modo === "alta" ? "Crear empleado" : "Guardar cambios"}
              </Button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
