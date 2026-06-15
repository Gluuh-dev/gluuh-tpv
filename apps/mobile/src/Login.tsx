import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { supabase } from "./supabase";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function entrar() {
    setBusy(true);
    setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(error.message);
  }

  return (
    <View style={s.c}>
      <Text style={s.title}>Gluuh TPV</Text>
      <Text style={s.sub}>Inicia sesión de tu empresa</Text>
      <TextInput style={s.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={s.input} placeholder="Contraseña" secureTextEntry value={password} onChangeText={setPassword} />
      <TouchableOpacity style={s.btn} onPress={entrar} disabled={busy}>
        <Text style={s.btnText}>{busy ? "Entrando…" : "Entrar"}</Text>
      </TouchableOpacity>
      {err ? <Text style={s.err}>{err}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff", gap: 12 },
  title: { fontSize: 28, fontWeight: "800", textAlign: "center" },
  sub: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 10, padding: 14, fontSize: 16 },
  btn: { backgroundColor: "#4f46e5", borderRadius: 10, padding: 16, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  err: { color: "#dc2626", textAlign: "center" },
});
