import { useEffect, useRef } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import {
  createThemedStyleSheet,
  fonts,
  useAppTheme,
  useThemedStyles,
} from "../lib/theme";

interface TerminalProps {
  text: string;
  pendingInputPrompt: string | null;
  pendingInputText: string;
  onInputTextChange: (text: string) => void;
  onSubmitInput: () => void;
  onCancelInput: () => void;
}

type TerminalLineTone = "default" | "error" | "warning" | "info" | "success";
const AUTO_SCROLL_THRESHOLD = 40;

function classifyLine(line: string): TerminalLineTone {
  if (/\b(ERROR|FAILED|TRACEBACK)\b/i.test(line)) {
    return "error";
  }

  if (/\bWARNING\b/i.test(line)) {
    return "warning";
  }

  if (/\bINFO\b/i.test(line)) {
    return "info";
  }

  if (/\b(SUCCESS|SUCCEEDED|WELCOME|COMPLETE|COMPLETED|DONE)\b/i.test(line)) {
    return "success";
  }

  return "default";
}

export function Terminal({
  text,
  pendingInputPrompt,
  pendingInputText,
  onInputTextChange,
  onSubmitInput,
  onCancelInput,
}: TerminalProps) {
  const scrollRef = useRef<ScrollView>(null);
  const isPinnedToBottomRef = useRef(true);
  const isUserScrollingRef = useRef(false);
  const { width } = useWindowDimensions();
  const isCompact = width < 760;
  const { colors } = useAppTheme();
  const styles = useThemedStyles(useStyles);
  const lines = text.length > 0 ? text.split(/\r?\n/) : [];

  const scrollToLatest = (animated: boolean) => {
    scrollRef.current?.scrollToEnd({ animated });
  };

  const beginManualScroll = () => {
    isPinnedToBottomRef.current = false;
    isUserScrollingRef.current = true;
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    isPinnedToBottomRef.current = distanceFromBottom <= AUTO_SCROLL_THRESHOLD;
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    handleScroll(event);
    isUserScrollingRef.current = false;
  };

  useEffect(() => {
    if (!isPinnedToBottomRef.current || isUserScrollingRef.current) {
      return;
    }

    scrollToLatest(true);
  }, [pendingInputPrompt, text]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={styles.output}
        contentContainerStyle={styles.outputContent}
        alwaysBounceVertical
        keyboardDismissMode={Platform.OS === "ios" ? "on-drag" : "interactive"}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        scrollEnabled
        directionalLockEnabled
        onTouchStart={beginManualScroll}
        onScroll={handleScroll}
        onScrollBeginDrag={beginManualScroll}
        onMomentumScrollBegin={beginManualScroll}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
        onContentSizeChange={() => {
          if (!isPinnedToBottomRef.current || isUserScrollingRef.current) {
            return;
          }

          scrollToLatest(false);
        }}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator
        indicatorStyle={colors.terminalIndicator}
      >
        {lines.map((line, index) => {
          if (line.startsWith("$ ")) {
            return (
              <Text key={`terminal-line-${index}`} style={styles.outputText}>
                <Text style={styles.commandPrompt}>$ </Text>
                <Text style={styles.commandText}>{line.slice(2) || " "}</Text>
              </Text>
            );
          }

          const tone = classifyLine(line);
          return (
            <Text
              key={`terminal-line-${index}`}
              style={[
                styles.outputText,
                tone === "error" && styles.outputTextError,
                tone === "warning" && styles.outputTextWarning,
                tone === "info" && styles.outputTextInfo,
                tone === "success" && styles.outputTextSuccess,
              ]}
            >
              {line || " "}
            </Text>
          );
        })}

        {lines.length === 0 && pendingInputPrompt === null ? (
          <View style={styles.cursorLine}>
            <Text style={styles.commandPrompt}>$ </Text>
            <View style={styles.cursorBlock} />
          </View>
        ) : null}
      </ScrollView>

      {pendingInputPrompt ? (
        <View style={styles.inputBar}>
          <Text style={styles.inputPrompt}>{pendingInputPrompt}</Text>
          <View style={[styles.inputRow, isCompact && styles.inputRowCompact]}>
            <Text style={styles.commandPrompt}>$ </Text>
            <TextInput
              style={styles.textInput}
              value={pendingInputText}
              onChangeText={onInputTextChange}
              onSubmitEditing={onSubmitInput}
              placeholder="stdin"
              placeholderTextColor={colors.text3}
              selectionColor={colors.accent}
              autoFocus
              returnKeyType="send"
              keyboardAppearance={colors.inputKeyboardAppearance}
              underlineColorAndroid="transparent"
            />
            <View
              style={[
                styles.inputActions,
                isCompact && styles.inputActionsCompact,
              ]}
            >
              <TouchableOpacity style={styles.actionButton} onPress={onSubmitInput}>
                <Text style={[styles.actionText, styles.actionTextPrimary]}>
                  Send
                </Text>
              </TouchableOpacity>
              <Text style={styles.actionDivider}>/</Text>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={onCancelInput}
              >
                <Text style={styles.actionText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : lines.length > 0 ? (
        <View style={styles.idleBar}>
          <Text style={styles.commandPrompt}>$ </Text>
          <View style={styles.cursorBlock} />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyleSheet(({ colors }) => ({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.surface,
  },
  output: {
    flex: 1,
    backgroundColor: "transparent",
  },
  outputContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 14,
  },
  outputText: {
    color: colors.text2,
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 20,
  },
  outputTextError: {
    color: colors.red,
  },
  outputTextWarning: {
    color: colors.orange,
  },
  outputTextInfo: {
    color: colors.accent,
  },
  outputTextSuccess: {
    color: colors.green,
  },
  commandPrompt: {
    color: colors.green,
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 20,
  },
  commandText: {
    color: colors.text,
  },
  cursorLine: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 20,
  },
  cursorBlock: {
    width: 8,
    height: 14,
    marginLeft: 1,
    borderRadius: 1,
    backgroundColor: colors.text2,
  },
  inputBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: colors.surface,
  },
  inputPrompt: {
    color: colors.text2,
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  inputRow: {
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputRowCompact: {
    flexWrap: "wrap",
    rowGap: 6,
  },
  textInput: {
    flex: 1,
    minWidth: 120,
    color: colors.text,
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 20,
    paddingVertical: 0,
  },
  inputActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inputActionsCompact: {
    width: "100%",
    justifyContent: "flex-end",
  },
  actionButton: {
    minHeight: 20,
    justifyContent: "center",
  },
  actionText: {
    color: colors.text2,
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: "500",
  },
  actionTextPrimary: {
    color: colors.text,
  },
  actionDivider: {
    color: colors.text3,
    fontFamily: fonts.mono,
    fontSize: 12,
  },
  idleBar: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
}));
