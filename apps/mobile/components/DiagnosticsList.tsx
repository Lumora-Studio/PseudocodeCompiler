import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { Diagnostic } from "@igcse/compiler/types";
import {
  createThemedStyleSheet,
  fonts,
  useAppTheme,
  useThemedStyles,
} from "../lib/theme";

interface DiagnosticsListProps {
  diagnostics: Diagnostic[];
  showHeader?: boolean;
}

function formatSeverityLabel(severity: Diagnostic["severity"]) {
  return severity.toUpperCase();
}

function DiagnosticBadge({ severity }: { severity: Diagnostic["severity"] }) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(useStyles);
  const icon =
    severity === "error"
      ? "x-circle"
      : severity === "warning"
        ? "alert-triangle"
        : "info";

  return (
    <View
      style={[
        styles.badge,
        severity === "error" && styles.badgeError,
        severity === "warning" && styles.badgeWarning,
        severity !== "error" && severity !== "warning" && styles.badgeInfo,
      ]}
    >
      <Feather
        name={icon}
        size={12}
        color={
          severity === "error"
            ? colors.red
            : severity === "warning"
              ? colors.orange
              : colors.accent
        }
      />
      <Text
        style={[
          styles.badgeText,
          severity === "error" && styles.badgeTextError,
          severity === "warning" && styles.badgeTextWarning,
          severity !== "error" && severity !== "warning" && styles.badgeTextInfo,
        ]}
      >
        {formatSeverityLabel(severity)}
      </Text>
    </View>
  );
}

export function DiagnosticsList({ diagnostics, showHeader = true }: DiagnosticsListProps) {
  const { width } = useWindowDimensions();
  const isCompact = width < 760;
  const { colors } = useAppTheme();
  const styles = useThemedStyles(useStyles);

  if (diagnostics.length === 0) {
    return (
      <View style={[styles.container, isCompact && styles.containerCompact]}>
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Feather name="check" size={14} color={colors.green} />
          </View>
          <Text style={styles.emptyTitle}>No compiler diagnostics</Text>
          <Text style={styles.emptyCopy}>
            Syntax and runtime issues will appear here after compile or run.
          </Text>
        </View>
      </View>
    );
  }

  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;

  return (
    <View style={[styles.container, isCompact && styles.containerCompact]}>
      {showHeader ? (
        <>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Problems</Text>
              <Text style={styles.headerSubtitle}>
                {errorCount} errors, {warningCount} warnings
              </Text>
            </View>
            <View style={styles.headerPill}>
              <Text style={styles.headerPillText}>{diagnostics.length}</Text>
            </View>
          </View>

          <View style={styles.divider} />
        </>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {diagnostics.map((diagnostic, index) => (
          <View
            key={`${diagnostic.code}-${diagnostic.line}-${diagnostic.column}-${index}`}
            style={[styles.item, index === diagnostics.length - 1 && styles.itemLast]}
          >
            <View style={styles.itemTopRow}>
              <DiagnosticBadge severity={diagnostic.severity} />
              <Text style={styles.meta}>
                {diagnostic.code} · L{diagnostic.line}:C{diagnostic.column}
              </Text>
            </View>

            <Text
              style={[
                styles.message,
                diagnostic.severity === "error"
                  ? styles.messageError
                  : diagnostic.severity === "warning"
                    ? styles.messageWarning
                    : styles.messageInfo,
              ]}
            >
              {diagnostic.message}
            </Text>

            {diagnostic.hint ? (
              <View style={styles.hintBox}>
                <Text style={styles.hintLabel}>hint</Text>
                <Text style={styles.hint}>{diagnostic.hint}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = createThemedStyleSheet(({ colors, isDark }) => ({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.surface,
  },
  containerCompact: {
    marginHorizontal: -8,
    marginBottom: -8,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(48, 209, 88, 0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(48, 209, 88, 0.22)",
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "700",
  },
  emptyCopy: {
    color: colors.text3,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 320,
  },
  header: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: colors.text2,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    marginTop: 2,
    color: colors.text3,
    fontFamily: fonts.sans,
    fontSize: 11,
  },
  headerPill: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  headerPillText: {
    color: colors.text2,
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: "700",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
  },
  item: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  itemLast: {},
  itemTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  badge: {
    height: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeError: {
    backgroundColor: isDark ? "rgba(255, 69, 58, 0.12)" : "rgba(192, 59, 43, 0.1)",
    borderColor: isDark ? "rgba(255, 69, 58, 0.22)" : "rgba(192, 59, 43, 0.2)",
  },
  badgeWarning: {
    backgroundColor: isDark ? "rgba(255, 159, 10, 0.14)" : "rgba(165, 97, 18, 0.12)",
    borderColor: isDark ? "rgba(255, 159, 10, 0.24)" : "rgba(165, 97, 18, 0.22)",
  },
  badgeInfo: {
    backgroundColor: isDark ? "rgba(10, 132, 255, 0.12)" : "rgba(11, 110, 79, 0.1)",
    borderColor: isDark ? "rgba(10, 132, 255, 0.22)" : "rgba(11, 110, 79, 0.18)",
  },
  badgeText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  badgeTextError: {
    color: colors.red,
  },
  badgeTextWarning: {
    color: colors.orange,
  },
  badgeTextInfo: {
    color: colors.accent,
  },
  meta: {
    color: colors.text3,
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 16,
  },
  message: {
    marginTop: 10,
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  messageError: {
    color: colors.red,
  },
  messageWarning: {
    color: colors.orange,
  },
  messageInfo: {
    color: colors.accent,
  },
  hintBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  hintLabel: {
    color: colors.text3,
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  hint: {
    marginTop: 4,
    color: colors.text2,
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 17,
  },
}));
