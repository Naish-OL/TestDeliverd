// collect(): ask people typed questions and get the answers back as data.
// Docs: https://deliverd.dev/docs/developers/approvals
//
// Try DELIVERD_DEV_OUTCOME=approved | timeout
// Kinds: text, long_text, number, date, choice, multi_choice, boolean.
import { DeliverdTimeoutError, type QuestionInput } from "@deliverd/sdk";
import { approvers, deliverd } from "../client.js";

const questions: QuestionInput[] = [
  { prompt: "Headcount at 30 September", kind: "number" },
  { prompt: "Any disposals in the quarter?", kind: "boolean" },
  { prompt: "Reporting currency", kind: "choice", options: ["GBP", "EUR", "USD"] },
  { prompt: "Anything the auditors should know?", kind: "long_text", required: false },
];

try {
  const result = await deliverd.collect({
    title: "Before I file the Q3 return",
    instructions: "Figures as at the end of the quarter.",
    questions,
    // collect() needs named respondents; there's no organisation default.
    respondents: approvers ?? ["you@example.com"],
    expiresIn: "1d",
    timeout: deliverd.development ? "5s" : "10m",
  });

  // An expired request returns whatever arrived. Check `complete` first.
  if (!result.complete) {
    console.log(`Incomplete (${result.status}); not filing. Partial answers:`, result.answers);
  } else {
    // Answers are keyed by the prompt text you asked.
    for (const { prompt } of questions) {
      console.log(`${prompt}: ${JSON.stringify(result.answers[prompt] ?? null)}`);
    }
  }
} catch (error) {
  if (!(error instanceof DeliverdTimeoutError)) throw error;
  console.log("No answers yet. The request stays open until it expires.");
}
