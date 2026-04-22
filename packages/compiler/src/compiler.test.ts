import { describe, expect, it } from "vitest";
import { compilePseudocode } from "./index";

describe("compilePseudocode", () => {
  it("compiles valid pseudocode into Python", () => {
    const source = `DECLARE Total : INTEGER
DECLARE Index : INTEGER
FOR Index <- 1 TO 3
    Total <- Total + Index
NEXT Index
OUTPUT Total`;

    const result = compilePseudocode({ source, filename: "main.pseudo", strict: true });

    expect(result.success).toBe(true);
    expect(result.pythonCode).toContain("for Index in __inclusive_range(1, 3, 1):");
    expect(result.pythonCode).toContain("__output(Total)");
  });

  it("returns syntax diagnostics for malformed IF blocks", () => {
    const source = `DECLARE Score : INTEGER
IF Score > 10 THEN
    OUTPUT \"High\"`;

    const result = compilePseudocode({ source, filename: "main.pseudo", strict: true });

    expect(result.success).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "SYN018")).toBe(true);
  });

  it("returns semantic diagnostics for undeclared identifiers", () => {
    const source = `Value <- 7`;

    const result = compilePseudocode({ source, filename: "main.pseudo", strict: true });

    expect(result.success).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "SEM019")).toBe(true);
  });

  it("returns semantic diagnostics for array index dimension mismatch", () => {
    const source = `DECLARE Grid : ARRAY[1:3, 1:3] OF INTEGER
DECLARE Value : INTEGER
Value <- Grid[1]`;

    const result = compilePseudocode({ source, filename: "main.pseudo", strict: true });

    expect(result.success).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "SEM027")).toBe(true);
  });

  it("returns semantic diagnostics for READFILE on WRITE mode", () => {
    const source = `DECLARE Line : STRING
OPENFILE \"FileA.txt\" FOR WRITE
READFILE \"FileA.txt\", Line`;

    const result = compilePseudocode({ source, filename: "main.pseudo", strict: true });

    expect(result.success).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "SEM015")).toBe(true);
  });
});
