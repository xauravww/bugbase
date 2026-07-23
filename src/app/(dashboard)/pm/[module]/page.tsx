"use client";

import { use } from "react";
import { ModuleWorkspace } from "@/components/pm/ModuleWorkspace";

export default function PmModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = use(params);
  return <ModuleWorkspace slug={module} />;
}
