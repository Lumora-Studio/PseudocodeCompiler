"use client";

import { useMemo, useState } from "react";

interface VirtualFilesPanelProps {
  files: Record<string, string[]>;
  onChange: (nextFiles: Record<string, string[]>) => void;
  selectedFileName?: string;
  onSelectedFileNameChange?: (fileName: string | undefined) => void;
}

export function VirtualFilesPanel({
  files,
  onChange,
  selectedFileName,
  onSelectedFileNameChange,
}: VirtualFilesPanelProps) {
  const fileNames = useMemo(() => Object.keys(files).sort(), [files]);
  const [internalSelected, setInternalSelected] = useState<string>(selectedFileName ?? "");
  const [newFileName, setNewFileName] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const fallbackSelected = fileNames[0] ?? "";
  const activeSelected =
    (selectedFileName && files[selectedFileName] ? selectedFileName : "") ||
    (internalSelected && files[internalSelected] ? internalSelected : "") ||
    fallbackSelected;
  const selectedContent = activeSelected ? (files[activeSelected] ?? []).join("\n") : "";

  const updateSelected = (fileName: string | undefined) => {
    setInternalSelected(fileName ?? "");
    onSelectedFileNameChange?.(fileName);
  };

  const handleAddFile = () => {
    const trimmed = newFileName.trim();
    if (!trimmed) {
      setFileError("Enter a file name.");
      return;
    }
    if (files[trimmed]) {
      setFileError("File already exists.");
      return;
    }
    setFileError(null);
    onChange({ ...files, [trimmed]: [] });
    updateSelected(trimmed);
    setNewFileName("");
  };

  const handleDeleteFile = () => {
    if (!activeSelected) {
      return;
    }
    const next = { ...files };
    delete next[activeSelected];
    onChange(next);
    const remaining = Object.keys(next).sort();
    updateSelected(remaining[0] ?? undefined);
  };

  const handleContentChange = (value: string) => {
    if (!activeSelected) {
      return;
    }
    onChange({
      ...files,
      [activeSelected]: value.split("\n"),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={newFileName}
          onChange={(event) => {
            setNewFileName(event.target.value);
            if (fileError) {
              setFileError(null);
            }
          }}
          className="h-8 min-w-[200px] rounded-lg border border-[var(--separator)] bg-[var(--surface)] px-3 font-mono text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          placeholder="FileA.txt"
          aria-label="New virtual file name"
        />
        <button type="button" className="rounded-lg bg-[var(--surface2)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface3)]" onClick={handleAddFile}>
          Add
        </button>
        <button type="button" className="rounded-lg bg-[var(--surface2)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface3)] disabled:opacity-40" onClick={handleDeleteFile} disabled={!activeSelected}>
          Delete
        </button>
      </div>
      {fileError ? <p className="text-sm text-[var(--red)]">{fileError}</p> : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[200px_1fr]">
        <div className="rounded-lg border border-[var(--separator)] bg-[var(--surface)] p-1.5">
          {fileNames.length === 0 ? (
            <p className="p-2 text-sm text-[var(--text2)]">No virtual files.</p>
          ) : (
            <ul className="space-y-0.5">
              {fileNames.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    className={`w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                      activeSelected === name
                        ? "bg-[var(--selected)] text-[var(--text)]"
                        : "text-[var(--text)] hover:bg-[var(--hover)]"
                    }`}
                    onClick={() => updateSelected(name)}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <textarea
          value={selectedContent}
          onChange={(event) => handleContentChange(event.target.value)}
          className="h-40 w-full rounded-lg border border-[var(--separator)] bg-[var(--surface)] p-3 font-mono text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          placeholder={activeSelected ? "One line per record" : "Create a virtual file to edit contents."}
          disabled={!activeSelected}
        />
      </div>
    </div>
  );
}
