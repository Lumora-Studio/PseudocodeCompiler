import Link from "next/link";
import CopyableCodeBlock from "./CopyableCodeBlock";

type Pattern = {
  title: string;
  whenToUse: string;
  logic: string[];
  template: string;
  walkthrough: string[];
};

type WorkedProgram = {
  title: string;
  objective: string;
  code: string;
  explanation: string[];
  testRun: string[];
};

function ManualCard({
  children,
  className = "",
  accent = false,
  delay = 0,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
  delay?: number;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`manual-card ${accent ? "manual-card-accent" : ""} ${className}`.trim()}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative z-10 p-5 md:p-6">{children}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="manual-section-title">{children}</h2>;
}

function InfoBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="manual-tag mb-3 inline-flex">{children}</div>
  );
}

const commandWords = [
  ["Calculate", "Work out from given facts, figures or information."],
  ["Compare", "Identify and comment on similarities and differences."],
  ["Define", "Give the precise meaning."],
  ["Demonstrate", "Show how, or give an example."],
  ["Describe", "State points, characteristics and main features."],
  ["Evaluate", "Judge quality, importance, amount or value."],
  ["Explain", "Give reasons, show relationships, and support with evidence."],
  ["Give", "Produce an answer from source material or recall."],
  ["Identify", "Name, select or recognise."],
  ["Outline", "Set out main points."],
  ["Show (that)", "Provide structured evidence leading to a result."],
  ["State", "Express in clear terms."],
  ["Suggest", "Apply knowledge to give valid proposals or considerations."],
] as const;

const loopPatterns: Pattern[] = [
  {
    title: "Counted Loop with FOR (Fixed Number of Repeats)",
    whenToUse: "You know exactly how many times the loop must run.",
    logic: [
      "Set loop variable start and end values.",
      "Run body once for each value in the range.",
      "Update totals/counters each cycle.",
      "Exit automatically when range is complete.",
    ],
    template: `DECLARE Count : INTEGER
DECLARE Total : INTEGER
Total <- 0

FOR Count <- 1 TO 10
    Total <- Total + Count
NEXT Count

OUTPUT "Total = ", Total`,
    walkthrough: [
      "Before loop: Total = 0",
      "Count=1 -> Total=1",
      "Count=2 -> Total=3",
      "Count=3 -> Total=6",
      "...",
      "Count=10 -> Total=55 then loop ends",
    ],
  },
  {
    title: "Pre-condition Loop with WHILE (Unknown Repeats)",
    whenToUse: "Repeat while a condition remains TRUE.",
    logic: [
      "Condition is checked before each iteration.",
      "If condition is FALSE at start, loop runs zero times.",
      "Body must change state so condition can eventually become FALSE.",
    ],
    template: `DECLARE Number : INTEGER
INPUT Number

WHILE Number > 9 DO
    Number <- Number - 9
ENDWHILE

OUTPUT Number`,
    walkthrough: [
      "Input 28",
      "28 > 9 true -> Number becomes 19",
      "19 > 9 true -> Number becomes 10",
      "10 > 9 true -> Number becomes 1",
      "1 > 9 false -> exit",
    ],
  },
  {
    title: "Post-condition Loop with REPEAT UNTIL (Validation Loop)",
    whenToUse: "User must do something at least once, then repeat until valid.",
    logic: [
      "Body executes first, then condition is tested.",
      "Best for input validation and menu retries.",
      "Condition should represent the 'valid/finished' state.",
    ],
    template: `DECLARE Password : STRING

REPEAT
    OUTPUT "Enter password"
    INPUT Password
UNTIL Password = "Secret"`,
    walkthrough: [
      "If first entry is wrong, loop repeats.",
      "If first entry is correct, still valid because one run is guaranteed.",
    ],
  },
  {
    title: "Nested FOR Loops (Tables / Grids / 2D Arrays)",
    whenToUse: "Process rows and columns or all combinations of two ranges.",
    logic: [
      "Outer loop controls each row/item group.",
      "Inner loop completes all columns/items for current outer value.",
      "Reset row-level totals before starting inner loop.",
    ],
    template: `DECLARE Row : INTEGER
DECLARE Column : INTEGER
DECLARE RowTotal : INTEGER
DECLARE GrandTotal : INTEGER
DECLARE Amount : ARRAY[1:5, 1:4] OF INTEGER

GrandTotal <- 0
FOR Row <- 1 TO 5
    RowTotal <- 0
    FOR Column <- 1 TO 4
        RowTotal <- RowTotal + Amount[Row, Column]
    NEXT Column
    OUTPUT "Row ", Row, " total = ", RowTotal
    GrandTotal <- GrandTotal + RowTotal
NEXT Row

OUTPUT "Grand total = ", GrandTotal`,
    walkthrough: [
      "Row 1 processes columns 1..4, then outputs row 1 total.",
      "Row 2 starts fresh with RowTotal reset to 0.",
      "After final row, GrandTotal contains sum of all cells.",
    ],
  },
];

