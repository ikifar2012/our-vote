import { Suspense } from "react";
import type { Metadata } from "next";
import { AndroidSetup } from "@/app/ui/android-setup";

export const metadata: Metadata = {
  title: "Follow on Android — Our Vote",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Setup({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return (
    <AndroidSetup
      userId={typeof params.userId === "string" ? params.userId : ""}
      origin={typeof params.o === "string" ? params.o : ""}
    />
  );
}

export default function AndroidPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense
      fallback={<main className="test-page">Loading Android setup…</main>}
    >
      <Setup searchParams={searchParams} />
    </Suspense>
  );
}
