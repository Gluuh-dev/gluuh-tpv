import { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { supabase } from "./supabase";

interface Empleado { id: string; nombre: string; rol: string }
interface Mesa { id: string; nombre: string; estado: string }
interface Cat { id: string; nombre: string }
interface Prod { id: string; nombre: string; precio: number; tipo_impositivo: number; category_id: string | null }

const eur = (n: number) => Number(n).toFixed(2) + " €";
function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function Comandera({ onLogout }: { onLogout: () => void }) {
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState("");
  const [locationId, setLocationId] = useState<string | null>(null);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [catSel, setCatSel] = useState<string | null>(null);
  const [comanda, setComanda] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: loc } = await supabase.from("location").select("id").limit(1).maybeSingle();
      setLocationId(loc?.id ?? null);
      const [{ data: m }, { data: c }, { data: p }] = await Promise.all([
        supabase.from("restaurant_table").select("id,nombre,estado").order("nombre"),
        supabase.from("category").select("id,nombre,orden").order("orden"),
        supabase.from("product").select("id,nombre,precio,tipo_impositivo,category_id").eq("disponible", true).order("nombre"),
      ]);
      setMesas((m as Mesa[]) ?? []);
      setCats((c as Cat[]) ?? []);
      setProds((p as Prod[]) ?? []);
      setCatSel((c as Cat[])?.[0]?.id ?? null);
    })();
  }, []);

  const total = useMemo(() => Object.entries(comanda).reduce((s, [id, q]) => s + (prods.find((p) => p.id === id)?.precio ?? 0) * q, 0), [comanda, prods]);
  const unidades = Object.values(comanda).reduce((s, q) => s + q, 0);
  const add = (id: string) => setComanda((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));
  const sub = (id: string) => setComanda((c) => { const n = (c[id] ?? 0) - 1; const { [id]: _, ...r } = c; return n > 0 ? { ...c, [id]: n } : r; });

  async function comprobarPin() {
    setPinErr("");
    const { data, error } = await supabase.rpc("validar_pin", { p_pin: pin });
    if (error) { setPinErr(error.message); return; }
    const emp = (data as Empleado[])?.[0];
    if (!emp) { setPinErr("PIN incorrecto"); setPin(""); return; }
    setEmpleado(emp); setPin("");
  }

  async function enviar() {
    if (!mesa || !empleado || !unidades) return;
    setBusy(true);
    try {
      const { data: order } = await supabase.from("sales_order").insert({
        location_id: locationId, table_id: mesa.id, user_id: empleado.id, canal: "COMANDERA",
        tipo_operacion: "VENTA", estado: "ENVIADA_COCINA", estado_preparacion: "PENDIENTE",
        total: Math.round(total * 100) / 100, client_id: uuid(),
      }).select("id").single();
      if (order) {
        await supabase.from("order_line").insert(Object.entries(comanda).map(([id, cantidad]) => {
          const p = prods.find((x) => x.id === id)!;
          return { order_id: order.id, product_id: id, nombre: p.nombre, cantidad, precio_unitario: p.precio, tipo_impositivo: p.tipo_impositivo };
        }));
        await supabase.from("restaurant_table").update({ estado: "OCUPADA" }).eq("id", mesa.id);
      }
      setComanda({}); setMesa(null);
    } finally { setBusy(false); }
  }

  // PIN
  if (!empleado) {
    const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"];
    return (
      <View style={st.pinWrap}>
        <Text style={st.pinTitle}>Comandera</Text>
        <Text style={st.pinSub}>Introduce tu PIN</Text>
        <View style={st.dots}>{[0, 1, 2, 3].map((i) => <View key={i} style={[st.dot, i < pin.length && st.dotOn]} />)}</View>
        {pinErr ? <Text style={st.err}>{pinErr}</Text> : null}
        <View style={st.keys}>
          {teclas.map((t) => (
            <TouchableOpacity key={t} style={[st.key, t === "OK" && st.keyOk]} onPress={() => { if (t === "C") setPin(""); else if (t === "OK") comprobarPin(); else if (pin.length < 8) setPin(pin + t); }}>
              <Text style={st.keyText}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={onLogout}><Text style={st.link}>Cerrar sesión de empresa</Text></TouchableOpacity>
      </View>
    );
  }

  // Mesas
  if (!mesa) {
    return (
      <View style={st.screen}>
        <View style={st.header}><Text style={st.hTitle}>Mesas</Text><TouchableOpacity onPress={() => setEmpleado(null)}><Text style={st.hLink}>{empleado.nombre} ✕</Text></TouchableOpacity></View>
        <ScrollView contentContainerStyle={st.mesasGrid}>
          {mesas.length === 0 && <Text style={st.muted}>No hay mesas (créalas en el panel web · Sala).</Text>}
          {mesas.map((m) => (
            <TouchableOpacity key={m.id} style={[st.mesa, m.estado !== "LIBRE" && st.mesaOcup]} onPress={() => setMesa(m)}>
              <Text style={st.mesaName}>{m.nombre}</Text>
              <Text style={st.muted}>{m.estado === "LIBRE" ? "Libre" : "Ocupada"}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  // Comanda
  const productos = prods.filter((p) => p.category_id === catSel);
  return (
    <View style={st.screen}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => { setMesa(null); setComanda({}); }}><Text style={st.hLink}>← Mesas</Text></TouchableOpacity>
        <Text style={st.hTitle}>{mesa.nombre}</Text><Text style={st.hLink}>{empleado.nombre}</Text>
      </View>
      <ScrollView horizontal style={st.tabs} showsHorizontalScrollIndicator={false}>
        {cats.map((c) => <TouchableOpacity key={c.id} style={[st.tab, catSel === c.id && st.tabOn]} onPress={() => setCatSel(c.id)}><Text style={catSel === c.id ? st.tabTextOn : st.tabText}>{c.nombre}</Text></TouchableOpacity>)}
      </ScrollView>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={st.prodList}>
        {productos.map((p) => (
          <TouchableOpacity key={p.id} style={st.prod} onPress={() => add(p.id)}>
            <Text style={st.prodName}>{p.nombre}</Text><Text style={st.prodPrice}>{eur(p.precio)}{comanda[p.id] ? `  ·  x${comanda[p.id]}` : ""}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={st.foot}>
        <View style={st.footRow}><Text style={st.footTotal}>Total</Text><Text style={st.footTotal}>{eur(total)}</Text></View>
        <TouchableOpacity style={[st.send, (!unidades || busy) && st.disabled]} onPress={enviar} disabled={!unidades || busy}>
          <Text style={st.sendText}>{busy ? "Enviando…" : `Enviar a cocina (${unidades})`}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f1f5f9" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0f172a", padding: 14, paddingTop: 48 },
  hTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  hLink: { color: "#cbd5e1" },
  muted: { color: "#94a3b8", fontSize: 12 },
  mesasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 12 },
  mesa: { width: 90, height: 90, borderRadius: 16, backgroundColor: "#fff", borderWidth: 2, borderColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  mesaOcup: { backgroundColor: "#fffbeb", borderColor: "#fcd34d" },
  mesaName: { fontWeight: "700" },
  tabs: { flexGrow: 0, backgroundColor: "#fff" },
  tab: { paddingHorizontal: 16, paddingVertical: 12 },
  tabOn: { borderBottomWidth: 3, borderBottomColor: "#4f46e5" },
  tabText: { color: "#475569" },
  tabTextOn: { color: "#4f46e5", fontWeight: "700" },
  prodList: { padding: 12, gap: 8 },
  prod: { backgroundColor: "#fff", borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: "#e2e8f0" },
  prodName: { fontWeight: "600" },
  prodPrice: { color: "#e11d48" },
  foot: { backgroundColor: "#fff", padding: 14, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  footRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  footTotal: { fontSize: 18, fontWeight: "800" },
  send: { backgroundColor: "#16a34a", borderRadius: 12, padding: 16, alignItems: "center" },
  sendText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.5 },
  pinWrap: { flex: 1, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center", padding: 24 },
  pinTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  pinSub: { color: "#94a3b8", marginBottom: 16 },
  dots: { flexDirection: "row", gap: 10, marginBottom: 12 },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#334155" },
  dotOn: { backgroundColor: "#6366f1" },
  err: { color: "#f87171", marginBottom: 8 },
  keys: { flexDirection: "row", flexWrap: "wrap", width: 260, gap: 10, justifyContent: "center" },
  key: { width: 76, height: 64, borderRadius: 14, backgroundColor: "#1e293b", alignItems: "center", justifyContent: "center" },
  keyOk: { backgroundColor: "#4f46e5" },
  keyText: { color: "#fff", fontSize: 24, fontWeight: "700" },
  link: { color: "#94a3b8", marginTop: 24, textDecorationLine: "underline" },
});
