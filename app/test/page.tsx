import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { hasTestSession, testModeEnabled } from "@/lib/test-auth";
import { ActivityTest, TestLogin } from "@/app/ui/activity-test";

export const metadata: Metadata = {
  title: "Live Activity Test — Our Vote",
  robots: { index: false, follow: false },
};

async function TestAccess() {
  await connection();
  if (!testModeEnabled()) notFound();
  if (!(await hasTestSession())) return <TestLogin />;
  return <ActivityTest />;
}

export default function TestPage() {
  return (
    <Suspense
      fallback={
        <main className="test-page">
          <p>Loading test controls…</p>
        </main>
      }
    >
      <TestAccess />
    </Suspense>
  );
}
