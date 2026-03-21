import { useEffect, useMemo, useState } from "react";
import {
  Keyboard,
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
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as ScreenOrientation from "expo-screen-orientation";
import { WebView } from "react-native-webview";
import { EditorWebView } from "../components/EditorWebView";
import { Terminal } from "../components/Terminal";
import { WorkspaceTree } from "../components/WorkspaceTree";
import { colors, dimensions, fonts, radii } from "../lib/theme";
import { useCompilerWorkspace } from "../lib/useCompilerWorkspace";

// @ts-expect-error Expo bundles local HTML assets for WebView sources.
import pyodideRunnerHtml from "../assets/pyodide-runner.html";

type PhoneTab = "editor" | "files" | "output" | "settings";

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

function PhoneSettingsView({
  activeDocumentName,
  onOpenFiles,
  onOpenManual,
  onClearOutput,
}: {
  activeDocumentName: string;
  onOpenFiles: () => void;
  onOpenManual: () => void;
  onClearOutput: () => void;
}) {
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
        <Text style={styles.settingsLabel}>Current file</Text>
        <Text style={styles.settingsValue}>{activeDocumentName}</Text>
        <Text style={styles.settingsBody}>
          Open the Files tab to switch documents or create new pseudocode files inside the seeded starter workspace.
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
  const tabs = [
    { key: "editor" as const, label: "EDITOR", icon: "code" as const },
    { key: "files" as const, label: "FILES", icon: "folder" as const },
    { key: "output" as const, label: "OUTPUT", icon: "terminal" as const },
    { key: "settings" as const, label: "SETTINGS", icon: "settings" as const },
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
                size={15}
                color={isActive ? "#FFFFFF" : colors.text3}
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
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const { width, height } = frame;
  const shortestSide = Math.min(width, height);
  const platformWithPad = Platform as typeof Platform & { isPad?: boolean };
  const isTabletLayout =
    (Platform.OS === "ios" && platformWithPad.isPad === true) ||
    shortestSide >= 744;

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isOutputVisible, setIsOutputVisible] = useState(true);
  const [phoneTab, setPhoneTab] = useState<PhoneTab>("editor");

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

  useEffect(() => {
    const handleKeyboardShow = () => setIsKeyboardVisible(true);
    const handleKeyboardHide = () => setIsKeyboardVisible(false);

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

    return () => {
      showSubscription.remove();
      showFallbackSubscription.remove();
      hideSubscription.remove();
      hideFallbackSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isTabletLayout || phoneTab === "editor") {
      return;
    }

    Keyboard.dismiss();
  }, [isTabletLayout, phoneTab]);

  const visibleBreadcrumbs = useMemo(() => {
    return breadcrumbs.filter((node) => node.parentId !== null);
  }, [breadcrumbs]);

  const phoneTabBarBottomPadding = 21;
  const screenHeight = height - insets.top - insets.bottom;
  const phoneBodyHeight = Math.max(
    0,
    screenHeight -
      dimensions.phoneTopBarHeight -
      StyleSheet.hairlineWidth -
      (saveError ? 24 : 0),
  );
  const tabletBodyHeight = Math.max(
    0,
    screenHeight - dimensions.tabletTopBarHeight - StyleSheet.hairlineWidth,
  );
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

  if (!workspace || !activeDocument) {
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
                  {activeDocument.name}
                </Text>
              </View>

              <View style={styles.tabletNavRight}>
                <RunButton disabled={isRunning} onPress={handleRun} />
                <NavIconButton
                  icon="book-open"
                  label="Open manual"
                  onPress={() => router.push("/manual")}
                />
                <NavIconButton
                  icon="settings"
                  label="Settings coming soon"
                  onPress={() => {}}
                  disabled
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
              style={[styles.tabletBody, { flex: 0, height: tabletBodyHeight }]}
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
                      activeDocumentId={activeDocument.id}
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
                    : [activeDocument]
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
                  <EditorWebView
                    initialValue={activeDocument.source}
                    onChange={updateActiveDocumentSource}
                    diagnostics={compileDiagnostics}
                  />
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
                  {activeDocument.name}
                </Text>
              </View>

              <View style={styles.phoneNavRight}>
                <RunButton compact disabled={isRunning} onPress={handleRun} />
                <NavIconButton
                  icon="book-open"
                  label="Open manual"
                  onPress={() => router.push("/manual")}
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

            <View style={[styles.phoneBody, { flex: 0, height: phoneBodyHeight }]}>
              <View style={styles.phoneContent}>
                <View
                  pointerEvents={phoneTab === "editor" ? "auto" : "none"}
                  style={[
                    styles.phonePanel,
                    phoneTab !== "editor" && styles.phonePanelHidden,
                  ]}
                >
                  <EditorWebView
                    initialValue={activeDocument.source}
                    onChange={updateActiveDocumentSource}
                    diagnostics={compileDiagnostics}
                  />
                </View>

                {phoneTab === "files" ? (
                  <View style={styles.phonePanel}>
                    <WorkspaceTree
                      workspace={workspace}
                      activeDocumentId={activeDocument.id}
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
                    activeDocumentName={activeDocument.name}
                    onOpenFiles={() => setPhoneTab("files")}
                    onOpenManual={() => router.push("/manual")}
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    width: "100%",
    backgroundColor: colors.bg,
  },
  screen: {
    flex: 1,
    width: "100%",
    backgroundColor: colors.bg,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: colors.text2,
    fontFamily: fonts.sans,
    fontSize: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  verticalDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
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
    backgroundColor: colors.green,
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
    backgroundColor: colors.separator,
  },
  tabletNavTitle: {
    flexShrink: 1,
    color: colors.text,
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
    backgroundColor: colors.sidebar,
  },
  workspaceShell: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.sidebar,
    overflow: "hidden",
  },
  workspaceHeader: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 16,
  },
  workspaceHeaderTitle: {
    color: colors.text2,
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  workspaceHeaderButton: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  workspaceHeaderButtonPressed: {
    backgroundColor: colors.hover,
  },
  workspaceList: {
    flex: 1,
    minHeight: 0,
  },
  workspaceListContent: {
    paddingTop: 4,
    paddingRight: 8,
    paddingBottom: 10,
    paddingLeft: 8,
    gap: 1,
  },
  workspaceRow: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 8,
    borderRadius: 6,
  },
  workspaceRowActive: {
    backgroundColor: colors.selected,
  },
  workspaceRowPressed: {
    backgroundColor: colors.hover,
  },
  workspaceChevron: {
    marginRight: -2,
  },
  workspaceRowText: {
    flex: 1,
    minWidth: 0,
    color: colors.text2,
    fontFamily: fonts.sans,
    fontSize: 13,
  },
  workspaceRowTextMuted: {
    color: colors.text2,
  },
  workspaceRowTextOpenFolder: {
    color: colors.text,
  },
  workspaceRowTextActive: {
    color: colors.text,
  },
  tabletEditorArea: {
    flex: 1,
    alignSelf: "stretch",
    minWidth: 0,
    minHeight: 0,
    backgroundColor: colors.bg,
  },
  breadcrumbBar: {
    height: dimensions.tabletBreadcrumbHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    backgroundColor: colors.bg,
  },
  breadcrumbItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  breadcrumbText: {
    color: colors.text3,
    fontFamily: fonts.sans,
    fontSize: 12,
  },
  breadcrumbTextActive: {
    color: colors.text2,
    fontWeight: "500",
  },
  editorPanel: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.bg,
  },
  outputPanel: {
    minHeight: 0,
    backgroundColor: colors.surface,
  },
  collapsedOutputBar: {
    height: dimensions.collapsedOutputHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
  },
  outputHeader: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
  },
  outputHeaderTitle: {
    color: colors.text2,
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
    color: colors.text,
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
    backgroundColor: colors.bg,
  },
  phonePanelHidden: {
    opacity: 0,
  },
  phoneOutputPanel: {
    ...StyleSheet.absoluteFillObject,
    minHeight: 0,
    backgroundColor: colors.surface,
  },
  phoneTabBarContainer: {
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.bg,
  },
  phoneTabBarPill: {
    height: 50,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 0,
    padding: 4,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    backgroundColor: colors.surface,
  },
  phoneTabBarItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: 22,
  },
  phoneTabBarItemActive: {
    backgroundColor: colors.accent,
  },
  phoneTabBarText: {
    color: colors.text3,
    fontFamily: fonts.sans,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  phoneTabBarTextActive: {
    color: "#FFFFFF",
  },
  settingsScroll: {
    flex: 1,
    backgroundColor: colors.bg,
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
    color: colors.text3,
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  settingsTitle: {
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 32,
  },
  settingsCopy: {
    color: colors.text2,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  settingsCard: {
    gap: 8,
    padding: 16,
    borderRadius: radii.section,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  settingsLabel: {
    color: colors.text3,
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  settingsValue: {
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: "600",
  },
  settingsBody: {
    color: colors.text2,
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
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  settingsActionPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  settingsActionText: {
    color: colors.text2,
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
    color: colors.text2,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
  },
  settingsGhostButton: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.button,
    backgroundColor: colors.surface,
  },
  settingsGhostButtonText: {
    color: colors.text2,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "600",
  },
  errorBanner: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "rgba(255,69,58,0.15)",
  },
  errorBannerText: {
    color: colors.red,
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
});
