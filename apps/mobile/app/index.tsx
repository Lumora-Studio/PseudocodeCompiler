import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  useSafeAreaFrame,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as ScreenOrientation from "expo-screen-orientation";
import { WebView } from "react-native-webview";
import { EditorWebView } from "../components/EditorWebView";
import { Terminal } from "../components/Terminal";
import { WorkspaceTree } from "../components/WorkspaceTree";
import {
  createThemedStyleSheet,
  dimensions,
  fonts,
  radii,
  type ThemeMode,
  useAppTheme,
  useThemedStyles,
} from "../lib/theme";
import { useCompilerWorkspace } from "../lib/useCompilerWorkspace";

// @ts-expect-error Expo bundles local HTML assets for WebView sources.
import pyodideRunnerHtml from "../assets/pyodide-runner.html";

type PhoneTab = "editor" | "files" | "output" | "settings";

const PHONE_TAB_BAR_HORIZONTAL_PADDING = 20;
const THEME_MODE_ORDER: ThemeMode[] = ["system", "light", "dark"];

function getNextThemeMode(mode: ThemeMode): ThemeMode {
  const currentIndex = THEME_MODE_ORDER.indexOf(mode);
  return THEME_MODE_ORDER[(currentIndex + 1) % THEME_MODE_ORDER.length];
}

function NavIconButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(useStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconButton,
        disabled && styles.iconButtonDisabled,
        pressed && !disabled && styles.iconButtonPressed,
      ]}
    >
      <Feather
        name={icon}
        size={20}
        color={disabled ? colors.text3 : colors.accent}
      />
    </Pressable>
  );
}

function RunButton({
  disabled,
  onPress,
  compact = false,
}: {
  disabled: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  const styles = useThemedStyles(useStyles);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.runButton,
        compact && styles.runButtonCompact,
        disabled && styles.runButtonDisabled,
      ]}
    >
      <Feather name="play" size={compact ? 12 : 14} color="#FFFFFF" />
      <Text style={styles.runButtonText}>Run</Text>
    </TouchableOpacity>
  );
}

