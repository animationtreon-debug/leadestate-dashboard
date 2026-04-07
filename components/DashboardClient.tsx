"use client";

import { useState } from "react";
import { PipelineView } from "./PipelineView";
import { ClientTable } from "./ClientTable";
import { ClientRecord, DashboardMetrics } from "@/lib/types/client";

interface DashboardClientProps {
  clients: ClientRecord[];
  metrics: DashboardMetrics;
}

export function DashboardClient({ clients, metrics }: DashboardClientProps) {
  const [activeStage, setActiveStage] = useState<string | null>(null);

  function handleStageClick(stage: string | null) {
    setActiveStage(stage);
  }

  return (
    <>
      <PipelineView metrics={metrics} activeStage={activeStage} onStageClick={handleStageClick} />
      <ClientTable clients={clients} stageFilter={activeStage} />
    </>
  );
}
