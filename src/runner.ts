// Runs a demo in its own process, exactly as `npm run demo <name>` does, with
// the mode and outcome forced from outside. Used by the tests and the UI.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export type Mode = "development" | "live";

export interface RunOptions {
  mode: Mode;
  /** DELIVERD_DEV_OUTCOME. Ignored by the SDK outside development mode. */
  outcome?: string;
  /** Aborting kills the demo process. */
  signal?: AbortSignal;
  /** Called with output as it arrives, stdout and stderr together. */
  onOutput?: (text: string) => void;
}

export interface RunResult {
  /** Exit code; -1 when the process was killed. */
  code: number;
  output: string;
  ms: number;
}

export const root = fileURLToPath(new URL("..", import.meta.url));
const tsx = createRequire(import.meta.url).resolve("tsx/cli");

export function listDemos(): string[] {
  return readdirSync(new URL("./demos", import.meta.url))
    .filter((file) => file.endsWith(".ts"))
    .map((file) => file.slice(0, -3))
    .sort();
}

export function runDemo(name: string, { mode, outcome, signal, onOutput }: RunOptions): Promise<RunResult> {
  // Variables set here win over .env (src/demo.ts doesn't override them).
  // The SDK treats any DELIVERD_MODE other than "development" as live.
  const env: NodeJS.ProcessEnv = { ...process.env, DELIVERD_MODE: mode };
  if (outcome) env.DELIVERD_DEV_OUTCOME = outcome;
  else delete env.DELIVERD_DEV_OUTCOME;

  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsx, "src/demo.ts", name], { cwd: root, env, signal });
    let output = "";
    const take = (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      onOutput?.(text);
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    child.on("error", (error) => {
      // An abort also fires "close", which settles the promise.
      if (error.name !== "AbortError") reject(error);
    });
    child.on("close", (code) => resolve({ code: code ?? -1, output, ms: Date.now() - started }));
  });
}