function OutputHeader({
  onClear,
  onClose,
}: {
  onClear: () => void;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(useStyles);
  return (
    <View style={styles.outputHeader}>
      <Text style={styles.outputHeaderTitle}>Output</Text>
      <View style={styles.outputHeaderActions}>
        <TouchableOpacity onPress={onClear} style={styles.outputHeaderButton}>
          <Feather name="trash-2" size={16} color={colors.text3} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={styles.outputHeaderButton}>
          <Feather name="x" size={16} color={colors.text3} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StarterPanel({
  onCreateDocument,
  onCreateFolder,
}: {
  onCreateDocument: () => void;
  onCreateFolder: () => void;
}) {
  const styles = useThemedStyles(useStyles);

  return (
    <View style={styles.starterWrap}>
      <View style={styles.starterCard}>
        <Text style={styles.starterEyebrow}>START HERE</Text>
        <Text style={styles.starterTitle}>Create your first file.</Text>
        <Text style={styles.starterBody}>
          This workspace now opens empty. Add a pseudocode file from here or from the Files tab, then start writing and running code.
        </Text>
        <View style={styles.starterActions}>
          <TouchableOpacity style={styles.starterPrimaryButton} onPress={onCreateDocument}>
            <Text style={styles.starterPrimaryButtonText}>Create First File</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.starterSecondaryButton} onPress={onCreateFolder}>
            <Text style={styles.starterSecondaryButtonText}>Create Folder</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function PhoneSettingsView({
  activeDocumentName,
  mode,
  resolvedTheme,
  onSelectMode,
  onOpenFiles,
  onOpenManual,
  onClearOutput,
}: {
  activeDocumentName: string;
  mode: ThemeMode;
  resolvedTheme: "dark" | "light";
  onSelectMode: (mode: ThemeMode) => void;
  onOpenFiles: () => void;
  onOpenManual: () => void;
  onClearOutput: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(useStyles);
  return (
    <ScrollView
      style={styles.settingsScroll}
      contentContainerStyle={styles.settingsContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.settingsHero}>
        <Text style={styles.settingsEyebrow}>Settings</Text>
        <Text style={styles.settingsTitle}>Workspace controls for the mobile shell.</Text>
        <Text style={styles.settingsCopy}>
          Editing, files, output, and the guide stay separated so the editor remains fast and easy to scan on iPhone.
        </Text>
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>Appearance</Text>
        <Text style={styles.settingsValue}>Theme mode: {mode}</Text>
        <Text style={styles.settingsBody}>
          Following {resolvedTheme} visuals right now. Switch manually or stay synced with the system setting.
        </Text>
        <View style={styles.themeModeRow}>
          {THEME_MODE_ORDER.map((option) => {
            const isActive = mode === option;
            return (
              <TouchableOpacity
                key={option}
                onPress={() => onSelectMode(option)}
                style={[
                  styles.themeModeButton,
                  isActive && styles.themeModeButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.themeModeButtonText,
                    isActive && styles.themeModeButtonTextActive,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>Current file</Text>
        <Text style={styles.settingsValue}>{activeDocumentName || "No file selected"}</Text>
        <Text style={styles.settingsBody}>
          Open the Files tab to create a pseudocode file, switch documents, or clear the workspace completely.
        </Text>
      </View>

      <View style={styles.settingsActionRow}>
        <TouchableOpacity style={styles.settingsAction} onPress={onOpenFiles}>
          <Feather name="folder" size={14} color={colors.text2} />
          <Text style={styles.settingsActionText}>Open Files</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingsAction, styles.settingsActionPrimary]}
          onPress={onOpenManual}
        >
          <Feather name="book-open" size={14} color="#FFFFFF" />
          <Text style={styles.settingsActionTextPrimary}>Manual</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>Tips</Text>
        <Text style={styles.settingsBullet}>Type {"<-"} to insert {"←"} automatically.</Text>
        <Text style={styles.settingsBullet}>Compiler markers appear directly in the editor after each run.</Text>
        <Text style={styles.settingsBullet}>Interactive INPUT requests stay open until you send or cancel them.</Text>
      </View>

      <TouchableOpacity style={styles.settingsGhostButton} onPress={onClearOutput}>
        <Feather name="trash-2" size={14} color={colors.text2} />
        <Text style={styles.settingsGhostButtonText}>Clear Output</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function PhoneTabBar({
  activeTab,
  onSelect,
  bottomInset,
}: {
  activeTab: PhoneTab;
  onSelect: (tab: PhoneTab) => void;
  bottomInset: number;
}) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(useStyles);
  const tabs = [
    { key: "editor" as const, label: "Editor", icon: "code" as const },
    { key: "files" as const, label: "Files", icon: "folder" as const },
    { key: "output" as const, label: "Output", icon: "terminal" as const },
  ];

  return (
    <View style={[styles.phoneTabBarContainer, { paddingBottom: bottomInset }]}>
      <View style={styles.phoneTabBarPill}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onSelect(tab.key)}
              style={[
                styles.phoneTabBarItem,
                isActive && styles.phoneTabBarItemActive,
              ]}
            >
              <Feather
                name={tab.icon}
                size={18}
                color={isActive ? colors.accent : colors.text2}
              />
              <Text
                style={[
                  styles.phoneTabBarText,
                  isActive && styles.phoneTabBarTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function EditorScreen() {
  const router = useRouter();
  const { colors, mode, resolvedTheme, setMode } = useAppTheme();
  const styles = useThemedStyles(useStyles);
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const { width, height } = frame;
  const shortestSide = Math.min(width, height);
  const platformWithPad = Platform as typeof Platform & { isPad?: boolean };
  const isTabletLayout =
    (Platform.OS === "ios" && platformWithPad.isPad === true) ||
    shortestSide >= 744;

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isOutputVisible, setIsOutputVisible] = useState(false);
  const [editorRestoreToken, setEditorRestoreToken] = useState(0);
  const [phoneTab, setPhoneTab] = useState<PhoneTab>("editor");
  const hasMountedRef = useRef(false);
  const resumeEditorFromManualRef = useRef(false);

  const {
    workspace,
    activeDocument,
    breadcrumbs,
    compileDiagnostics,
    terminalText,
    pendingInputPrompt,
    pendingInputText,
    isRunning,
    saveError,
    pyodideWebViewRef,
    handlePyodideMessage,
    setPendingInputText,
    submitPendingInput,
    cancelPendingInput,
    runCurrent,
    selectDocument,
    updateActiveDocumentSource,
    toggleFolder,
    createFolderInWorkspace,
    createDocumentInWorkspace,
    renameNodeInWorkspace,
    deleteNodesInWorkspace,
    moveNodesInWorkspace,
    clearTerminal,
  } = useCompilerWorkspace();

  useEffect(() => {
    if (!isTabletLayout) {
      return;
    }

    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

    return () => {
      void ScreenOrientation.unlockAsync();
    };
  }, [isTabletLayout]);

  const resolveKeyboardOverlap = useCallback(
    (event?: KeyboardEvent) => {
      if (Platform.OS !== "ios" || !event?.endCoordinates) {
        return 0;
      }

      const frameBottom = insets.top + height;
      const overlapFromScreenY = Math.max(
        0,
        frameBottom - event.endCoordinates.screenY,
      );
      const overlapFromHeight = Math.max(
        0,
        event.endCoordinates.height - insets.bottom,
      );

      return Math.max(overlapFromScreenY, overlapFromHeight);
    },
    [height, insets.bottom, insets.top],
  );

  useEffect(() => {
    const handleKeyboardShow = (event?: KeyboardEvent) => {
      if (Platform.OS !== "ios") {
        setKeyboardOverlap(0);
        setIsKeyboardVisible(true);
        return;
      }

      const overlap = resolveKeyboardOverlap(event);
      setKeyboardOverlap(overlap);
      setIsKeyboardVisible(overlap > 0);
    };
    const handleKeyboardFrameChange = (event?: KeyboardEvent) => {
      if (Platform.OS !== "ios") {
        return;
      }

      const overlap = resolveKeyboardOverlap(event);
      setKeyboardOverlap(overlap);
      setIsKeyboardVisible(overlap > 0);
    };
    const handleKeyboardHide = () => {
      setKeyboardOverlap(0);
      setIsKeyboardVisible(false);
    };

    const showSubscription = Keyboard.addListener(
      "keyboardWillShow",
      handleKeyboardShow,
    );
    const showFallbackSubscription = Keyboard.addListener(
      "keyboardDidShow",
      handleKeyboardShow,
    );
    const hideSubscription = Keyboard.addListener(
      "keyboardWillHide",
      handleKeyboardHide,
    );
    const hideFallbackSubscription = Keyboard.addListener(
      "keyboardDidHide",
      handleKeyboardHide,
    );
    const frameChangeSubscription = Keyboard.addListener(
      "keyboardWillChangeFrame",
      handleKeyboardFrameChange,
    );
    const frameChangeFallbackSubscription = Keyboard.addListener(
      "keyboardDidChangeFrame",
      handleKeyboardFrameChange,
    );

    return () => {
      showSubscription.remove();
      showFallbackSubscription.remove();
      hideSubscription.remove();
      hideFallbackSubscription.remove();
      frameChangeSubscription.remove();
      frameChangeFallbackSubscription.remove();
    };
  }, [resolveKeyboardOverlap]);

  useEffect(() => {
    if (isTabletLayout || phoneTab === "editor") {
      return;
    }

    Keyboard.dismiss();
  }, [isTabletLayout, phoneTab]);

  useEffect(() => {
    if (!pendingInputPrompt) {
      return;
    }

    Keyboard.dismiss();

    if (isTabletLayout) {
      setIsOutputVisible(true);
      return;
    }

    setPhoneTab("output");
  }, [isTabletLayout, pendingInputPrompt]);

  useFocusEffect(
    useCallback(() => {
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return undefined;
      }

      if (!resumeEditorFromManualRef.current) {
        return undefined;
      }

      resumeEditorFromManualRef.current = false;
      setEditorRestoreToken((value) => value + 1);
      return undefined;
    }, []),
  );

  const visibleBreadcrumbs = useMemo(() => {
    return breadcrumbs.filter((node) => node.parentId !== null);
  }, [breadcrumbs]);

  const phoneTabBarBottomPadding =
    Platform.OS === "ios"
      ? PHONE_TAB_BAR_HORIZONTAL_PADDING
      : Math.max(insets.bottom, 8);
  const phoneScreenHeight = height - insets.top;
  const tabletScreenHeight = height - insets.top - insets.bottom;
  const keyboardInset = Platform.OS === "ios" ? keyboardOverlap : 0;
  const phoneBodyHeight = Math.max(
    0,
    phoneScreenHeight -
      dimensions.phoneTopBarHeight -
      StyleSheet.hairlineWidth -
      (saveError ? 24 : 0),
  );
  const tabletBodyHeight = Math.max(
    0,
    tabletScreenHeight - dimensions.tabletTopBarHeight - StyleSheet.hairlineWidth,
  );
  const phoneBodyVisibleHeight = Math.max(0, phoneBodyHeight - keyboardInset);
  const tabletBodyVisibleHeight = Math.max(0, tabletBodyHeight - keyboardInset);
  const rootInsetStyle = isTabletLayout
    ? ({
        width,
        height,
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        paddingBottom: insets.bottom,
      } as const)
    : ({
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      } as const);

  const handleRun = async () => {
    await runCurrent();
    if (isTabletLayout) {
      setIsOutputVisible(true);
      return;
    }

    setPhoneTab("output");
  };

  const handleOpenManual = useCallback(() => {
    resumeEditorFromManualRef.current = true;
    router.push("/manual");
  }, [router]);

  const handleCycleThemeMode = useCallback(() => {
    setMode(getNextThemeMode(mode));
  }, [mode, setMode]);

  if (!workspace) {
    return (
      <View style={[styles.safe, rootInsetStyle]}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </View>
    );
  }

  const outputBody = (
    <Terminal
      text={terminalText}
      pendingInputPrompt={pendingInputPrompt}
      pendingInputText={pendingInputText}
      onInputTextChange={setPendingInputText}
      onSubmitInput={submitPendingInput}
      onCancelInput={cancelPendingInput}
    />
  );

  return (
    <View style={[styles.safe, rootInsetStyle]}>
      <View style={styles.screen}>
        {isTabletLayout ? (
          <>
            <View style={styles.tabletNavBar}>
              <View style={styles.tabletNavLeft}>
                <NavIconButton
                  icon="sidebar"
                  label={isSidebarVisible ? "Hide sidebar" : "Show sidebar"}
                  onPress={() => setIsSidebarVisible((value) => !value)}
                />
                <View style={styles.tabletNavSeparator} />
                <Feather name="file-text" size={18} color={colors.accent} />
                <Text style={styles.tabletNavTitle} numberOfLines={1}>
                  {activeDocument?.name ?? "No file selected"}
                </Text>
              </View>

              <View style={styles.tabletNavRight}>
                <RunButton disabled={isRunning || !activeDocument} onPress={handleRun} />
                <NavIconButton
                  icon="book-open"
                  label="Open manual"
                  onPress={handleOpenManual}
                />
                <NavIconButton
                  icon="settings"
                  label={`Theme mode ${mode}. Tap to switch appearance.`}
                  onPress={handleCycleThemeMode}
                />
              </View>
            </View>
            <View style={styles.divider} />

            {saveError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{saveError}</Text>
              </View>
            ) : null}

            <View
              style={[
                styles.tabletBody,
                { flex: 0, height: tabletBodyVisibleHeight },
              ]}
            >
              {isSidebarVisible ? (
                <>
                  <View
                    style={[
                      styles.sidebarShell,
                      { width: dimensions.tabletSidebarWidth },
                    ]}
                  >
                    <WorkspaceTree
                      workspace={workspace}
                      activeDocumentId={activeDocument?.id ?? null}
                      onToggleFolder={toggleFolder}
                      onCreateFolder={createFolderInWorkspace}
                      onCreateDocument={createDocumentInWorkspace}
                      onRenameNode={renameNodeInWorkspace}
                      onDeleteNodes={deleteNodesInWorkspace}
                      onMoveNodes={moveNodesInWorkspace}
                      onSelectDocument={selectDocument}
                    />
                  </View>
                  <View style={styles.verticalDivider} />
                </>
              ) : null}

              <View
                style={styles.tabletEditorArea}
              >
                <View style={styles.breadcrumbBar}>
                  {(visibleBreadcrumbs.length > 0
                    ? visibleBreadcrumbs
                    : activeDocument
                      ? [activeDocument]
                      : []
                  ).map((node, index, nodes) => (
                    <View key={node.id} style={styles.breadcrumbItem}>
                      <Text
                        style={[
                          styles.breadcrumbText,
                          index === nodes.length - 1 &&
                            styles.breadcrumbTextActive,
                        ]}
                      >
                        {node.name}
                      </Text>
                      {index < nodes.length - 1 ? (
                        <Feather
                          name="chevron-right"
                          size={10}
                          color={colors.text3}
                        />
                      ) : null}
                    </View>
                  ))}
                </View>
                <View style={styles.divider} />

                <View style={styles.editorPanel}>
                  {activeDocument ? (
                    <EditorWebView
                      key={`tablet-editor-${activeDocument.id}`}
                      initialValue={activeDocument.source}
                      onChange={updateActiveDocumentSource}
                      diagnostics={compileDiagnostics}
                      restoreToken={editorRestoreToken}
                    />
                  ) : (
                    <StarterPanel
                      onCreateDocument={() => createDocumentInWorkspace()}
                      onCreateFolder={() => createFolderInWorkspace()}
                    />
                  )}
                </View>

                <View style={styles.divider} />

                {isOutputVisible ? (
                  <View
                    style={[
                      styles.outputPanel,
                      { height: dimensions.tabletOutputHeight },
                    ]}
                  >
                    <OutputHeader
                      onClear={clearTerminal}
                      onClose={() => setIsOutputVisible(false)}
                    />
                    <View style={styles.outputBody}>{outputBody}</View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.collapsedOutputBar}
                    onPress={() => setIsOutputVisible(true)}
                  >
                    <Text style={styles.outputHeaderTitle}>Output</Text>
                    <Feather
                      name="chevron-up"
                      size={16}
                      color={colors.text3}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.phoneNavBar}>
              <View style={styles.phoneNavLeft}>
                <NavIconButton
                  icon="chevron-left"
                  label="Open files"
                  onPress={() => setPhoneTab("files")}
                />
                <Text style={styles.phoneNavTitle} numberOfLines={1}>
                  {activeDocument?.name ?? "Create a file"}
                </Text>
              </View>

              <View style={styles.phoneNavRight}>
                <RunButton compact disabled={isRunning || !activeDocument} onPress={handleRun} />
                <NavIconButton
                  icon="book-open"
                  label="Open manual"
                  onPress={handleOpenManual}
                />
                <NavIconButton
                  icon="settings"
                  label="Open settings"
                  onPress={() => setPhoneTab("settings")}
                />
              </View>
            </View>
            <View style={styles.divider} />

            {saveError ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{saveError}</Text>
              </View>
            ) : null}

            <View
              style={[styles.phoneBody, { flex: 0, height: phoneBodyVisibleHeight }]}
            >
              <View style={styles.phoneContent}>
                <View
                  pointerEvents={phoneTab === "editor" ? "auto" : "none"}
                  style={[
                    styles.phonePanel,
                    phoneTab !== "editor" && styles.phonePanelHidden,
                  ]}
                >
                  {activeDocument ? (
                    <EditorWebView
                      key={`phone-editor-${activeDocument.id}`}
                      initialValue={activeDocument.source}
                      onChange={updateActiveDocumentSource}
                      diagnostics={compileDiagnostics}
                      restoreToken={editorRestoreToken}
                    />
                  ) : (
                    <StarterPanel
                      onCreateDocument={() => createDocumentInWorkspace()}
                      onCreateFolder={() => createFolderInWorkspace()}
                    />
                  )}
                </View>

                {phoneTab === "files" ? (
                  <View style={styles.phonePanel}>
                    <WorkspaceTree
                      workspace={workspace}
                      activeDocumentId={activeDocument?.id ?? null}
                      onToggleFolder={toggleFolder}
                      onCreateFolder={createFolderInWorkspace}
                      onCreateDocument={createDocumentInWorkspace}
                      onRenameNode={renameNodeInWorkspace}
                      onDeleteNodes={deleteNodesInWorkspace}
                      onMoveNodes={moveNodesInWorkspace}
                      onSelectDocument={(documentId: string) => {
                        selectDocument(documentId);
                        setPhoneTab("editor");
                      }}
                    />
                  </View>
                ) : null}

                {phoneTab === "output" ? (
                  <View style={styles.phoneOutputPanel}>
                    <OutputHeader
                      onClear={clearTerminal}
                      onClose={() => setPhoneTab("editor")}
                    />
                    <View style={styles.outputBody}>{outputBody}</View>
                  </View>
                ) : null}

                {phoneTab === "settings" ? (
                  <PhoneSettingsView
                    activeDocumentName={activeDocument?.name ?? ""}
                    mode={mode}
                    resolvedTheme={resolvedTheme}
                    onSelectMode={setMode}
                    onOpenFiles={() => setPhoneTab("files")}
                    onOpenManual={handleOpenManual}
                    onClearOutput={clearTerminal}
                  />
                ) : null}
              </View>

              {!isKeyboardVisible ? (
                <PhoneTabBar
                  activeTab={phoneTab}
                  onSelect={setPhoneTab}
                  bottomInset={phoneTabBarBottomPadding}
                />
              ) : null}
            </View>
          </>
        )}

        <WebView
          ref={pyodideWebViewRef}
          source={pyodideRunnerHtml}
          pointerEvents="none"
          style={styles.hiddenRunner}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          onMessage={handlePyodideMessage}
          allowFileAccessFromFileURLs
          allowUniversalAccessFromFileURLs
        />
      </View>
    </View>
  );
}

const useStyles = createThemedStyleSheet(({ colors, isDark }) => ({
  safe: {
    flex: 1,
    width: "100%",
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    width: "100%",
    backgroundColor: colors.background,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  verticalDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  iconButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  iconButtonDisabled: {
    opacity: 0.5,
  },
  iconButtonPressed: {
    backgroundColor: colors.hover,
  },
  runButton: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.success,
  },
  runButtonCompact: {
    height: 28,
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  runButtonDisabled: {
    opacity: 0.72,
  },
  runButtonText: {
    color: "#FFFFFF",
    fontFamily: fonts.sans,
    fontSize: 12,
    fontWeight: "600",
  },
  tabletNavBar: {
    height: dimensions.tabletTopBarHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.chrome,
  },
  tabletNavLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tabletNavSeparator: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  tabletNavTitle: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: 17,
    fontWeight: "600",
  },
  tabletNavRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tabletBody: {
    flex: 1,
    flexDirection: "row",
    alignSelf: "stretch",
    minHeight: 0,
  },
  sidebarShell: {
    backgroundColor: colors.sidebarPanel,
  },
  tabletEditorArea: {
    flex: 1,
    alignSelf: "stretch",
    minWidth: 0,
    minHeight: 0,
    backgroundColor: colors.background,
  },
  breadcrumbBar: {
    height: dimensions.tabletBreadcrumbHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
  },
  breadcrumbItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  breadcrumbText: {
    color: colors.textTertiary,
    fontFamily: fonts.sans,
    fontSize: 12,
  },
  breadcrumbTextActive: {
    color: colors.textSecondary,
    fontWeight: "500",
  },
  editorPanel: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.background,
  },
  starterWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: colors.background,
  },
  starterCard: {
    width: "100%",
    maxWidth: 520,
    gap: 14,
    padding: 24,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.panelRaised,
  },
  starterEyebrow: {
    color: colors.accent,
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  starterTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 34,
  },
  starterBody: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 24,
  },
  starterActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 6,
  },
  starterPrimaryButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: colors.accent,
  },
  starterPrimaryButtonText: {
    color: "#FFFFFF",
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "700",
  },
  starterSecondaryButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  starterSecondaryButtonText: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "700",
  },
  outputPanel: {
    minHeight: 0,
    backgroundColor: colors.panel,
  },
  collapsedOutputBar: {
    height: dimensions.collapsedOutputHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: colors.panel,
  },
  outputHeader: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: colors.panel,
  },
  outputHeaderTitle: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "600",
  },
  outputHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  outputHeaderButton: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  outputBody: {
    flex: 1,
    minHeight: 0,
  },
  phoneNavBar: {
    height: dimensions.phoneTopBarHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.chrome,
  },
  phoneNavLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  phoneNavTitle: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: 17,
    fontWeight: "600",
  },
  phoneNavRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  phoneBody: {
    flex: 1,
    minHeight: 0,
  },
  phoneContent: {
    flex: 1,
    minHeight: 0,
    position: "relative",
  },
  phonePanel: {
    ...StyleSheet.absoluteFillObject,
    minHeight: 0,
    backgroundColor: colors.background,
  },
  phonePanelHidden: {
    opacity: 0,
  },
  phoneOutputPanel: {
    ...StyleSheet.absoluteFillObject,
    minHeight: 0,
    backgroundColor: colors.panel,
  },
  phoneTabBarContainer: {
    paddingTop: 6,
    paddingHorizontal: PHONE_TAB_BAR_HORIZONTAL_PADDING,
    backgroundColor: colors.background,
  },
  phoneTabBarPill: {
    height: 58,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 0,
    padding: 5,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panelRaised,
  },
  phoneTabBarItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 24,
  },
  phoneTabBarItemActive: {
    backgroundColor: colors.panelStrong,
  },
  phoneTabBarText: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: "600",
  },
  phoneTabBarTextActive: {
    color: colors.accent,
  },
  settingsScroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  settingsContent: {
    gap: 16,
    padding: 20,
    paddingBottom: 32,
  },
  settingsHero: {
    gap: 8,
  },
  settingsEyebrow: {
    color: colors.textTertiary,
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  settingsTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 32,
  },
  settingsCopy: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  settingsCard: {
    gap: 8,
    padding: 16,
    borderRadius: radii.section,
    backgroundColor: colors.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  settingsLabel: {
    color: colors.textTertiary,
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  settingsValue: {
    color: colors.textPrimary,
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: "600",
  },
  settingsBody: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  settingsActionRow: {
    flexDirection: "row",
    gap: 12,
  },
  settingsAction: {
    flex: 1,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.button,
    backgroundColor: colors.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  settingsActionPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  settingsActionText: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "600",
  },
  settingsActionTextPrimary: {
    color: "#FFFFFF",
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "600",
  },
  settingsBullet: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  themeModeRow: {
    flexDirection: "row",
    gap: 10,
  },
  themeModeButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.compactButton,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.panelRaised,
  },
  themeModeButtonActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  themeModeButtonText: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  themeModeButtonTextActive: {
    color: colors.accent,
  },
  settingsGhostButton: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.button,
    backgroundColor: colors.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  settingsGhostButtonText: {
    color: colors.textSecondary,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "600",
  },
  errorBanner: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: isDark ? "rgba(255,69,58,0.15)" : "rgba(192,59,43,0.12)",
  },
  errorBannerText: {
    color: colors.danger,
    fontFamily: fonts.sans,
    fontSize: 12,
  },
  hiddenRunner: {
    position: "absolute",
    width: 8,
    height: 8,
    opacity: 0.01,
    bottom: 0,
    right: 0,
    zIndex: -1,
  },
}));
