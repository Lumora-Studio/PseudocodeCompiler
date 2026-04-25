import { describe, expect, it, vi } from "vitest";
import { createNullCaretHitTestGuard } from "@/lib/monacoNullCaretHitTestGuard";

describe("createNullCaretHitTestGuard", () => {
  it("returns an unknown hit-test result when caretPositionFromPoint returns null", () => {
    const originalFn = vi.fn(() => ({ type: 1 }));
    const guardedFn = createNullCaretHitTestGuard(originalFn);

    const result = guardedFn(
      {
        viewDomNode: {
          ownerDocument: {
            caretPositionFromPoint: () => null,
          },
        },
      },
      { clientX: 10, clientY: 20 },
    );

    expect(result).toEqual({ type: 0, hitTarget: null });
    expect(originalFn).not.toHaveBeenCalled();
  });

  it("returns an unknown hit-test result when the browser omits offsetNode", () => {
    const originalFn = vi.fn(() => ({ type: 1 }));
    const guardedFn = createNullCaretHitTestGuard(originalFn);

    const result = guardedFn(
      {
        viewDomNode: {
          ownerDocument: {
            caretPositionFromPoint: () => ({ offsetNode: null }),
          },
        },
      },
      { clientX: 30, clientY: 40 },
    );

    expect(result).toEqual({ type: 0, hitTarget: null });
    expect(originalFn).not.toHaveBeenCalled();
  });

  it("delegates to Monaco when the browser returns a valid caret position", () => {
    const originalFn = vi.fn(() => ({ type: 1, position: { lineNumber: 1, column: 2 } }));
    const guardedFn = createNullCaretHitTestGuard(originalFn);
    const offsetNode = {};

    const result = guardedFn(
      {
        viewDomNode: {
          ownerDocument: {
            caretPositionFromPoint: () => ({ offsetNode }),
          },
        },
      },
      { clientX: 50, clientY: 60 },
    );

    expect(result).toEqual({ type: 1, position: { lineNumber: 1, column: 2 } });
    expect(originalFn).toHaveBeenCalledOnce();
  });
});
