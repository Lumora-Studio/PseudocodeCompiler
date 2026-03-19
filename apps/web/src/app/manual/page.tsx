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
      "Target = \"Ali\" and appears at index 7 -> Found becomes TRUE",
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

export default function ManualPage() {
  return (
    <main className="exam-shell min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="panel rounded-xl p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">Cambridge 0478 Guide</p>
              <h1 className="mt-1 text-2xl font-semibold text-[var(--text)] md:text-3xl">
                Detailed IGCSE Pseudocode Guidelines
              </h1>
            </div>
            <Link href="/" className="ui-button">
              Back to Editor
            </Link>
          </div>
          <p className="mt-3 max-w-4xl text-sm text-[var(--muted)]">
            These guidelines are based on Cambridge IGCSE Computer Science (0478) syllabus 2026-2028
            pseudocode conventions from the assessment details section (pages 35-49). They focus on practical writing:
            structuring logic, choosing correct control flow, and building exam-style solutions with clear,
            readable pseudocode.
          </p>
          <div className="mt-4 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 text-sm">
            <p className="font-semibold text-[var(--accent)]">Important notation note</p>
            <p className="mt-1 text-[var(--muted)]">
              Official Cambridge examples use a left-arrow assignment symbol. In this compiler/editor, write
              assignment as <code>{"<-"}</code>.
            </p>
          </div>
          <div className="mt-3 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 text-sm">
            <p className="font-semibold text-[var(--accent)]">Editor support</p>
            <p className="mt-1 text-[var(--muted)]">
              The editor autocomplete includes DIV, MOD, LENGTH, LCASE, UCASE, SUBSTRING, ROUND, and RANDOM,
              so the exam-style routine syntax is available while you type.
            </p>
          </div>
        </header>

        <section className="panel rounded-xl p-4 md:p-6">
          <h2 className="text-lg font-semibold">Quick Navigation</h2>
          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            <a href="#workflow" className="ui-button text-center">
              1. Writing Workflow
            </a>
            <a href="#syntax" className="ui-button text-center">
              2. Core Syntax + Routines
            </a>
            <a href="#loops" className="ui-button text-center">
              3. Loop Logic Deep Dive
            </a>
            <a href="#patterns" className="ui-button text-center">
              4. Reusable Coding Patterns
            </a>
            <a href="#worked" className="ui-button text-center">
              5. Fully Worked Programs
            </a>
            <a href="#trace" className="ui-button text-center">
              6. Trace Tables
            </a>
            <a href="#files" className="ui-button text-center">
              7. File Handling
            </a>
            <a href="#exam" className="ui-button text-center">
              8. Exam Command Words
            </a>
          </div>
        </section>

        <section id="workflow" className="panel rounded-xl p-4 md:p-6">
          <h2 className="text-lg font-semibold">1) Writing Workflow (How to Build Logic Correctly)</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Use this process every time you solve a question to avoid logic errors.
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
            <li>Read the problem and identify required inputs and outputs.</li>
            <li>Declare every variable/array with correct data type.</li>
            <li>Initialize counters/totals/flags before loops.</li>
            <li>Choose selection and loop types based on the problem conditions.</li>
            <li>Write processing logic in small, readable blocks.</li>
            <li>Output final results after processing.</li>
            <li>Dry-run with sample values and edge cases.</li>
          </ol>
          <CopyableCodeBlock code={fullStructureExample} className="mt-4" />
        </section>

        <section id="syntax" className="panel rounded-xl p-4 md:p-6">
          <h2 className="text-lg font-semibold">2) Core Syntax Rules (Exam Expectations)</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <article className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
              <h3 className="font-semibold">Formatting and Names</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                <li>Keywords in UPPER CASE: IF, FOR, WHILE, PROCEDURE.</li>
                <li>Identifiers in PascalCase and starting with capital letter.</li>
                <li>No underscore in identifier names.</li>
                <li>Use comments with //.</li>
              </ul>
            </article>
            <article className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
              <h3 className="font-semibold">Data Types and Constants</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                <li>INTEGER, REAL, CHAR, STRING, BOOLEAN.</li>
                <li>DECLARE Name : TYPE for variables.</li>
                <li>CONSTANT Name {"<-"} literal for constants.</li>
                <li>Constant value must be a literal, not an expression.</li>
              </ul>
            </article>
            <article className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
              <h3 className="font-semibold">Operators</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                <li>Arithmetic: + - * / ^</li>
                <li>Integer division routines: DIV(a,b), MOD(a,b)</li>
                <li>Relational: = &lt; &lt;= &gt; &gt;= &lt;&gt;</li>
                <li>Logical: AND OR NOT</li>
              </ul>
            </article>
            <article className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
              <h3 className="font-semibold">Common Library Routines</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                <li>LENGTH(StringValue) returns the number of characters in a string.</li>
                <li>LCASE(StringOrChar) and UCASE(StringOrChar) change case.</li>
                <li>SUBSTRING(StringValue, Start, Length) uses a 1-based start position.</li>
                <li>ROUND(RealValue, Places) rounds a real number to a chosen number of decimal places.</li>
                <li>RANDOM() returns a random number between 0 and 1 inclusive.</li>
              </ul>
            </article>
          </div>
          <div className="mt-4 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
            <h3 className="font-semibold">Official Routine Syntax</h3>
            <CopyableCodeBlock code={routineSyntaxExample} className="mt-3" />
            <p className="mt-3 text-sm text-[var(--muted)]">
              Cambridge specifically defines <code>ROUND(Value, Places)</code> and <code>RANDOM()</code>, and
              both routines are available in this editor&apos;s autocomplete.
            </p>
          </div>
        </section>

        <section id="loops" className="panel rounded-xl p-4 md:p-6">
          <h2 className="text-lg font-semibold">3) Loop Logic Deep Dive</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Students lose marks by choosing the wrong loop type or by writing loops that never terminate.
            Understand the condition timing and state changes in every cycle.
          </p>
          <div className="mt-4 grid gap-3">
            <article className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
              <h3 className="font-semibold">FOR Loop Logic</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                <li>Use FOR when iteration count is known.</li>
                <li>Bounds are inclusive, so FOR I {"<-"} 1 TO 5 runs 5 times.</li>
                <li>STEP can be positive or negative.</li>
              </ul>
            </article>
            <article className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
              <h3 className="font-semibold">WHILE Loop Logic</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                <li>Condition checked before loop body.</li>
                <li>Can execute zero times if initial condition is FALSE.</li>
                <li>Update variables inside loop so condition can become FALSE.</li>
              </ul>
            </article>
            <article className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
              <h3 className="font-semibold">REPEAT UNTIL Logic</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                <li>Loop body executes before condition check.</li>
                <li>Always executes at least once.</li>
                <li>Use UNTIL valid condition for input validation patterns.</li>
              </ul>
            </article>
          </div>
          <div className="mt-4 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
            <h3 className="font-semibold">Termination Checklist</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
              <li>Does each iteration change state?</li>
              <li>Can condition eventually become FALSE (WHILE) or TRUE (UNTIL)?</li>
              <li>Are bounds correct (no off-by-one mistakes)?</li>
              <li>Have you initialized counters/totals before the loop?</li>
            </ul>
          </div>
        </section>

        <section id="patterns" className="panel rounded-xl p-4 md:p-6">
          <h2 className="text-lg font-semibold">4) Reusable Coding Patterns</h2>
          <div className="mt-4 grid gap-4">
            {loopPatterns.map((pattern) => (
              <article key={pattern.title} className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
                <h3 className="font-semibold">{pattern.title}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  <span className="font-semibold text-[var(--text)]">When to use:</span> {pattern.whenToUse}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                  {pattern.logic.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <CopyableCodeBlock code={pattern.template} className="mt-3" />
                <div className="mt-3">
                  <p className="text-sm font-semibold">Logic walkthrough</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                    {pattern.walkthrough.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="worked" className="panel rounded-xl p-4 md:p-6">
          <h2 className="text-lg font-semibold">5) Fully Worked Programs</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            These are full exam-style answers showing declarations, control flow, and output.
          </p>
          <div className="mt-4 grid gap-4">
            {workedPrograms.map((program) => (
              <article key={program.title} className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3">
                <h3 className="font-semibold">{program.title}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  <span className="font-semibold text-[var(--text)]">Objective:</span> {program.objective}
                </p>
                <CopyableCodeBlock code={program.code} className="mt-3" />
                <div className="mt-3">
                  <p className="text-sm font-semibold">How the logic works</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                    {program.explanation.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-3">
                  <p className="text-sm font-semibold">Sample run</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                    {program.testRun.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="trace" className="panel rounded-xl p-4 md:p-6">
          <h2 className="text-lg font-semibold">6) Trace Tables and Dry Runs</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            In exams, a fast dry-run catches most logical mistakes. Track key variables after each iteration.
          </p>
          <CopyableCodeBlock code={traceTableExample} className="mt-3" />
          <div className="mt-4 overflow-x-auto rounded-md border border-[var(--panel-border)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[rgba(20,30,43,0.8)] text-[var(--accent)]">
                  <th className="border-b border-[var(--panel-border)] px-3 py-2">I</th>
                  <th className="border-b border-[var(--panel-border)] px-3 py-2">Fact before</th>
                  <th className="border-b border-[var(--panel-border)] px-3 py-2">Fact after Fact {"<-"} Fact * I</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border-b border-[var(--panel-border)] px-3 py-2">1</td>
                  <td className="border-b border-[var(--panel-border)] px-3 py-2">1</td>
                  <td className="border-b border-[var(--panel-border)] px-3 py-2">1</td>
                </tr>
                <tr>
                  <td className="border-b border-[var(--panel-border)] px-3 py-2">2</td>
                  <td className="border-b border-[var(--panel-border)] px-3 py-2">1</td>
                  <td className="border-b border-[var(--panel-border)] px-3 py-2">2</td>
                </tr>
                <tr>
                  <td className="border-b border-[var(--panel-border)] px-3 py-2">3</td>
                  <td className="border-b border-[var(--panel-border)] px-3 py-2">2</td>
                  <td className="border-b border-[var(--panel-border)] px-3 py-2">6</td>
                </tr>
                <tr>
                  <td className="border-b border-[var(--panel-border)] px-3 py-2">4</td>
                  <td className="border-b border-[var(--panel-border)] px-3 py-2">6</td>
                  <td className="border-b border-[var(--panel-border)] px-3 py-2">24</td>
                </tr>
                <tr>
                  <td className="border-b border-[var(--panel-border)] px-3 py-2">5</td>
                  <td className="border-b border-[var(--panel-border)] px-3 py-2">24</td>
                  <td className="border-b border-[var(--panel-border)] px-3 py-2">120</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-[var(--muted)]">
            For N = 5, expected output is 120. If your trace table and output disagree, debug the loop boundaries
            and initial value.
          </p>
        </section>

        <section id="files" className="panel rounded-xl p-4 md:p-6">
          <h2 className="text-lg font-semibold">7) File Handling Guide</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
            <li>Declare file name and data variables.</li>
            <li>OPENFILE with FOR READ or FOR WRITE.</li>
            <li>Use READFILE/WRITEFILE operations.</li>
            <li>CLOSEFILE when finished.</li>
          </ol>
          <CopyableCodeBlock code={fileHandlingExample} className="mt-3" />
          <div className="mt-3 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 text-sm text-[var(--muted)]">
            Avoid opening the same file in both READ and WRITE simultaneously, and always close files even in
            short algorithms.
          </div>
        </section>

        <section id="exam" className="panel rounded-xl p-4 md:p-6">
          <h2 className="text-lg font-semibold">8) Exam Command Words (Complete Table)</h2>
          <div className="mt-3 overflow-x-auto rounded-md border border-[var(--panel-border)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[rgba(20,30,43,0.8)] text-[var(--accent)]">
                  <th className="border-b border-[var(--panel-border)] px-3 py-2">Command Word</th>
                  <th className="border-b border-[var(--panel-border)] px-3 py-2">Meaning in Answers</th>
                </tr>
              </thead>
              <tbody>
                {commandWords.map(([word, meaning]) => (
                  <tr key={word}>
                    <td className="border-b border-[var(--panel-border)] px-3 py-2 font-semibold">{word}</td>
                    <td className="border-b border-[var(--panel-border)] px-3 py-2 text-[var(--muted)]">{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel rounded-xl p-4 md:p-6">
          <h2 className="text-lg font-semibold">Final Checklist Before Submitting an Exam Answer</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
            <li>All variables/arrays declared with correct data types.</li>
            <li>Initial values set for counters, totals, and flags.</li>
            <li>Correct loop choice: FOR vs WHILE vs REPEAT UNTIL.</li>
            <li>All IF/CASE/loop blocks properly ended.</li>
            <li>Procedure calls use CALL; function calls appear in expressions.</li>
            <li>Outputs match the question requirements exactly.</li>
            <li>Built-in routines such as ROUND() and RANDOM() use the correct syntax.</li>
            <li>Dry-run tested with normal and edge-case inputs.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
