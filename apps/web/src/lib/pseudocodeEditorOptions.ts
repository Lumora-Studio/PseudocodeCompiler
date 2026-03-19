import type * as Monaco from "monaco-editor";

export function getPseudocodeEditorOptions(
  appleTouchDevice: boolean,
): Monaco.editor.IStandaloneEditorConstructionOptions {
  return {
    minimap: { enabled: false },
    fontFamily: "'Fira Code', monospace",
    fontSize: 13,
    lineHeight: 21,
    lineNumbers: "on",
    lineNumbersMinChars: 3,
    roundedSelection: false,
    automaticLayout: true,
    renderLineHighlight: "all",
    scrollBeyondLastLine: false,
    padding: {
      top: 8,
      bottom: 18,
    },
    quickSuggestions: {
      other: true,
      comments: false,
      strings: false,
    },
    scrollbar: {
      verticalScrollbarSize: 10,
      horizontalScrollbarSize: 10,
    },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: "off",
    acceptSuggestionOnCommitCharacter: false,
    autoClosingQuotes: "always",
    autoClosingBrackets: "always",
    autoSurround: "quotes",
    wordBasedSuggestions: "off",
    snippetSuggestions: "top",
    tabCompletion: "on",
    // Safari on iPhone/iPad exposes EditContext, but Monaco input handling is unreliable there.
    editContext: !appleTouchDevice,
  };
}
