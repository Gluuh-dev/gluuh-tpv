import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

/**
 * Comandera (esqueleto). Aquí se construye el flujo del camarero:
 * plano de mesas → carta → comanda → enviar a cocina → cobro en mesa (docs/10 §1).
 *
 * NOTA sobre fiscalidad en el dispositivo: el cálculo de impuestos de @gluuh/core
 * (tax.ts) es JS puro y se puede reutilizar tal cual. El motor VERIFACTU
 * (verifactu.ts) usa `node:crypto`, que NO existe en React Native; para generar
 * la huella SHA-256 en la comandera offline hay que usar un crypto compatible
 * (p. ej. `expo-crypto` o `react-native-quick-crypto`). Ver docs/06 §4.4 y docs/07.
 */
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gluuh Comandera</Text>
      <Text style={styles.subtitle}>Esqueleto · ver docs/</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 24, fontWeight: "700" },
  subtitle: { fontSize: 14, color: "#666", marginTop: 8 },
});
