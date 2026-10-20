import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "our-vote-test";
const SESSION_SECONDS = 4 * 60 * 60;

export function testModeEnabled() {
  return (
    process.env.TEST_MODE_ENABLED === "true" &&
    (process.env.TEST_ACCESS_TOKEN?.length ?? 0) >= 32
  );
}

function equal(left: string, right: string) {
  return timingSafeEqual(
    createHash("sha256").update(left).digest(),
    createHash("sha256").update(right).digest(),
  );
}

function signature(expires: string) {
  return createHmac("sha256", process.env.TEST_ACCESS_TOKEN!)
    .update(`our-vote-test:${expires}`)
    .digest("hex");
}

export async function hasTestSession() {
  if (!testModeEnabled()) return false;
  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  if (!cookie) return false;
  const [expires, signed, extra] = cookie.split(".");
  const now = Math.floor(Date.now() / 1000);
  if (
    extra ||
    !/^\d+$/.test(expires) ||
    !signed ||
    Number(expires) <= now ||
    Number(expires) > now + SESSION_SECONDS
  )
    return false;
  return equal(signed, signature(expires));
}

export async function requireTestSession() {
  if (!(await hasTestSession())) throw new Error("Sign in to test mode again.");
}

export async function createTestSession(token: string) {
  if (!testModeEnabled() || !equal(token, process.env.TEST_ACCESS_TOKEN!))
    return false;
  const expires = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  (await cookies()).set(COOKIE_NAME, `${expires}.${signature(expires)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  return true;
}

export async function clearTestSession() {
  (await cookies()).delete(COOKIE_NAME);
}
