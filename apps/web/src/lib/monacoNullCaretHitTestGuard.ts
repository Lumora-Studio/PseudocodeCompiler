type NullHitTestFallback = {
  hitTarget: null;
  type: 0;
};

type CaretPositionLike = {
  offsetNode?: unknown;
} | null;

type HitTestGuardArgs = [
  {
    viewDomNode?: {
      ownerDocument?: {
        caretPositionFromPoint?: (clientX: number, clientY: number) => CaretPositionLike;
      };
    };
  },
  {
    clientX: number;
    clientY: number;
  },
];

type GuardedHitTestFunction<TResult> = (...args: HitTestGuardArgs) => TResult;

const NULL_HIT_TEST_FALLBACK: NullHitTestFallback = {
  type: 0,
  hitTarget: null,
};

const PATCH_MARKER = "__igcseNullCaretHitTestGuardApplied";

let patchPromise: Promise<void> | null = null;

export function createNullCaretHitTestGuard<TResult>(
  originalFn: GuardedHitTestFunction<TResult>,
): GuardedHitTestFunction<TResult | NullHitTestFallback> {
  return (...args) => {
    const [ctx, coords] = args;
    const hitResult = ctx.viewDomNode?.ownerDocument?.caretPositionFromPoint?.(coords.clientX, coords.clientY);

    if (!hitResult?.offsetNode) {
      return NULL_HIT_TEST_FALLBACK;
    }

    return originalFn(...args);
  };
}

export async function ensureMonacoNullCaretHitTestGuard(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  if (patchPromise) {
    return patchPromise;
  }

  patchPromise = import("monaco-editor/esm/vs/editor/browser/controller/mouseTarget.js")
    .then(({ MouseTargetFactory }) => {
      const factory = MouseTargetFactory as typeof MouseTargetFactory & {
        [PATCH_MARKER]?: boolean;
        _doHitTestWithCaretPositionFromPoint?: GuardedHitTestFunction<unknown>;
      };

      if (factory[PATCH_MARKER]) {
        return;
      }

      const originalFn = factory._doHitTestWithCaretPositionFromPoint;
      if (typeof originalFn !== "function") {
        return;
      }

      factory._doHitTestWithCaretPositionFromPoint = createNullCaretHitTestGuard(
        originalFn as GuardedHitTestFunction<unknown>,
      ) as typeof originalFn;
      factory[PATCH_MARKER] = true;
    })
    .catch((error: unknown) => {
      patchPromise = null;

      if (process.env.NODE_ENV !== "production") {
        console.warn("Failed to install Monaco null-caret hit-test guard.", error);
      }
    });

  return patchPromise;
}
