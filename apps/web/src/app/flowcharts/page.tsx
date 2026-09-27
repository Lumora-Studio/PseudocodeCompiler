import Link from 'next/link';
import { getSiteOrigin, pageMetadata } from '@/lib/seo';
import CopyableCodeBlock from '../manual/CopyableCodeBlock';

const title = 'Pseudocode to flowchart: editor and examples';
const description = 'Turn pseudocode into editable flowcharts. Learn process, input/output and decision symbols, follow IF branches and loops, and generate code from a diagram.';
export const metadata = pageMetadata('/flowcharts', `${title} | Pseudocode Compiler`, description);

const example = `DECLARE Score : INTEGER
INPUT Score
IF Score >= 50 THEN
    OUTPUT "Pass"
ELSE
    OUTPUT "Try again"
ENDIF`;

export default function FlowchartGuide() {
  const origin = getSiteOrigin();
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description,
    inLanguage: 'en',
    ...(origin ? { url: `${origin}/flowcharts`, mainEntityOfPage: `${origin}/flowcharts` } : {}),
  };
  return (
    <main className="manual-shell min-h-screen p-4 md:p-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }} />
      <article className="manual-container mx-auto max-w-4xl space-y-6 text-[var(--text)]">
        <nav aria-label="Guide navigation" className="flex gap-5 text-sm text-[var(--accent)]">
          <Link href="/" className="underline">Open the compiler</Link>
          <Link href="/manual" className="underline">Pseudocode manual</Link>
        </nav>
        <header className="manual-card p-6">
          <p className="manual-tag">Flowchart guide</p>
          <h1 className="mt-4 text-3xl font-bold">Pseudocode to flowchart</h1>
          <p className="mt-4 leading-7 text-[var(--text2)]">A flowchart shows the order in which an algorithm runs. Pseudocode Compiler turns your source into blocks and connections, so you can inspect decisions and loops, edit the diagram, and generate pseudocode from it.</p>
        </header>
        <section className="manual-card space-y-4 p-6">
          <h2 className="text-xl font-semibold">Create a flowchart from pseudocode</h2>
          <ol className="list-decimal space-y-3 pl-6 leading-7">
            <li>Open the compiler and create or select a pseudocode file.</li>
            <li>Enable the beta flowchart editor in Settings, then use the flowchart button in the toolbar.</li>
            <li>Use Fit chart to see the whole algorithm. Select a block to edit its contents in the Inspector.</li>
            <li>Add blocks by clicking the palette, pressing Enter or Space, or dragging onto the canvas. Connect an output handle to the next block’s input handle.</li>
          </ol>
          <p className="leading-7 text-[var(--text2)]">Opening the chart preserves your document. Changes to blocks update the pseudocode. Undo and redo work inside the chart; when typing in a field, the usual text undo still works. Clear Canvas keeps the document until you choose Generate Code.</p>
        </section>
        <section className="manual-card space-y-4 p-6">
          <h2 className="text-xl font-semibold">What the flowchart symbols mean</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div><dt className="font-semibold">Start and End</dt><dd className="mt-1 text-[var(--text2)]">Rounded blocks mark the entry and exit. Start has no incoming connection; End has no outgoing connection.</dd></div>
            <div><dt className="font-semibold">Process</dt><dd className="mt-1 text-[var(--text2)]">A rectangle holds declarations, assignments, or several consecutive steps.</dd></div>
            <div><dt className="font-semibold">Input and Output</dt><dd className="mt-1 text-[var(--text2)]">A parallelogram reads a value or displays a result.</dd></div>
            <div><dt className="font-semibold">Decision</dt><dd className="mt-1 text-[var(--text2)]">A diamond tests a condition. Its Yes and No connections lead to different branches.</dd></div>
          </dl>
        </section>
        <section className="manual-card space-y-4 p-6">
          <h2 className="text-xl font-semibold">Example: choose an output with IF and ELSE</h2>
          <CopyableCodeBlock code={example} />
          <p className="leading-7 text-[var(--text2)]">After INPUT reads Score, the diamond checks whether Score is at least 50. The Yes branch outputs “Pass”; the No branch outputs “Try again”. Both paths join at End. Test with 49 and 50 to check the boundary.</p>
        </section>
        <section className="manual-card space-y-4 p-6">
          <h2 className="text-xl font-semibold">Loops and the current beta limits</h2>
          <p className="leading-7 text-[var(--text2)]">FOR and WHILE loops use a decision and a connection back to the loop condition. Nested branches use separate columns. Each output handle accepts one connection, while several paths can join at the same input.</p>
          <p className="leading-7 text-[var(--text2)]">REPEAT UNTIL, CASE, and procedure definitions remain as source inside process blocks. They are preserved when code is generated, but are not yet expanded into individual flowchart branches. The compiler still checks your program when you run it.</p>
          <Link href="/" className="manual-back-btn inline-flex">Try the flowchart editor</Link>
        </section>
      </article>
    </main>
  );
}
