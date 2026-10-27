import { spawn, type ChildProcess } from "node:child_process";

const children = new Map<ChildProcess, Promise<number>>();
let stopping = false;

function run(name: string, path: string) {
  console.log(`Starting ${name}.`);
  const child = spawn(process.execPath, [path], { stdio: "inherit" });
  const exited = new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  }).finally(() => children.delete(child));
  children.set(child, exited);
  return exited;
}

async function stop(code: number) {
  if (stopping) return;
  stopping = true;
  const running = [...children];
  for (const [child] of running) child.kill("SIGTERM");
  const timeout = setTimeout(() => {
    for (const [child] of running) {
      if (child.exitCode === null && child.signalCode === null)
        child.kill("SIGKILL");
    }
  }, 10_000);
  timeout.unref();
  await Promise.allSettled(running.map(([, exited]) => exited));
  clearTimeout(timeout);
  process.exit(code);
}

process.once("SIGTERM", () => void stop(0));
process.once("SIGINT", () => void stop(0));

async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "Set DATABASE_URL to your PostgreSQL connection in Dokploy.",
    );
  if (process.env.LIVE_ACTIVITIES_ENABLED !== "true")
    console.warn(
      "Live Activities are disabled; the worker will collect results only.",
    );
  else if (!process.env.WEBACTIVITY_API_KEY)
    console.warn(
      "WEBACTIVITY_API_KEY is missing; the worker will collect results without phone delivery.",
    );

  const migrated = await run("database migrations", "dist/migrate.js");
  if (stopping) return;
  if (migrated !== 0) throw new Error("Database migrations failed.");

  const web = run("web server", "server.js");
  const worker = run("results worker", "dist/worker.js");
  const ended = await Promise.race([
    web.then((code) => ({ name: "Web server", code })),
    worker.then((code) => ({ name: "Results worker", code })),
  ]);
  if (stopping) return;
  throw new Error(`${ended.name} exited unexpectedly (${ended.code}).`);
}

main().catch(async (error) => {
  console.error(
    error instanceof Error ? error.message : "Container startup failed.",
  );
  await stop(1);
});
