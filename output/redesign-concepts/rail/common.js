(function () {
  const q = new URLSearchParams(location.search);
  const root = document.documentElement;
  if (q.get("theme")) root.dataset.theme = q.get("theme");
  if (q.get("syntax")) root.dataset.syntax = q.get("syntax");
  if (q.has("settings")) root.dataset.settings = "open";
})();
(function () {
  const st = document.createElement("style"); st.textContent = "pre, pre *, code { font-variant-ligatures: none !important; font-feature-settings: \"liga\" 0, \"calt\" 0 !important; }"; document.head.append(st);
  const KW = "DECLARE|CONSTANT|FOR|TO|STEP|NEXT|REPEAT|UNTIL|WHILE|DO|ENDWHILE|IF|THEN|ELSE|ENDIF|CASE|OF|OTHERWISE|ENDCASE|OUTPUT|INPUT|PROCEDURE|ENDPROCEDURE|FUNCTION|RETURNS|RETURN|ENDFUNCTION|CALL";
  const TY = "INTEGER|REAL|STRING|BOOLEAN|CHAR|ARRAY|TRUE|FALSE";
  const re = new RegExp(`(\\/\\/.*$)|("[^"]*")|\\b(${KW})\\b|\\b(${TY})\\b|\\b(\\d+(?:\\.\\d+)?)\\b|(←|<-|<=|>=|<>|\\b(?:AND|OR|NOT|MOD|DIV)\\b|[-+*/=<>&])`, "gm");
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function hl(src) {
    let out = "", last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      const cls = m[1] ? "c" : m[2] ? "s" : m[3] ? "k" : m[4] ? "t" : m[5] ? "n" : "o";
      out += `<span class="tok-${cls}">${esc(m[0] === "<-" ? "←" : m[0])}</span>`;
      last = re.lastIndex;
    }
    return out + esc(src.slice(last));
  }
  document.querySelectorAll("[data-hl]").forEach((el) => {
    const src = el.textContent.replace(/^\n/, "").replace(/\s+$/, "");
    if (el.hasAttribute("data-lines")) {
      const mark = (name) => (el.dataset[name] || "").split(",").filter(Boolean).map(Number);
      const active = mark("active"), error = mark("error"), done = mark("done");
      el.innerHTML = src.split("\n").map((line, i) => {
        const n = i + 1;
        const cls = ["line", active.includes(n) && "is-active", error.includes(n) && "is-error", done.includes(n) && "is-done"].filter(Boolean).join(" ");
        return `<div class="${cls}"><span class="no">${n}</span><span class="src">${hl(line) || " "}</span></div>`;
      }).join("");
    } else {
      el.innerHTML = hl(src);
    }
  });
})();
(function () {
  const P = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    play: '<path d="M6 3 20 12 6 21Z"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    shuffle: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
    sliders: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    out: '<path d="M7 7h10v10M7 17 17 7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  };
  document.querySelectorAll("[data-i]").forEach((el) => {
    el.outerHTML = `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[el.dataset.i] || ""}</svg>`;
  });
})();
