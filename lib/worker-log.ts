import { randomUUID } from "node:crypto";

let instanceId: string | undefined;

export function logEvent(
  event: string,
  fields: Record<string, unknown> = {},
  level: "info" | "warn" | "error" | "debug" = "info",
) {
  if (level === "debug" && process.env.WORKER_LOG_LEVEL !== "debug") return;
  instanceId ??= randomUUID();
  const secrets = [
    process.env.WEBACTIVITY_API_KEY,
    process.env.TEST_ACCESS_TOKEN,
    process.env.DATABASE_URL,
  ].filter((value): value is string => Boolean(value));
  const entry = JSON.stringify(
    {
      ...fields,
      timestamp: new Date().toISOString(),
      instanceId,
      level,
      event,
    },
    (_key, value: unknown) => {
      if (typeof value !== "string") return value;
      let redacted = value;
      for (const secret of secrets)
        redacted = redacted.replaceAll(secret, "[REDACTED]");
      return redacted;
    },
  );
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}

export function diagnosticToken(value: unknown, maxLength = 128) {
  return typeof value === "string" &&
    value.length <= maxLength &&
    /^[a-zA-Z0-9_.:-]+$/.test(value)
    ? value
    : undefined;
}

export function errorFields(error: unknown) {
  const value = error as { name?: unknown; code?: unknown } | null;
  return {
    errorType: diagnosticToken(value?.name) || "UnknownError",
    errorCode: diagnosticToken(value?.code),
  };
}
