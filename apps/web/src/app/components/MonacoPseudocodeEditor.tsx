"use client";

import { useEffect, useMemo, useRef } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { Diagnostic } from "@/compiler/types";
import { autoCorrectPseudocodeLine } from "@/app/components/pseudocodeAutocorrect";
import { isAppleTouchDevice } from "@/lib/appleTouch";
import { getPseudocodeEditorOptions } from "@/lib/pseudocodeEditorOptions";

interface MonacoPseudocodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  diagnostics: Diagnostic[];
}

const TYPE_KEYWORDS = [
  "INTEGER",
  "REAL",
  "CHAR",
  "STRING",
  "BOOLEAN",
];

const ROUTINE_KEYWORDS = [
  "DIV",
  "MOD",
  "LENGTH",
  "LCASE",
  "UCASE",
  "SUBSTRING",
  "ROUND",
  "RANDOM",
];

const FLOW_KEYWORDS = [
  "DECLARE",
  "CONSTANT",
  "ARRAY",
  "OF",
  "INPUT",
  "OUTPUT",
  "IF",
  "THEN",
  "ELSE",
  "ENDIF",
  "CASE",
  "OTHERWISE",
  "ENDCASE",
  "FOR",
  "TO",
  "STEP",
  "NEXT",
  "REPEAT",
  "UNTIL",
  "WHILE",
  "DO",
  "ENDWHILE",
  "PROCEDURE",
  "ENDPROCEDURE",
  "FUNCTION",
  "RETURNS",
  "ENDFUNCTION",
  "CALL",
  "RETURN",
  "OPENFILE",
  "READFILE",
  "WRITEFILE",
  "CLOSEFILE",
  "READ",
  "WRITE",
  "AND",
  "OR",
  "NOT",
  "TRUE",
  "FALSE",
];

const KEYWORDS = [...FLOW_KEYWORDS, ...TYPE_KEYWORDS, ...ROUTINE_KEYWORDS];

const KEYWORD_LOOKUP = new Map(KEYWORDS.map((keyword) => [keyword.toLowerCase(), keyword]));

const ROUTINE_SUGGESTIONS = [
  {
    label: "DIV(Number, Divisor)",
    detail: "Integer quotient",
    insertText: "DIV(${1:Number}, ${2:Divisor})",
  },
  {
    label: "MOD(Number, Divisor)",
    detail: "Integer remainder",
    insertText: "MOD(${1:Number}, ${2:Divisor})",
  },
  {
    label: "LENGTH(Text)",
    detail: "String length",
    insertText: "LENGTH(${1:Text})",
  },
  {
    label: "LCASE(TextOrChar)",
    detail: "Lower-case conversion",
    insertText: "LCASE(${1:TextOrChar})",
  },
  {
    label: "UCASE(TextOrChar)",
    detail: "Upper-case conversion",
    insertText: "UCASE(${1:TextOrChar})",
  },
  {
    label: "SUBSTRING(Text, Start, Length)",
    detail: "Part of a string",
    insertText: "SUBSTRING(${1:Text}, ${2:Start}, ${3:Length})",
  },
  {
    label: "ROUND(Value, Places)",
    detail: "Round a real value",
    insertText: "ROUND(${1:Value}, ${2:Places})",
  },
  {
    label: "RANDOM()",
    detail: "Random number from 0 to 1 inclusive",
    insertText: "RANDOM()",
  },
] as const;

