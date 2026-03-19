function findCommentStart(line: string): number {
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < line.length; index += 1) {
    const current = line[index];
    const next = line[index + 1] ?? "";

    if (!quote && current === "/" && next === "/") {
      return index;
    }

    if (!quote && (current === '"' || current === "'")) {
      quote = current;
      continue;
    }

    if (quote && current === quote) {
      quote = null;
    }
  }

  return -1;
}

function uppercaseKeywordsOutsideLiterals(code: string, keywordLookup: ReadonlyMap<string, string>): string {
  let result = "";
  let index = 0;
  let quote: '"' | "'" | null = null;

  while (index < code.length) {
    const char = code[index];

    if (!quote && (char === '"' || char === "'")) {
      quote = char;
      result += char;
      index += 1;
      continue;
    }

    if (quote) {
      result += char;
      if (char === quote) {
        quote = null;
      }
      index += 1;
      continue;
    }

    if (/[A-Za-z]/.test(char)) {
      let end = index + 1;
      while (end < code.length && /[A-Za-z0-9]/.test(code[end])) {
        end += 1;
      }

      const word = code.slice(index, end);
      const normalized = keywordLookup.get(word.toLowerCase()) ?? word;
      result += normalized;
      index = end;
      continue;
    }

    result += char;
    index += 1;
  }

  return result;
}

export function autoCorrectPseudocodeLine(line: string, keywordLookup: ReadonlyMap<string, string>): string {
  const commentStart = findCommentStart(line);
  if (commentStart < 0) {
    return uppercaseKeywordsOutsideLiterals(line, keywordLookup);
  }

  const code = line.slice(0, commentStart);
  const comment = line.slice(commentStart);
  return `${uppercaseKeywordsOutsideLiterals(code, keywordLookup)}${comment}`;
}
