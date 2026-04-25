"use client";

import { useEffect, useRef, useState } from "react";

type CopyState = "idle" | "copied" | "error";

function fallbackCopy(text: string) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();

  const didCopy = document.execCommand("copy");
  document.body.removeChild(textArea);

  if (!didCopy) {
    throw new Error("Copy failed");
  }
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  fallbackCopy(text);
}

export default function CopyableCodeBlock({
  code,
  className = "",
}: {
  code: string;
  className?: string;
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    try {
      await copyToClipboard(code);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }

    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = setTimeout(() => {
      setCopyState("idle");
    }, 1600);
  }

  const buttonLabel = copyState === "copied" ? "Copied" : "Copy";

  return (
    <div className={`rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--panel-border)] px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Pseudocode Compiler
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="ui-button px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
          aria-label={copyState === "copied" ? "Code copied to clipboard" : "Copy code to clipboard"}
        >
          {buttonLabel}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs">{code}</pre>
      {copyState === "error" ? (
        <p className="px-3 pb-3 text-[11px] text-[var(--danger)]">Clipboard access is unavailable here.</p>
      ) : null}
    </div>
  );
}
