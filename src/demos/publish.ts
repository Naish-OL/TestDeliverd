// publish(): put an HTML report at a stable, signed-in address, then update it
// safely with expectedVersion.
// Docs: https://deliverd.dev/docs/developers/publishing
//
// Live only: development mode doesn't simulate publishing. Creates or updates
// the report at slug "testdeliverd/demo", visible only to you.
import { DeliverdError } from "@deliverd/sdk";
import { deliverd } from "../client.js";

if (deliverd.development) {
  console.error("Publishing isn't simulated in development mode. Run with a live key.");
  process.exit(1);
}

const slug = "testdeliverd/demo";
const page = (note: string) =>
  `<!doctype html><title>TestDeliverd demo</title><h1>TestDeliverd demo</h1><p>${note}</p><p>${new Date().toISOString()}</p>`;

const { report, status } = await deliverd.publish({
  title: "TestDeliverd demo",
  slug,
  content: page("Published by the publish demo."),
  audience: "only me",
  living: true,
});
console.log(`${status ?? "published"}: ${report.url}`);
console.log(`Report id (for the review demo's DEMO_REPORT_ID): ${report.id}`);

// Update with expectedVersion so you never overwrite someone else's change.
// Use latestVersion, not the live version: held versions take numbers too.
const { latestVersion } = await deliverd.reports.versions(slug);
try {
  const updated = await deliverd.reports.update(slug, {
    content: page("Updated by the publish demo."),
    changeSummary: "Demo update",
    expectedVersion: latestVersion as number,
  });
  console.log(`Updated to version ${updated.version?.versionNumber ?? "?"} (${updated.status ?? "updated"})`);
} catch (error) {
  if (error instanceof DeliverdError && error.code === "version_conflict") {
    console.log("Someone published in between. Re-read the versions and try again.");
  } else {
    throw error;
  }
}
