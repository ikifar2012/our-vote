import { randomBytes } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { chmod, readFile, writeFile } from "node:fs/promises";

loadEnvConfig(process.cwd(), true);
const path = ".env.local";
let existing = "";
try {
  existing = await readFile(path, "utf8");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
// Preserve all other settings. Never print credentials to terminal output.
function set(name: string, value: string) {
  const line = new RegExp(`^${name}=.*$`, "m");
  existing = line.test(existing)
    ? existing.replace(line, `${name}=${value}`)
    : `${existing.trimEnd()}\n${name}=${value}\n`;
}
set("TEST_MODE_ENABLED", "true");
if (!process.env.TEST_ACCESS_TOKEN || process.env.TEST_ACCESS_TOKEN.length < 32)
  set("TEST_ACCESS_TOKEN", randomBytes(32).toString("hex"));
await writeFile(path, existing.trimStart(), { mode: 0o600 });
await chmod(path, 0o600);
console.log(
  "Test mode configured in .env.local. Restart the web server, open /test, and sign in with TEST_ACCESS_TOKEN from your environment file.\nThe token was not printed. Add your WebActivity key, database, and public HTTPS SITE_URL to enable real phone delivery. See docs/activity-test.md.",
);
