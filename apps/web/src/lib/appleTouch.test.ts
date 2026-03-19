import { describe, expect, it } from "vitest";
import { isAppleTouchDevice, supportsDesktopNativeDragAndDrop } from "@/lib/appleTouch";
import { getPseudocodeEditorOptions } from "@/lib/pseudocodeEditorOptions";

describe("appleTouch platform helpers", () => {
  it("detects iPhone and iPad user agents as Apple touch devices", () => {
    expect(
      isAppleTouchDevice({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
        platform: "iPhone",
        maxTouchPoints: 5,
      }),
    ).toBe(true);

    expect(
      isAppleTouchDevice({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe(true);
  });

  it("allows desktop native drag-and-drop for non-touch desktops and disables coarse pointers", () => {
    const coarsePointerMatchMedia = () => ({ matches: true });
    const finePointerMatchMedia = () => ({ matches: false });

    expect(
      supportsDesktopNativeDragAndDrop(finePointerMatchMedia, {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0)",
        platform: "MacIntel",
        maxTouchPoints: 0,
      }),
    ).toBe(true);

    expect(
      supportsDesktopNativeDragAndDrop(finePointerMatchMedia, {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe(false);

    expect(
      supportsDesktopNativeDragAndDrop(coarsePointerMatchMedia, {
        userAgent: "Mozilla/5.0 (Linux; Android 15)",
        platform: "Linux armv8l",
        maxTouchPoints: 5,
      }),
    ).toBe(false);

    expect(
      supportsDesktopNativeDragAndDrop(undefined, {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        platform: "Win32",
        maxTouchPoints: 0,
      }),
    ).toBe(true);
  });

  it("disables Monaco editContext on Apple touch devices", () => {
    expect(getPseudocodeEditorOptions(true).editContext).toBe(false);
    expect(getPseudocodeEditorOptions(false).editContext).toBe(true);
  });
});
