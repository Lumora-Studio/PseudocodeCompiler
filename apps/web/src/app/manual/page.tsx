import ManualContent from "./ManualContent";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "/manual",
  "IGCSE pseudocode manual | Pseudocode Compiler",
  "Learn pseudocode with worked programs, FOR, WHILE and REPEAT loop examples, input validation, arrays, and Cambridge IGCSE notation.",
);

export default function ManualPage() {
  return <ManualContent />;
}
