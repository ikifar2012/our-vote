import { loadEnvConfig } from "@next/env";
import { sendTestStage } from "../lib/activity-test";
import { isCity } from "../lib/elections";
import { isTestStage } from "../lib/test-scenarios";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
const args = process.argv.slice(2);
if (!args.length || args.includes("--help")) {
  console.log(
    "Usage: bun run activity:test --city toronto|richmond-hill --stage waiting|first|lead-change|delayed|complete|end\nAll sends target dedicated test activities. Enable TEST_MODE_ENABLED and configure Postgres, WEBACTIVITY_API_KEY, and SITE_URL first.",
  );
  process.exit(0);
}
let city: unknown = "toronto";
let stage: unknown;
for (let index = 0; index < args.length; index += 2) {
  if (args[index] === "--city") city = args[index + 1];
  else if (args[index] === "--stage") stage = args[index + 1];
  else {
    console.error("Unknown option. Use --help.");
    process.exit(1);
  }
}
if (!isCity(city) || (stage !== "end" && !isTestStage(stage))) {
  console.error("Invalid city or stage. Use --help.");
  process.exit(1);
}
const result = await sendTestStage(city, stage);
console.log(result.message);
process.exit(result.ok ? 0 : 1);
