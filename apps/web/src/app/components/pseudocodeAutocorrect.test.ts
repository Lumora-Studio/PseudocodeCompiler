import { describe, expect, it } from "vitest";
import { autoCorrectPseudocodeLine } from "@/app/components/pseudocodeAutocorrect";

const KEYWORDS = [
  "IF",
  "THEN",
  "ELSE",
  "ENDIF",
  "FOR",
  "TO",
  "NEXT",
  "WHILE",
  "DO",
  "ENDWHILE",
  "INPUT",
  "OUTPUT",
  "DECLARE",
  "INTEGER",
  "STRING",
  "BOOLEAN",
  "FUNCTION",
  "RETURNS",
  "CALL",
  "PROCEDURE",
  "ENDPROCEDURE",
  "TRUE",
  "FALSE",
  "AND",
  "OR",
  "NOT",
] as const;

const KEYWORD_LOOKUP = new Map(KEYWORDS.map((keyword) => [keyword.toLowerCase(), keyword]));

describe("autoCorrectPseudocodeLine", () => {
  it("uppercases keywords regardless of typed casing", () => {
    const input = "if score >= 50 then output \"Pass\" endif";
    const output = autoCorrectPseudocodeLine(input, KEYWORD_LOOKUP);
    expect(output).toBe('IF score >= 50 THEN OUTPUT "Pass" ENDIF');
  });

  it("does not change identifiers that only contain keyword fragments", () => {
    const input = "DECLARE OutputScore : INTEGER";
    const output = autoCorrectPseudocodeLine(input, KEYWORD_LOOKUP);
    expect(output).toBe("DECLARE OutputScore : INTEGER");
  });

  it("does not change text inside strings", () => {
    const input = 'OUTPUT "if then else should stay lower"';
    const output = autoCorrectPseudocodeLine(input, KEYWORD_LOOKUP);
    expect(output).toBe('OUTPUT "if then else should stay lower"');
  });

  it("does not change text inside comments", () => {
    const input = "OUTPUT Name // if then else";
    const output = autoCorrectPseudocodeLine(input, KEYWORD_LOOKUP);
    expect(output).toBe("OUTPUT Name // if then else");
  });
});
