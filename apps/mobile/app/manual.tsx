import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  createThemedStyleSheet,
  fonts,
  radii,
  useThemedStyles,
} from "../lib/theme";

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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(useStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function CodeBlock({ code }: { code: string }) {
  const styles = useThemedStyles(useStyles);
  return (
    <View style={styles.codeBlock}>
      <Text style={styles.codeText}>{code}</Text>
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  const styles = useThemedStyles(useStyles);
  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <Text key={index} style={styles.listItem}>
          {"\u2022"} {item}
        </Text>
      ))}
    </View>
  );
}

export default function GuidelinesScreen() {
  const styles = useThemedStyles(useStyles);
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Cambridge 0478 Guide</Text>
        <Text style={styles.title}>Pseudocode Guidelines</Text>
        <Text style={styles.desc}>
          Based on Cambridge IGCSE Computer Science (0478) syllabus 2026-2028
          assessment details pages 35-49. This guide follows the official exam
          syntax and includes the built-in routines available in the editor.
        </Text>
      </View>

      <View style={styles.note}>
        <Text style={styles.noteTitle}>Editor support</Text>
        <Text style={styles.noteText}>
          Cambridge examples use the left-arrow assignment symbol. In this
          editor you can type {"<-"} and it will become {"\u2190"}. Autocomplete
          also supports DIV, MOD, LENGTH, LCASE,
          UCASE, SUBSTRING, ROUND, and RANDOM with their exam-style syntax.
        </Text>
      </View>

      <Section title="1) Writing Workflow">
        <BulletList
          items={[
            "Read the problem and identify required inputs and outputs.",
            "Declare every variable or array with the correct data type.",
            "Initialize counters, totals, and flags before loops.",
            "Choose the correct loop or selection structure.",
            "Write processing logic in small readable blocks.",
            "Output only the final required results.",
            "Dry-run with normal and edge-case values.",
          ]}
        />
        <CodeBlock
          code={`DECLARE Index : INTEGER
DECLARE Value : INTEGER
DECLARE Total : INTEGER
CONSTANT MaxItems \u2190 5

Total \u2190 0

FOR Index \u2190 1 TO MaxItems
    INPUT Value
    Total \u2190 Total + Value
NEXT Index

OUTPUT "Total = ", Total`}
        />
      </Section>

      <Section title="2) Core Syntax Rules">
        <Text style={styles.subheading}>Formatting and identifiers</Text>
        <BulletList
          items={[
            "Keywords are in upper case: IF, FOR, WHILE, PROCEDURE.",
            "Identifiers use PascalCase and start with a capital letter.",
            "Identifiers can contain letters and digits only.",
            "Do not use underscores in identifier names.",
            "Comments start with // and continue to the end of the line.",
          ]}
        />

        <Text style={styles.subheading}>Declarations and data types</Text>
        <BulletList
          items={[
            "Basic types: INTEGER, REAL, CHAR, STRING, BOOLEAN.",
            "Variable syntax: DECLARE Name : TYPE",
            "Constant syntax: CONSTANT Name \u2190 literal",
            "A constant value must be a literal, not another variable or expression.",
          ]}
        />
        <CodeBlock
          code={`DECLARE Counter : INTEGER
DECLARE TotalToPay : REAL
DECLARE GameOver : BOOLEAN
CONSTANT HourlyRate \u2190 6.50`}
        />

        <Text style={styles.subheading}>Operators</Text>
        <BulletList
          items={[
            "Arithmetic: +, -, *, /, ^",
            "Integer division routines: DIV(a, b), MOD(a, b)",
            "Relational: =, <, <=, >, >=, <>",
            "Logical: AND, OR, NOT",
          ]}
        />
      </Section>

      <Section title="3) Built-in Routines and Exact Syntax">
        <BulletList
          items={[
            "LENGTH(Text) returns the number of characters in a STRING.",
            "LCASE(TextOrChar) returns lower-case text or character.",
            "UCASE(TextOrChar) returns upper-case text or character.",
            "SUBSTRING(Text, Start, Length) returns part of a string. Start is usually 1 for the first character.",
            "ROUND(Value, Places) rounds a REAL to the given number of decimal places.",
            "RANDOM() returns a random number between 0 and 1 inclusive.",
          ]}
        />
        <CodeBlock
          code={`LENGTH("Happy Days")
LCASE('W')
UCASE("Happy")
SUBSTRING("Happy Days", 1, 5)
ROUND(15.6789, 2)
RANDOM()

Value \u2190 ROUND(RANDOM() * 6, 0)`}
        />
        <Text style={styles.subheading}>Important note</Text>
        <BulletList
          items={[
            "ROUND and RANDOM are supported by the compiler and the text editor autocomplete.",
            "Use these routines inside expressions, for example Score \u2190 ROUND(Average, 1).",
          ]}
        />
      </Section>

      <Section title="4) Loop Logic">
        <Text style={styles.subheading}>FOR loop</Text>
        <BulletList
          items={[
            "Use FOR when the number of repetitions is known.",
            "Bounds are inclusive.",
            "STEP can be positive or negative.",
          ]}
        />
        <CodeBlock
          code={`FOR Count \u2190 1 TO 10
    Total \u2190 Total + Count
NEXT Count`}
        />

        <Text style={styles.subheading}>WHILE loop</Text>
        <BulletList
          items={[
            "Condition is checked before the loop body.",
            "The loop may run zero times.",
            "Your code must change state so the condition can become FALSE.",
          ]}
        />
        <CodeBlock
          code={`WHILE Number > 9 DO
    Number \u2190 Number - 9
ENDWHILE`}
        />

        <Text style={styles.subheading}>REPEAT UNTIL loop</Text>
        <BulletList
          items={[
            "The loop body runs before the condition is checked.",
            "The loop always runs at least once.",
            "This is good for input validation.",
          ]}
        />
        <CodeBlock
          code={`REPEAT
    OUTPUT "Enter password"
    INPUT Password
UNTIL Password = "Secret"`}
        />
      </Section>

      <Section title="5) Procedures and Functions">
        <BulletList
          items={[
            "Procedures are called with CALL because they are complete statements.",
            "Functions return one value and must be used inside expressions.",
            "Do not use CALL with a function.",
          ]}
        />
        <CodeBlock
          code={`PROCEDURE PrintLine(Count : INTEGER)
    DECLARE Index : INTEGER
    FOR Index \u2190 1 TO Count
        OUTPUT "-"
    NEXT Index
ENDPROCEDURE

FUNCTION SumSquare(A : INTEGER, B : INTEGER) RETURNS INTEGER
    RETURN A * A + B * B
ENDFUNCTION

DECLARE Answer : INTEGER
CALL PrintLine(10)
Answer \u2190 SumSquare(3, 4)
OUTPUT "Answer = ", Answer`}
        />
      </Section>

      <Section title="6) File Handling">
        <BulletList
          items={[
            "Open files explicitly with FOR READ or FOR WRITE.",
            "Use READFILE to read data into a variable.",
            "Use WRITEFILE to write data from a variable.",
            "Always CLOSEFILE when finished.",
          ]}
        />
        <CodeBlock
          code={`DECLARE FileName : STRING
DECLARE LineText : STRING

FileName \u2190 "Scores.txt"
OPENFILE FileName FOR READ
READFILE FileName, LineText
OUTPUT "First line was: ", LineText
CLOSEFILE FileName`}
        />
      </Section>

      <Section title="7) Exam Command Words">
        {commandWords.map(([word, meaning]) => (
          <View key={word} style={styles.tableRow}>
            <Text style={styles.tableWord}>{word}</Text>
            <Text style={styles.tableMeaning}>{meaning}</Text>
          </View>
        ))}
      </Section>

      <Section title="Final Checklist">
        <BulletList
          items={[
            "All variables and arrays are declared with correct data types.",
            "Initial values are set before processing starts.",
            "Loop choice matches the problem.",
            "Every IF, CASE, and loop block is properly ended.",
            "Procedure calls use CALL and function calls stay inside expressions.",
            "Outputs match the question exactly.",
            "Built-in routines such as ROUND() and RANDOM() are used with correct syntax.",
          ]}
        />
      </Section>

      <View style={styles.footerSpace} />
    </ScrollView>
  );
}

const useStyles = createThemedStyleSheet(({ colors }) => ({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 16,
  },
  header: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.accent,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: 4,
  },
  desc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 19,
  },
  note: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: radii.section,
    padding: 14,
    marginBottom: 12,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent,
  },
  noteText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 19,
  },
  section: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    borderRadius: radii.section,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 10,
  },
  subheading: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: 12,
    marginBottom: 6,
  },
  list: {
    gap: 4,
  },
  listItem: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    paddingLeft: 4,
  },
  codeBlock: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radii.row,
    padding: 12,
    marginTop: 10,
  },
  codeText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
  },
  tableWord: {
    width: 100,
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  tableMeaning: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
  footerSpace: {
    height: 40,
  },
}));
