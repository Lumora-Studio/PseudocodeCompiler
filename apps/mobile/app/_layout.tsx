import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../lib/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "600" },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: "IGCSE Pseudocode Compiler",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="manual"
          options={{
            title: "Pseudocode Guidelines",
            presentation: "modal",
          }}
        />
      </Stack>
    </>
  );
}