const workedPrograms: WorkedProgram[] = [
  {
    title: "Program A: Grade Counter with Selection + Loop",
    objective: "Read 5 marks, count how many are passes (>= 50), and show class average.",
    code: `DECLARE Index : INTEGER
DECLARE Mark : INTEGER
DECLARE Total : INTEGER
DECLARE PassCount : INTEGER
DECLARE Average : REAL

Total <- 0
PassCount <- 0

FOR Index <- 1 TO 5
    OUTPUT "Enter mark ", Index
    INPUT Mark
    Total <- Total + Mark

    IF Mark >= 50
      THEN
        PassCount <- PassCount + 1
    ENDIF
NEXT Index

Average <- Total / 5
OUTPUT "Passes = ", PassCount
OUTPUT "Average = ", Average`,
    explanation: [
      "This is count-controlled because there are exactly 5 marks.",
      "Total accumulates all marks; PassCount tracks a condition inside the loop.",
      "IF branch is optional per iteration; only true marks increment PassCount.",
      "Average is computed once, after loop completes.",
    ],
    testRun: [
      "Input marks: 42, 50, 74, 21, 90",
      "Total = 277",
      "PassCount = 3",
      "Average = 55.4",
    ],
  },
  {
    title: "Program B: Input Validation Menu with REPEAT UNTIL",
    objective: "Accept only menu choices 1 to 4.",
    code: `DECLARE Choice : INTEGER

REPEAT
    OUTPUT "1.View 2.Add 3.Delete 4.Exit"
    INPUT Choice
UNTIL Choice >= 1 AND Choice <= 4

OUTPUT "Accepted choice: ", Choice`,
    explanation: [
      "REPEAT UNTIL is ideal because user must be prompted at least once.",
      "Condition states what valid means, not what invalid means.",
      "Using AND ensures both lower and upper bounds are respected.",
    ],
    testRun: [
      "Input: 8 -> invalid, repeats",
      "Input: 0 -> invalid, repeats",
      "Input: 3 -> valid, exits",
    ],
  },
  {
    title: "Program C: Search in Array with Flag",
    objective: "Find whether a target name exists in StudentNames[1:30].",
    code: `DECLARE StudentNames : ARRAY[1:30] OF STRING
DECLARE Index : INTEGER
DECLARE Target : STRING
DECLARE Found : BOOLEAN

INPUT Target
Found <- FALSE

FOR Index <- 1 TO 30
    IF StudentNames[Index] = Target
      THEN
        Found <- TRUE
    ENDIF
NEXT Index

IF Found = TRUE
  THEN
    OUTPUT "Found"
  ELSE
    OUTPUT "Not found"
ENDIF`,
    explanation: [
      "Found starts FALSE and flips TRUE when match appears.",
      "This variant checks all items; examiners usually accept this clear style.",
      "Final IF uses the flag to output one message.",
    ],
    testRun: [
      'Target = "Ali" and appears at index 7 -> Found becomes TRUE',
      "Output: Found",
    ],
  },
  {
    title: "Program D: Procedure + Function Together",
    objective: "Show reuse: a procedure for display and a function for calculation.",
    code: `PROCEDURE PrintLine(Count : INTEGER)
    DECLARE Index : INTEGER
    FOR Index <- 1 TO Count
        OUTPUT "-"
    NEXT Index
ENDPROCEDURE

FUNCTION SumSquare(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A * A + B * B
ENDFUNCTION

DECLARE Answer : INTEGER
CALL PrintLine(10)
Answer <- SumSquare(3, 4)
OUTPUT "Answer = ", Answer`,
    explanation: [
      "Procedure is called using CALL because it is a full statement.",
      "Function returns a value, so it appears in an expression.",
      "Keeping display logic and calculation logic separate improves clarity.",
    ],
    testRun: [
      "PrintLine outputs 10 dashes.",
      "SumSquare(3,4) returns 25.",
      "Output: Answer = 25",
    ],
  },
];

