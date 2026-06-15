import "react-native-url-polyfill/auto";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/supabase";
import { Login } from "./src/Login";
import { Comandera } from "./src/Comandera";

/**
 * App móvil de Gluuh TPV (comandera). Mismo backend (Supabase) que la web:
 * el dispositivo inicia sesión como la empresa y cada camarero usa su PIN.
 */
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><ActivityIndicator size="large" /></View>;
  }

  return (
    <>
      <StatusBar style={session ? "light" : "dark"} />
      {session ? <Comandera onLogout={() => supabase.auth.signOut()} /> : <Login />}
    </>
  );
}
