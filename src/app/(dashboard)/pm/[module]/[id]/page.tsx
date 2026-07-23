"use client";

import { use } from "react";
import { RecordDetail } from "@/components/pm/RecordDetail";

export default function PmRecordPage({ params }: { params: Promise<{ module: string; id: string }> }) {
  const { module, id } = use(params);
  return <RecordDetail slug={module} id={id} />;
}
