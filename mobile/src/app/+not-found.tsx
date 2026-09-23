import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: "Missing" }} />
      <View style={styles.box}>
        <Text>This screen is not in Catalyst.</Text>
        <Link href="/">Back to Catalyst</Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
});
