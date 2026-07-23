"use client";

import { Suspense, use } from "react";
import { ModuleWorkspace } from "@/components/pm/ModuleWorkspace";

function Page({ module }: { module: string }) {
  return <ModuleWorkspace slug={module} />;
}

export default function PmModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = use(params);
  return (
    <Suspense fallback={null}>
      <Page module={module} />
    </Suspense>
  );
}
