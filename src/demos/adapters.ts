// Adapters: put a person in front of an agent framework's tool calls.
// Docs: https://deliverd.dev/docs/developers/sdk
//
// Uses the Claude Agent SDK adapter, deliverdCanUseTool. Pass the function it
// returns as `canUseTool` to the Agent SDK's query(). Here it's called directly
// with the arguments the Agent SDK would pass, so no model or Anthropic key is
// needed. Adapters for the AI SDK, OpenAI Agents SDK and LangGraph work the same way.
//
// Try DELIVERD_DEV_OUTCOME=approved | rejected
import { deliverdCanUseTool } from "@deliverd/sdk/adapters";
import { approvers, deliverd } from "../client.js";

const canUseTool = deliverdCanUseTool({
  deliverd,
  approvers,
  // Only these tools need a person; everything else is allowed unchanged.
  when: (tool) => tool === "Bash" || tool.startsWith("mcp__"),
  expiresIn: "1h",
});

const signal = new AbortController().signal;
const calls: [string, Record<string, unknown>][] = [
  ["Read", { file_path: "CHANGELOG.md" }],
  ["Bash", { command: "npm publish" }],
];

for (const [tool, input] of calls) {
  // The tool-use id makes the request idempotent: a retried call doesn't ask twice.
  const result = await canUseTool(tool, input, { signal, toolUseID: `toolu_${tool.toLowerCase()}` });
  console.log(
    `${tool} ${JSON.stringify(input)} → ${result.behavior}` +
      (result.behavior === "deny" ? `\n  told the model: ${result.message}` : ""),
  );
}
