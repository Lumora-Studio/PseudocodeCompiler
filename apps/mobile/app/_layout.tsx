import { StatusBar } from "expo-status-bar";
import { Stack, useRouter } from "expo-router";
import { Platform } from "react-native";
import { enableScreens } from "react-native-screens";
import { JsStack } from "../layouts/JsStack";
import { colors } from "../lib/theme";

const platformWithPad = Platform as typeof Platform & { isPad?: boolean };
const isPad = Platform.OS === "ios" && platformWithPad.isPad === true;

if (isPad) {
  // Work around the iPad native screen-frame bug by falling back to the JS
  // stack only on iPadOS. Phones should stay on the normal router stack.
  enableScreens(false);
}

const tabletScreenOptions = {
  animation: "none" as const,
  cardStyle: { backgroundColor: colors.bg },
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: "600" as const },
};

const phoneScreenOptions = {
  animation: "none" as const,
  contentStyle: { backgroundColor: colors.bg },
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: "600" as const },
};

const tabletManualScreenOptions = {
  title: "Pseudocode Guidelines",
  presentation: "modal" as const,
};

export default function RootLayout() {
  const router = useRouter();
  const phoneManualScreenOptions =
    Platform.OS === "ios"
      ? {
          title: "Pseudocode Guidelines",
          presentation: "modal" as const,
          headerRightBarButtonItems: [
            {
              type: "button" as const,
              icon: { type: "sfSymbol" as const, name: "xmark" },
              accessibilityLabel: "Close pseudocode guidelines",
              tintColor: colors.text2,
              variant: "plain" as const,
              hidesSharedBackground: true,
              sharesBackground: false,
              onPress: () => router.back(),
            },
          ],
        }
      : {
          title: "Pseudocode Guidelines",
          presentation: "modal" as const,
        };

  return (
    <>
      <StatusBar style="light" />
      {isPad ? (
        <JsStack
          detachInactiveScreens={false}
          screenOptions={tabletScreenOptions}
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
            options={tabletManualScreenOptions}
          />
        </JsStack>
      ) : (
        <Stack screenOptions={phoneScreenOptions}>
          <Stack.Screen
            name="index"
            options={{
              title: "IGCSE Pseudocode Compiler",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="manual"
            options={phoneManualScreenOptions}
          />
        </Stack>
      )}
    </>
  );
}