export function MonacoPseudocodeEditor({
  value,
  onChange,
  diagnostics,
}: MonacoPseudocodeEditorProps) {
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const editorRef = useRef<import("monaco-editor").editor.IStandaloneCodeEditor | null>(null);
  const appleTouchDevice = useMemo(() => isAppleTouchDevice(typeof navigator === "undefined" ? undefined : navigator), []);
  const editorOptions = useMemo(() => getPseudocodeEditorOptions(appleTouchDevice), [appleTouchDevice]);

  const markers = useMemo(() => {
    return diagnostics.map((diagnostic) => ({
      startLineNumber: diagnostic.line,
      startColumn: diagnostic.column,
      endLineNumber: diagnostic.endLine,
      endColumn: Math.max(diagnostic.endColumn + 1, diagnostic.column + 1),
      message: `${diagnostic.code}: ${diagnostic.message}${diagnostic.hint ? `\nHint: ${diagnostic.hint}` : ""}`,
      severity:
        diagnostic.severity === "error"
          ? 8
          : diagnostic.severity === "warning"
            ? 4
            : 2,
    }));
  }, [diagnostics]);

  const handleMount: OnMount = (editor, monaco) => {
    monacoRef.current = monaco;
    editorRef.current = editor;

    monaco.languages.register({ id: "igcse-pseudocode" });
    monaco.languages.setMonarchTokensProvider("igcse-pseudocode", {
      tokenizer: {
        root: [
          [/\/\/.*$/, "comment"],
          [new RegExp(`\\b(${ROUTINE_KEYWORDS.join("|")})\\b`), "predefined"],
          [new RegExp(`\\b(${TYPE_KEYWORDS.join("|")})\\b`), "type"],
          [new RegExp(`\\b(${FLOW_KEYWORDS.join("|")})\\b`), "keyword"],
          [/\b[0-9]+\.[0-9]+\b/, "number.float"],
          [/\b[0-9]+\b/, "number"],
          [/"[^"\\n]*"/, "string"],
          [/'[^'\\n]*'/, "string"],
          [/\u2190|<-/, "operator"],
          [/<=|>=|<>|=|<|>|\+|-|\*|\/|\^/, "operator"],
          [/\b[A-Za-z][A-Za-z0-9]*\b/, "identifier"],
          [/[:,()\[\]]/, "delimiter"],
        ],
      },
    });
    monaco.languages.setLanguageConfiguration("igcse-pseudocode", {
      brackets: [
        ["(", ")"],
        ["[", "]"],
      ],
      autoClosingPairs: [
        { open: "\"", close: "\"" },
        { open: "'", close: "'" },
        { open: "(", close: ")" },
        { open: "[", close: "]" },
      ],
      surroundingPairs: [
        { open: "\"", close: "\"" },
        { open: "'", close: "'" },
        { open: "(", close: ")" },
        { open: "[", close: "]" },
      ],
    });

    monaco.languages.registerCompletionItemProvider("igcse-pseudocode", {
      provideCompletionItems(model: Monaco.editor.ITextModel, position: Monaco.Position) {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const keywordSuggestions = KEYWORDS.map((keyword, index) => ({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          range,
          sortText: `1_${String(index).padStart(3, "0")}`,
        }));

        const routineSuggestions = ROUTINE_SUGGESTIONS.map((routine, index) => ({
          label: routine.label,
          detail: routine.detail,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: routine.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          sortText: `0_${String(index).padStart(3, "0")}`,
        }));

        const shorthandSuggestions = [
          {
            label: "PRINT (alias)",
            detail: "Alias for OUTPUT",
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: "OUTPUT ${1:\"text\"}",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            filterText: "print p tab",
            range,
            sortText: "0_001",
          },
          {
            label: "p -> OUTPUT",
            detail: "Quick starter",
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: "OUTPUT ${1:\"text\"}",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            filterText: "p tab",
            range,
            sortText: "0_000",
          },
          {
            label: "o -> OUTPUT",
            detail: "Quick starter",
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: "OUTPUT ${1:\"text\"}",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            filterText: "o tab",
            range,
            sortText: "0_003",
          },
          {
            label: "i -> INPUT",
            detail: "Quick starter",
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: "INPUT ${1:Variable}",
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            filterText: "i tab",
            range,
            sortText: "0_002",
          },
        ];

        return { suggestions: [...routineSuggestions, ...shorthandSuggestions, ...keywordSuggestions] };
      },
    });

    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, "igcse-pseudocode");
    }

    const insertQuotePair = (quote: "\"" | "'") => {
      const model = editor.getModel();
      const selection = editor.getSelection();
      if (!model || !selection) {
        return false;
      }

      const lineContent = model.getLineContent(selection.positionLineNumber);
      const charAfter = lineContent[selection.positionColumn - 1] ?? "";

      if (selection.isEmpty() && charAfter === quote) {
        editor.setPosition({
          lineNumber: selection.positionLineNumber,
          column: selection.positionColumn + 1,
        });
        return true;
      }

      const selectedText = model.getValueInRange(selection);
      editor.executeEdits("quote-pair", [
        {
          range: selection,
          text: `${quote}${selectedText}${quote}`,
          forceMoveMarkers: true,
        },
      ]);

      if (selection.isEmpty()) {
        editor.setPosition({
          lineNumber: selection.positionLineNumber,
          column: selection.positionColumn + 1,
        });
      } else {
        editor.setSelection(
          new monaco.Selection(
            selection.selectionStartLineNumber,
            selection.selectionStartColumn + 1,
            selection.positionLineNumber,
            selection.positionColumn + 1,
          ),
        );
      }
      return true;
    };

    let lastTabKeydownAt = 0;

    editor.onKeyDown((event) => {
      const browserKey = event.browserEvent.key;
      const browserCode = event.browserEvent.code;
      if (browserKey === "Tab") {
        lastTabKeydownAt = Date.now();
      }
      const isQuoteKey =
        browserKey === "\"" ||
        browserKey === "'" ||
        (browserCode === "Quote" && browserKey !== "Dead");
      if (isQuoteKey) {
        const quote = browserKey === "\"" ? "\"" : "'";
        const paired = insertQuotePair(quote);
        if (paired) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    });

    let isProgrammaticEdit = false;
    editor.onDidChangeModelContent((event) => {
      if (isProgrammaticEdit) {
        return;
      }

      const model = editor.getModel();
      if (!model) {
        return;
      }

      if (event.changes.length === 1) {
        const change = event.changes[0];
        if (change.text === "-") {
          const lineNumber = change.range.startLineNumber;
          const insertedAtColumn = change.range.startColumn;
          if (insertedAtColumn > 1) {
            const lineContent = model.getLineContent(lineNumber);
            const previousChar = lineContent[insertedAtColumn - 2] ?? "";
            const currentChar = lineContent[insertedAtColumn - 1] ?? "";
            if (previousChar === "<" && currentChar === "-") {
              isProgrammaticEdit = true;
              editor.executeEdits("arrow-shortcut", [
                {
                  range: new monaco.Range(lineNumber, insertedAtColumn - 1, lineNumber, insertedAtColumn + 1),
                  text: "\u2190",
                  forceMoveMarkers: true,
                },
              ]);
              editor.setPosition({ lineNumber, column: insertedAtColumn });
              isProgrammaticEdit = false;
              return;
            }
          }
        }
      }

      const shouldAutoCorrectForThisChange = Date.now() - lastTabKeydownAt <= 250;
      if (!shouldAutoCorrectForThisChange) {
        return;
      }

      const affectedLines = new Set<number>();
      for (const change of event.changes) {
        const insertedLineCount = change.text.split(/\r?\n/).length - 1;
        const endLine = Math.max(change.range.endLineNumber, change.range.startLineNumber + insertedLineCount);
        for (let line = change.range.startLineNumber; line <= endLine; line += 1) {
          if (line >= 1 && line <= model.getLineCount()) {
            affectedLines.add(line);
          }
        }
      }

      if (affectedLines.size === 0) {
        return;
      }

      const edits: Monaco.editor.IIdentifiedSingleEditOperation[] = [];
      for (const lineNumber of affectedLines) {
        const lineContent = model.getLineContent(lineNumber);
        const correctedLine = autoCorrectPseudocodeLine(lineContent, KEYWORD_LOOKUP);
        if (correctedLine === lineContent) {
          continue;
        }
        edits.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, model.getLineMaxColumn(lineNumber)),
          text: correctedLine,
          forceMoveMarkers: true,
        });
      }

      if (edits.length === 0) {
        return;
      }

      const currentPosition = editor.getPosition();
      isProgrammaticEdit = true;
      editor.executeEdits("keyword-autocorrect", edits);
      if (currentPosition) {
        editor.setPosition(currentPosition);
      }
      isProgrammaticEdit = false;
    });

    // Apple-native dark theme matching UI.pen design
    monaco.editor.defineTheme("examLabTheme", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "FC5FA3" },
        { token: "type", foreground: "5DD8FF" },
        { token: "predefined", foreground: "A167E6" },
        { token: "string", foreground: "FC6A5D" },
        { token: "comment", foreground: "6C7986", fontStyle: "italic" },
        { token: "number", foreground: "D0BF69" },
        { token: "operator", foreground: "E5E5EA" },
        { token: "identifier", foreground: "67B7A4" },
        { token: "delimiter", foreground: "E5E5EA" },
      ],
      colors: {
        "editor.background": "#1C1C1E",
        "editor.foreground": "#E5E5EA",
        "editorLineNumber.foreground": "#48484A",
        "editorLineNumber.activeForeground": "#98989D",
        "editor.lineHighlightBackground": "#2C2C2E",
        "editorCursor.foreground": "#E5E5EA",
        "editor.selectionBackground": "#0A84FF30",
        "editor.inactiveSelectionBackground": "#38383A",
        "editorIndentGuide.background1": "#38383A",
        "editorIndentGuide.activeBackground1": "#48484A",
        "editorWidget.background": "#2C2C2E",
        "editorSuggestWidget.background": "#2C2C2E",
        "editorSuggestWidget.selectedBackground": "#0A84FF30",
      },
    });

    monaco.editor.setTheme("examLabTheme");
  };

  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) {
      return;
    }
    const model = editorRef.current.getModel();
    if (!model) {
      return;
    }
    monacoRef.current.editor.setModelMarkers(model, "igcse-compiler", markers);
  }, [markers]);

  return (
    <Editor
      height="100%"
      defaultLanguage="igcse-pseudocode"
      value={value}
      onChange={(nextValue) => onChange(nextValue ?? "")}
      onMount={handleMount}
      options={editorOptions}
    />
  );
}