const fullStructureExample = `// ==================================================
// EXAM-STYLE PSEUDOCODE STRUCTURE
// ==================================================
// 1) Declarations and constants
DECLARE Index : INTEGER
DECLARE Value : INTEGER
DECLARE Total : INTEGER
CONSTANT MaxItems <- 5

// 2) Initialisation
Total <- 0

// 3) Input + processing
FOR Index <- 1 TO MaxItems
    INPUT Value
    Total <- Total + Value
NEXT Index

// 4) Output
OUTPUT "Total = ", Total`;

const fileHandlingExample = `DECLARE FileName : STRING
DECLARE LineText : STRING

FileName <- "Scores.txt"
OPENFILE FileName FOR READ

READFILE FileName, LineText
OUTPUT "First line was: ", LineText

CLOSEFILE FileName`;

const routineSyntaxExample = `LENGTH("Happy Days")
LCASE('W')
UCASE("Happy")
SUBSTRING("Happy Days", 1, 5)
ROUND(15.6789, 2)
RANDOM()

Value <- ROUND(RANDOM() * 6, 0)`;

const traceTableExample = `DECLARE N : INTEGER
DECLARE Fact : INTEGER
DECLARE I : INTEGER

INPUT N
Fact <- 1
FOR I <- 1 TO N
    Fact <- Fact * I
NEXT I
OUTPUT Fact`;

interface ManualContentProps {
  onClose?: () => void;
  isModal?: boolean;
}

