import { describe, expect, it } from "vitest";
import { shouldEnableVercelTelemetry } from "@/lib/vercelTelemetry";

describe("shouldEnableVercelTelemetry", () => {
  it("disables Vercel telemetry for the local desktop runtime", () => {
    expect(shouldEnableVercelTelemetry("local")).toBe(false);
  });

  it("enables Vercel telemetry for hosted web builds", () => {
    expect(shouldEnableVercelTelemetry("cloud")).toBe(true);
    expect(shouldEnableVercelTelemetry(undefined)).toBe(true);
  });
});
