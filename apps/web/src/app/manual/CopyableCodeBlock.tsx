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
    <div className={`manual-code-block ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--separator)]/60 px-4 py-2.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
          Pseudocode
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="manual-nav-pill !px-3 !py-1 !text-[11px]"
          aria-label={copyState === "copied" ? "Code copied to clipboard" : "Copy code to clipboard"}
        >
          {buttonLabel}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed">{code}</pre>
      {copyState === "error" ? (
        <p className="px-4 pb-3 text-[11px] text-[var(--red)]">Clipboard access is unavailable here.</p>
      ) : null}
    </div>
  );
}
