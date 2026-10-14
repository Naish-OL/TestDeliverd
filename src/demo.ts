// Runs one demo: `npm run demo <name>` loads src/demos/<name>.ts.
//
// .env is loaded here, before anything imports the SDK, because the client
// reads DELIVERD_MODE and DELIVERD_API_KEY when it is constructed. Variables
// already set in the shell win, so `DELIVERD_DEV_OUTCOME=rejected npm run demo
// approve` works without editing .env.
import { existsSync, readdirSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

const demos = readdirSync(new URL("./demos", import.meta.url))
  .filter((file) => file.endsWith(".ts"))
  .map((file) => file.slice(0, -3))
  .sort();

const name = process.argv[2];
if (!name || !demos.includes(name)) {
  console.error(`Usage: npm run demo <name>\nDemos: ${demos.join(", ")}`);
  process.exit(1);
}

await import(`./demos/${name}.ts`);
