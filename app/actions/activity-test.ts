"use server";

import { redirect } from "next/navigation";
import {
  clearTestSession,
  createTestSession,
  requireTestSession,
} from "@/lib/test-auth";
import { readTestStatus, sendTestStage } from "@/lib/activity-test";
import { isCity } from "@/lib/elections";
import { isTestStage } from "@/lib/test-scenarios";
import type { City } from "@/lib/types";

export async function signInToTest(
  _previous: { error: string },
  form: FormData,
) {
  const token = form.get("accessToken");
  if (
    typeof token !== "string" ||
    token.length > 256 ||
    !(await createTestSession(token))
  )
    return { error: "Invalid access token or test mode is disabled." };
  redirect("/test");
}

export async function signOutOfTest() {
  await clearTestSession();
  redirect("/test");
}

export async function getTestStatus(city: City) {
  await requireTestSession();
  if (!isCity(city)) throw new Error("Unknown city");
  return readTestStatus(city);
}

export async function sendActivityTest(city: City, stage: string) {
  await requireTestSession();
  if (!isCity(city) || (stage !== "end" && !isTestStage(stage)))
    throw new Error("Unknown test stage");
  const result = await sendTestStage(city, stage);
  return { ...result, status: await readTestStatus(city) };
}
