import { StatusBar } from "expo-status-bar";
import { enableScreens } from "react-native-screens";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { JsStack } from "../layouts/JsStack";
import { colors } from "../lib/theme";

// Work around iOS/iPadOS native screen-frame bugs by falling back to plain
// React Native views instead of native screen containers.
enableScreens(false);

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="light" />
      <JsStack
        detachInactiveScreens={false}
        screenOptions={{
          animation: "none",
          cardStyle: { backgroundColor: colors.bg },
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "600" },
        }}
      >
        <JsStack.Screen
          name="index"
          options={{
            title: "IGCSE Pseudocode Compiler",
            headerShown: false,
          }}
        />
        <JsStack.Screen
          name="manual"
          options={{
            title: "Pseudocode Guidelines",
            presentation: "modal",
          }}
        />
      </JsStack>
    </SafeAreaProvider>
  );
}