export default function ManualContent({ onClose, isModal = false }: ManualContentProps) {
  return (
    <main className={`manual-shell ${isModal ? "" : "min-h-screen"} p-4 md:p-6`}>
      <div className="manual-container mx-auto max-w-6xl space-y-5">
        {/* Hero Card */}
        <ManualCard accent delay={0}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-[16rem]">
              <InfoBadge>Cambridge 0478 Guide</InfoBadge>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)] md:text-3xl">
                Detailed Pseudocode Guidelines
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--text2)]">
                These guidelines are based on Cambridge IGCSE Computer Science (0478) syllabus 2026-2028
                pseudocode conventions from the assessment details section (pages 35-49). They focus on practical writing:
                structuring logic, choosing correct control flow, and building exam-style solutions with clear,
                readable pseudocode.
              </p>
            </div>
            {isModal ? (
              <button
                type="button"
                onClick={onClose}
                className="manual-back-btn shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                Close
              </button>
            ) : (
              <Link href="/" className="manual-back-btn shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                Back to Editor
              </Link>
            )}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="manual-card" style={{ borderRadius: 14 }}>
              <div className="p-3.5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">Important notation note</p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text2)]">
                  Official Cambridge examples use a left-arrow assignment symbol. In this compiler/editor, write
                  assignment as <code className="rounded bg-[var(--surface2)] px-1 py-0.5 text-[var(--code-keyword)]">{"<-"}</code>.
                </p>
              </div>
            </div>
            <div className="manual-card" style={{ borderRadius: 14 }}>
              <div className="p-3.5">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent)]">Editor support</p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text2)]">
                  The editor autocomplete includes DIV, MOD, LENGTH, LCASE, UCASE, SUBSTRING, ROUND, and RANDOM,
                  so the exam-style routine syntax is available while you type.
                </p>
              </div>
            </div>
          </div>
        </ManualCard>

        {/* Navigation */}
        <ManualCard delay={60}>
          <SectionTitle>Quick Navigation</SectionTitle>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { href: "#workflow", label: "Writing Workflow", num: "1" },
              { href: "#syntax", label: "Core Syntax + Routines", num: "2" },
              { href: "#loops", label: "Loop Logic Deep Dive", num: "3" },
              { href: "#patterns", label: "Reusable Coding Patterns", num: "4" },
              { href: "#worked", label: "Fully Worked Programs", num: "5" },
              { href: "#trace", label: "Trace Tables", num: "6" },
              { href: "#files", label: "File Handling", num: "7" },
              { href: "#exam", label: "Exam Command Words", num: "8" },
            ].map((item) => (
              <a key={item.href} href={item.href} className="manual-nav-pill">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface3)] text-[10px] font-bold text-[var(--text3)]">
                  {item.num}
                </span>
                {item.label}
              </a>
            ))}
          </div>
        </ManualCard>

        {/* Section 1 */}
        <ManualCard id="workflow" delay={120}>
          <SectionTitle>Writing Workflow</SectionTitle>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text2)]">
            Use this process every time you solve a question to avoid logic errors.
          </p>
          <ol className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {[
              "Read the problem and identify required inputs and outputs.",
              "Declare every variable/array with correct data type.",
              "Initialize counters/totals/flags before loops.",
              "Choose selection and loop types based on the problem conditions.",
              "Write processing logic in small, readable blocks.",
              "Output final results after processing.",
              "Dry-run with sample values and edge cases.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl bg-[var(--surface)] p-3 text-sm text-[var(--text2)] border border-[var(--separator)]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <CopyableCodeBlock code={fullStructureExample} className="mt-5" />
        </ManualCard>

        {/* Section 2 */}
        <ManualCard id="syntax" delay={180}>
          <SectionTitle>Core Syntax Rules</SectionTitle>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              {
                title: "Formatting and Names",
                points: [
                  "Keywords in UPPER CASE: IF, FOR, WHILE, PROCEDURE.",
                  "Identifiers in PascalCase and starting with capital letter.",
                  "No underscore in identifier names.",
                  "Use comments with //.",
                ],
              },
              {
                title: "Data Types and Constants",
                points: [
                  "INTEGER, REAL, CHAR, STRING, BOOLEAN.",
                  "DECLARE Name : TYPE for variables.",
                  "CONSTANT Name <- literal for constants.",
                  "Constant value must be a literal, not an expression.",
                ],
              },
              {
                title: "Operators",
                points: [
                  "Arithmetic: + - * / ^",
                  "Integer division routines: DIV(a,b), MOD(a,b)",
                  "Relational: = < <= > >= <>",
                  "Logical: AND OR NOT",
                ],
              },
              {
                title: "Common Library Routines",
                points: [
                  "LENGTH(StringValue) returns the number of characters in a string.",
                  "LCASE(StringOrChar) and UCASE(StringOrChar) change case.",
                  "SUBSTRING(StringValue, Start, Length) uses a 1-based start position.",
                  "ROUND(RealValue, Places) rounds a real number to a chosen number of decimal places.",
                  "RANDOM() returns a random number between 0 and 1 inclusive.",
                ],
              },
            ].map((card) => (
              <div key={card.title} className="manual-card" style={{ borderRadius: 16 }}>
                <div className="p-4">
                  <h3 className="text-sm font-bold text-[var(--text)]">{card.title}</h3>
                  <ul className="mt-2.5 space-y-1.5">
                    {card.points.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm text-[var(--text2)]">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          <div className="manual-card mt-4" style={{ borderRadius: 16 }}>
            <div className="p-4">
              <h3 className="text-sm font-bold text-[var(--text)]">Official Routine Syntax</h3>
              <CopyableCodeBlock code={routineSyntaxExample} className="mt-3" />
              <p className="mt-3 text-sm leading-relaxed text-[var(--text2)]">
                Cambridge specifically defines <code className="rounded bg-[var(--surface2)] px-1 py-0.5 text-[var(--code-func)]">ROUND(Value, Places)</code> and <code className="rounded bg-[var(--surface2)] px-1 py-0.5 text-[var(--code-func)]">RANDOM()</code>, and
                both routines are available in this editor&apos;s autocomplete.
              </p>
            </div>
          </div>
        </ManualCard>

        {/* Section 3 */}
        <ManualCard id="loops" delay={240}>
          <SectionTitle>Loop Logic Deep Dive</SectionTitle>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text2)]">
            Students lose marks by choosing the wrong loop type or by writing loops that never terminate.
            Understand the condition timing and state changes in every cycle.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              {
                title: "FOR Loop",
                points: [
                  "Use FOR when iteration count is known.",
                  "Bounds are inclusive, so FOR I <- 1 TO 5 runs 5 times.",
                  "STEP can be positive or negative.",
                ],
              },
              {
                title: "WHILE Loop",
                points: [
                  "Condition checked before loop body.",
                  "Can execute zero times if initial condition is FALSE.",
                  "Update variables inside loop so condition can become FALSE.",
                ],
              },
              {
                title: "REPEAT UNTIL",
                points: [
                  "Loop body executes before condition check.",
                  "Always executes at least once.",
                  "Use UNTIL valid condition for input validation patterns.",
                ],
              },
            ].map((card) => (
              <div key={card.title} className="manual-card" style={{ borderRadius: 16 }}>
                <div className="p-4">
                  <h3 className="text-sm font-bold text-[var(--text)]">{card.title}</h3>
                  <ul className="mt-2.5 space-y-1.5">
                    {card.points.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm text-[var(--text2)]">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
          <div className="manual-card mt-4" style={{ borderRadius: 16 }}>
            <div className="p-4">
              <h3 className="text-sm font-bold text-[var(--text)]">Termination Checklist</h3>
              <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {[
                  "Does each iteration change state?",
                  "Can condition eventually become FALSE (WHILE) or TRUE (UNTIL)?",
                  "Are bounds correct (no off-by-one mistakes)?",
                  "Have you initialized counters/totals before the loop?",
                ].map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-[var(--text2)]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--green)]" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ManualCard>

        {/* Section 4 */}
        <ManualCard id="patterns" delay={300}>
          <SectionTitle>Reusable Coding Patterns</SectionTitle>
          <div className="mt-4 grid gap-4">
            {loopPatterns.map((pattern, i) => (
              <div key={pattern.title} className="manual-card" style={{ borderRadius: 18 }}>
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)] text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <h3 className="text-sm font-bold text-[var(--text)]">{pattern.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--text2)]">
                    <span className="font-semibold text-[var(--text)]">When to use:</span> {pattern.whenToUse}
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {pattern.logic.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-[var(--text2)]">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <CopyableCodeBlock code={pattern.template} className="mt-4" />
                  <div className="mt-4 rounded-xl bg-[var(--surface)] p-3.5 border border-[var(--separator)]">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)]">Logic walkthrough</p>
                    <ul className="mt-2 space-y-1">
                      {pattern.walkthrough.map((step) => (
                        <li key={step} className="flex items-start gap-2 text-sm text-[var(--text2)]">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--text3)]" />
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ManualCard>

        {/* Section 5 */}
        <ManualCard id="worked" delay={360}>
          <SectionTitle>Fully Worked Programs</SectionTitle>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text2)]">
            These are full exam-style answers showing declarations, control flow, and output.
          </p>
          <div className="mt-4 grid gap-4">
            {workedPrograms.map((program, i) => (
              <div key={program.title} className="manual-card" style={{ borderRadius: 18 }}>
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--orange)] text-xs font-bold text-white">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <h3 className="text-sm font-bold text-[var(--text)]">{program.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--text2)]">
                    <span className="font-semibold text-[var(--text)]">Objective:</span> {program.objective}
                  </p>
                  <CopyableCodeBlock code={program.code} className="mt-4" />
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-[var(--surface)] p-3.5 border border-[var(--separator)]">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)]">How the logic works</p>
                      <ul className="mt-2 space-y-1">
                        {program.explanation.map((line) => (
                          <li key={line} className="flex items-start gap-2 text-sm text-[var(--text2)]">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--text3)]" />
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl bg-[var(--surface)] p-3.5 border border-[var(--separator)]">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--green)]">Sample run</p>
                      <ul className="mt-2 space-y-1">
                        {program.testRun.map((line) => (
                          <li key={line} className="flex items-start gap-2 text-sm text-[var(--text2)]">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--green)]" />
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ManualCard>

        {/* Section 6 */}
        <ManualCard id="trace" delay={420}>
          <SectionTitle>Trace Tables and Dry Runs</SectionTitle>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text2)]">
            In exams, a fast dry-run catches most logical mistakes. Track key variables after each iteration.
          </p>
          <CopyableCodeBlock code={traceTableExample} className="mt-4" />
          <div className="manual-table-wrap mt-4">
            <table>
              <thead>
                <tr>
                  <th>I</th>
                  <th>Fact before</th>
                  <th>Fact after Fact {"<-"} Fact * I</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [1, 1, 1],
                  [2, 1, 2],
                  [3, 2, 6],
                  [4, 6, 24],
                  [5, 24, 120],
                ].map(([i, before, after]) => (
                  <tr key={i}>
                    <td>{i}</td>
                    <td>{before}</td>
                    <td>{after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[var(--text2)]">
            For N = 5, expected output is 120. If your trace table and output disagree, debug the loop boundaries
            and initial value.
          </p>
        </ManualCard>

        {/* Section 7 */}
        <ManualCard id="files" delay={480}>
          <SectionTitle>File Handling Guide</SectionTitle>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {[
              "Declare file name and data variables.",
              "OPENFILE with FOR READ or FOR WRITE.",
              "Use READFILE/WRITEFILE operations.",
              "CLOSEFILE when finished.",
            ].map((step, i) => (
              <div key={i} className="manual-card" style={{ borderRadius: 14 }}>
                <div className="p-3.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] text-[10px] font-bold text-white mb-2">
                    {i + 1}
                  </span>
                  <p className="text-sm text-[var(--text2)]">{step}</p>
                </div>
              </div>
            ))}
          </div>
          <CopyableCodeBlock code={fileHandlingExample} className="mt-4" />
          <div className="manual-card mt-3" style={{ borderRadius: 14 }}>
            <div className="p-3.5">
              <p className="text-sm leading-relaxed text-[var(--text2)]">
                Avoid opening the same file in both READ and WRITE simultaneously, and always close files even in
                short algorithms.
              </p>
            </div>
          </div>
        </ManualCard>

        {/* Section 8 */}
        <ManualCard id="exam" delay={540}>
          <SectionTitle>Exam Command Words</SectionTitle>
          <div className="manual-table-wrap mt-4">
            <table>
              <thead>
                <tr>
                  <th>Command Word</th>
                  <th>Meaning in Answers</th>
                </tr>
              </thead>
              <tbody>
                {commandWords.map(([word, meaning]) => (
                  <tr key={word}>
                    <td className="font-semibold text-[var(--text)]">{word}</td>
                    <td>{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ManualCard>

        {/* Final Checklist */}
        <ManualCard delay={600}>
          <SectionTitle>Final Checklist Before Submitting</SectionTitle>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {[
              "All variables/arrays declared with correct data types.",
              "Initial values set for counters, totals, and flags.",
              "Correct loop choice: FOR vs WHILE vs REPEAT UNTIL.",
              "All IF/CASE/loop blocks properly ended.",
              "Procedure calls use CALL; function calls appear in expressions.",
              "Outputs match the question requirements exactly.",
              "Built-in routines such as ROUND() and RANDOM() use the correct syntax.",
              "Dry-run tested with normal and edge-case inputs.",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl bg-[var(--surface)] p-3 text-sm text-[var(--text2)] border border-[var(--separator)]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-[var(--green)]/15 text-[var(--green)]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                </span>
                {item}
              </div>
            ))}
          </div>
        </ManualCard>
      </div>
    </main>
  );
}
