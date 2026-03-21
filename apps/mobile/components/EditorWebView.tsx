import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { Diagnostic } from "@igcse/compiler/types";
import { colors, fonts, radii } from "../lib/theme";

// @ts-expect-error Expo bundles local HTML assets for WebView sources.
import editorHtml from "../assets/editor.html";

interface EditorWebViewProps {
  initialValue: string;
  onChange: (value: string) => void;
  diagnostics: Diagnostic[];
  onReady?: () => void;
}

const previewLineWidths = ["88%", "74%", "68%", "80%", "56%"] as const;

function EditorLoadingOverlay() {
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    pulseLoop.start();
    driftLoop.start();

    return () => {
      pulseLoop.stop();
      driftLoop.stop();
    };
  }, [drift, pulse]);

  const coreScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });
  const coreOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });
  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.18],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.42],
  });
  const driftX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-12, 12],
  });
  const sweepX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-160, 220],
  });

  return (
    <View style={styles.loadingOverlay}>
      <Animated.View
        style={[
          styles.loadingOrbRing,
          {
            opacity: ringOpacity,
            transform: [{ translateX: driftX }, { scale: ringScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.loadingOrbCore,
          {
            opacity: coreOpacity,
            transform: [{ translateX: driftX }, { scale: coreScale }],
          },
        ]}
      />

      <View style={styles.loadingPanel}>
        <View style={styles.loadingPanelHeader}>
          <View style={styles.loadingBadge}>
            <Animated.View
              style={[
                styles.loadingBadgeDot,
                {
                  opacity: coreOpacity,
                  transform: [{ scale: coreScale }],
                },
              ]}
            />
            <Text style={styles.loadingBadgeText}>INTERLACING EDITOR</Text>
          </View>
          <Text style={styles.loadingCaption}>
            Syntax colors are settling into place.
          </Text>
        </View>

        <View style={styles.loadingPreview}>
          {previewLineWidths.map((width, index) => (
            <View key={width} style={styles.loadingPreviewRow}>
              <View style={styles.loadingLineNumberRail} />
              <View
                style={[
                  styles.loadingCodeLine,
                  index === 0 && styles.loadingCodeLineKeyword,
                  index === 1 && styles.loadingCodeLineType,
                  index === 3 && styles.loadingCodeLineString,
                  { width },
                ]}
              />
            </View>
          ))}

          <Animated.View
            style={[
              styles.loadingSweep,
              { transform: [{ translateX: sweepX }, { rotate: "14deg" }] },
            ]}
          />
        </View>
      </View>
    </View>
  );
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
  const webViewOpacity = useRef(new Animated.Value(0.04)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const [showFallbackEditor, setShowFallbackEditor] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
  const [didInitFail, setDidInitFail] = useState(false);

  const revealEditor = useCallback(() => {
    setShowLoadingOverlay(true);
    Animated.parallel([
      Animated.timing(webViewOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setShowLoadingOverlay(false);
      }
    });
  }, [overlayOpacity, webViewOpacity]);

  const showFallback = useCallback(() => {
    overlayOpacity.stopAnimation();
    webViewOpacity.stopAnimation();
    overlayOpacity.setValue(0);
    webViewOpacity.setValue(0.04);
    setShowLoadingOverlay(false);
    setShowFallbackEditor(true);
  }, [overlayOpacity, webViewOpacity]);

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
        setDidInitFail(false);
        setShowFallbackEditor(false);
        if (pendingValueRef.current !== null) {
          currentValueRef.current = pendingValueRef.current;
          injectMessage({ type: "setValue", value: pendingValueRef.current });
          pendingValueRef.current = null;
        }
        syncDiagnostics();
        revealEditor();
        onReady?.();
        return;
      }

      if (data.type === "initError") {
        setDidInitFail(true);
        showFallback();
        return;
      }

      if (data.type === "onChange" && data.value !== undefined) {
        currentValueRef.current = data.value;
        onChange(data.value);
      }
    },
    [injectMessage, onChange, onReady, revealEditor, showFallback, syncDiagnostics],
  );

  useEffect(() => {
    pendingDiagnosticsRef.current = diagnostics;
    syncDiagnostics();
  }, [diagnostics, syncDiagnostics]);

  useEffect(() => {
    if (didInitFail) {
      return;
    }

    const timer = setTimeout(() => {
      if (!isReadyRef.current) {
        showFallback();
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [didInitFail, showFallback]);

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
      <Animated.View style={[styles.webviewShell, { opacity: webViewOpacity }]}>
        <WebView
          ref={webViewRef}
          source={editorHtml}
          style={[styles.webview, showFallbackEditor && styles.webviewHidden]}
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
          onError={() => {
            setDidInitFail(true);
            showFallback();
          }}
          onHttpError={() => {
            setDidInitFail(true);
            showFallback();
          }}
        />
      </Animated.View>

      {showFallbackEditor ? (
        <TextInput
          multiline
          value={initialValue}
          onChangeText={onChange}
          style={styles.fallbackInput}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          keyboardAppearance="dark"
          selectionColor={colors.accent}
          textAlignVertical="top"
          scrollEnabled
        />
      ) : null}

      {showLoadingOverlay ? (
        <Animated.View
          style={[styles.loadingOverlayShell, { opacity: overlayOpacity }]}
        >
          <EditorLoadingOverlay />
        </Animated.View>
      ) : null}
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
  webviewShell: {
    ...StyleSheet.absoluteFillObject,
  },
  webviewHidden: {
    opacity: 0.01,
  },
  fallbackInput: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
    color: colors.text,
    backgroundColor: colors.bg,
    fontFamily: "Menlo",
    fontSize: 13,
    lineHeight: 22,
  },
  loadingOverlayShell: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: colors.bg,
    overflow: "hidden",
  },
  loadingOrbRing: {
    position: "absolute",
    width: 188,
    height: 188,
    borderRadius: 94,
    borderWidth: 1,
    borderColor: colors.accentSoft,
    backgroundColor: "rgba(10, 132, 255, 0.04)",
  },
  loadingOrbCore: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(10, 132, 255, 0.14)",
    shadowColor: colors.accent,
    shadowOpacity: 0.26,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  loadingPanel: {
    width: "100%",
    maxWidth: 360,
    gap: 18,
    padding: 18,
    borderRadius: radii.section,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    backgroundColor: "rgba(44, 44, 46, 0.92)",
  },
  loadingPanelHeader: {
    gap: 8,
  },
  loadingBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(10, 132, 255, 0.12)",
  },
  loadingBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  loadingBadgeText: {
    color: colors.accent,
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.9,
  },
  loadingCaption: {
    color: colors.text2,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  loadingPreview: {
    gap: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
  loadingPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingLineNumberRail: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.lineNumber,
    opacity: 0.56,
  },
  loadingCodeLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(229, 229, 234, 0.12)",
  },
  loadingCodeLineKeyword: {
    backgroundColor: "rgba(252, 95, 163, 0.38)",
  },
  loadingCodeLineType: {
    backgroundColor: "rgba(93, 216, 255, 0.34)",
  },
  loadingCodeLineString: {
    backgroundColor: "rgba(252, 106, 93, 0.32)",
  },
  loadingSweep: {
    position: "absolute",
    top: -12,
    bottom: -12,
    width: 84,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
});
