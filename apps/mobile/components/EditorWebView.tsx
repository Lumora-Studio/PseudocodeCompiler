import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { Diagnostic } from "@igcse/compiler/types";
import { colors } from "../lib/theme";

// @ts-expect-error Expo bundles local HTML assets for WebView sources.
import editorHtml from "../assets/editor.html";

interface EditorWebViewProps {
  initialValue: string;
  onChange: (value: string) => void;
  diagnostics: Diagnostic[];
  onReady?: () => void;
}

export function EditorWebView({
  initialValue,
  onChange,
  diagnostics,
  onReady,
}: EditorWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const isReadyRef = useRef(false);
  const currentValueRef = useRef(initialValue);
  const pendingValueRef = useRef<string | null>(initialValue);
  const pendingDiagnosticsRef = useRef<Diagnostic[]>(diagnostics);

  const injectMessage = useCallback((message: object) => {
    webViewRef.current?.injectJavaScript(
      `(function() {
        var evt = new MessageEvent("message", {
          data: ${JSON.stringify(JSON.stringify(message))}
        });
        window.dispatchEvent(evt);
      })(); true;`,
    );
  }, []);

  const syncDiagnostics = useCallback(() => {
    if (!isReadyRef.current) {
      return;
    }

    injectMessage({
      type: "setDiagnostics",
      markers: pendingDiagnosticsRef.current,
    });
  }, [injectMessage]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let data: { type: string; value?: string };

      try {
        data = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }

      if (data.type === "ready") {
        isReadyRef.current = true;
        if (pendingValueRef.current !== null) {
          currentValueRef.current = pendingValueRef.current;
          injectMessage({ type: "setValue", value: pendingValueRef.current });
          pendingValueRef.current = null;
        }
        syncDiagnostics();
        onReady?.();
        return;
      }

      if (data.type === "onChange" && data.value !== undefined) {
        currentValueRef.current = data.value;
        onChange(data.value);
      }
    },
    [injectMessage, onChange, onReady, syncDiagnostics],
  );

  useEffect(() => {
    pendingDiagnosticsRef.current = diagnostics;
    syncDiagnostics();
  }, [diagnostics, syncDiagnostics]);

  useEffect(() => {
    if (initialValue === currentValueRef.current) {
      return;
    }

    pendingValueRef.current = initialValue;
    if (!isReadyRef.current) {
      return;
    }

    currentValueRef.current = initialValue;
    injectMessage({ type: "setValue", value: initialValue });
  }, [initialValue, injectMessage]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={editorHtml}
        style={styles.webview}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        keyboardDisplayRequiresUserAction={false}
        textInteractionEnabled
        onMessage={handleMessage}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        allowsBackForwardNavigationGestures={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    backgroundColor: colors.bg,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
